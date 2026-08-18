import React, { useState } from "react";
import { Upload, Spin, message, Button, Popconfirm } from "antd";
import { UploadOutlined, DeleteOutlined } from "@ant-design/icons";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const STORAGE_FIELD_BASE = "/api/advanced-development/media/storage-field";

/**
 * Edit-mode widget for the Advanced Development extension's declarative
 * `StorageField` (see `advanced_development.modules.media.storage_field`).
 * Rendered by `renderInput.tsx` for any field whose `editViewType` resolves
 * to `"editable-storage-field"`.
 *
 * Supports both of that module's backends without knowing which is active:
 * tries the local backend's one-step direct upload first
 * (`POST .../storage-field/upload`); a 400 response there means the host is
 * on the S3 backend, so it falls back to the two-step presigned flow
 * (`.../upload-url` -> PUT straight to S3 -> `.../confirm`) instead of
 * requiring separate frontend configuration to know which backend is live.
 *
 * File selection is only available once the record has been saved (a real
 * primary key exists) — the backend's upload routes address the target row
 * by `pk`, so there is nowhere to attach the file to before that.
 */
export const StorageFieldInput: React.FC<{
    value?: string | null;
    onChange?: (value: string | null) => void;
    modelName?: string;
    fieldName?: string;
    pk?: string | number;
}> = ({ value, onChange, modelName, fieldName, pk }) => {
    const [busy, setBusy] = useState(false);

    const handleUpload = async (file: globalThis.File): Promise<boolean> => {
        if (!pk) {
            message.error(_("Save the record first before attaching a file."));
            return false;
        }
        if (!modelName || !fieldName) return false;

        setBusy(true);
        try {
            const form = new FormData();
            form.append("model_name", modelName);
            form.append("field_name", fieldName);
            form.append("pk", String(pk));
            form.append("file", file);

            const direct = await authenticatedFetch(`${STORAGE_FIELD_BASE}/upload`, {
                method: "POST",
                body: form,
            });

            if (direct.status === 400) {
                // Not the local backend -- fall back to the S3 presigned two-step flow.
                const step1 = await authenticatedFetch(`${STORAGE_FIELD_BASE}/upload-url`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model_name: modelName,
                        field_name: fieldName,
                        filename: file.name,
                        content_type: file.type || "application/octet-stream",
                    }),
                });
                if (!step1.ok) throw new Error(await step1.text());
                const { upload_url, storage_key } = await step1.json();

                const put = await fetch(upload_url, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type || "application/octet-stream" },
                });
                if (!put.ok) throw new Error(_("Upload to storage failed."));

                const confirm = await authenticatedFetch(`${STORAGE_FIELD_BASE}/confirm`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model_name: modelName, field_name: fieldName, pk, storage_key }),
                });
                if (!confirm.ok) throw new Error(await confirm.text());
                onChange?.(storage_key);
            } else if (direct.ok) {
                const data = await direct.json();
                onChange?.(data.storage_key);
            } else {
                throw new Error(await direct.text());
            }
            message.success(_("File uploaded."));
        } catch (err: any) {
            message.error(err?.message || _("File upload failed."));
        } finally {
            setBusy(false);
        }
        return false; // prevent antd's own default upload behavior -- handled above
    };

    const handleRemove = async () => {
        if (pk && modelName && fieldName) {
            setBusy(true);
            try {
                const qs = new URLSearchParams({ model_name: modelName, field_name: fieldName, pk: String(pk) });
                const res = await authenticatedFetch(`${STORAGE_FIELD_BASE}?${qs.toString()}`, { method: "DELETE" });
                if (!res.ok) throw new Error(await res.text());
            } catch (err: any) {
                message.error(err?.message || _("Could not remove the file."));
                setBusy(false);
                return;
            }
            setBusy(false);
        }
        onChange?.(null);
    };

    if (!pk) {
        return (
            <div style={{ color: "#999", fontSize: 12, padding: "8px 0" }}>
                {_("Save the record first, then attach a file here.")}
            </div>
        );
    }

    const attachedName = value ? value.split("/").slice(1).join("/") || value : null;

    return (
        <div>
            <Upload.Dragger beforeUpload={handleUpload} showUploadList={false} multiple={false} disabled={busy} style={{ padding: "8px 16px" }}>
                <p style={{ marginBottom: 4 }}>
                    {busy ? <Spin size="small" /> : <UploadOutlined style={{ fontSize: 24, color: "#1677ff" }} />}
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                    {busy ? _("Uploading...") : _("Click or drag a file here to upload")}
                </p>
            </Upload.Dragger>
            {attachedName && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ color: "#666" }}>{_("Attached")}: {attachedName}</span>
                    <Popconfirm title={_("Remove this file?")} onConfirm={handleRemove}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={busy} />
                    </Popconfirm>
                </div>
            )}
        </div>
    );
};

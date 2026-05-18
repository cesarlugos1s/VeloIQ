import React, { useState } from "react";
import { Form, Upload, Spin, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const FILE_DATA_FIELDS = new Set(["data", "data_format", "data_encoding", "data_name", "data_hash"]);

export const FileUploadInput: React.FC<{ value?: any; onChange?: (value: any) => void }> = ({ value: _value, onChange: _onChange }) => {
    const form = Form.useFormInstance();
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);

    const currentDataName = Form.useWatch("data_name", form);

    const handleUpload = async (file: globalThis.File) => {
        const recordId = form.getFieldValue("eid") ?? form.getFieldValue("id");
        if (!recordId) {
            message.error(_("Save the record first before uploading a file."));
            return false;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await authenticatedFetch(`/api/file/${recordId}/upload`, {
                method: "POST",
                body: formData,
            });
            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || `Upload failed (${response.status})`);
            }
            const result = await response.json();

            form.setFieldsValue({
                data: undefined,
                data_format: result.data_format,
                data_encoding: result.data_encoding,
                data_name: result.data_name,
                data_hash: result.data_hash,
            });
            setFileName(result.data_name || file.name);
            message.success(_("File uploaded successfully."));
        } catch (err: any) {
            message.error(err?.message || _("File upload failed."));
        } finally {
            setUploading(false);
        }
        return false;
    };

    const displayName = fileName || currentDataName;

    return (
        <div>
            <Upload.Dragger
                beforeUpload={handleUpload}
                showUploadList={false}
                multiple={false}
                disabled={uploading}
                style={{ padding: "8px 16px" }}
            >
                <p style={{ marginBottom: 4 }}>
                    {uploading ? <Spin size="small" /> : <UploadOutlined style={{ fontSize: 24, color: "#1677ff" }} />}
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                    {uploading ? _("Uploading...") : _("Click or drag a file here to upload")}
                </p>
                {displayName && !uploading && (
                    <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>
                        {_("Current")}: {displayName}
                    </p>
                )}
            </Upload.Dragger>
        </div>
    );
};

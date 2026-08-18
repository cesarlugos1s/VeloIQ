import React, { useState } from "react";
import { Button, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/**
 * Read-only-mode display for the Advanced Development extension's
 * declarative `StorageField`. Rendered by `renderFieldValue.tsx` for any
 * field whose `showViewType` resolves to `"read-only-storage-field"`.
 *
 * Only the field's resolved value (the storage key) is available here —
 * `renderFieldValue`'s caller doesn't thread through the surrounding
 * model/record context the edit-mode widget uses — so this hits the
 * backend's key-only route (`GET .../storage-field/by-key/{storage_key}`)
 * rather than the model/field/pk-addressed ones. Downloads via a fetch +
 * blob object URL (not a plain `<a href>`) because the route requires the
 * same bearer-token auth every other API call uses, which a plain anchor
 * tag has no way to attach.
 */
export const StorageFieldValue: React.FC<{ storageKey: string }> = ({ storageKey }) => {
    const [busy, setBusy] = useState(false);
    const filename = storageKey.split("/").slice(1).join("/") || storageKey;

    const handleDownload = async () => {
        setBusy(true);
        try {
            const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
            const res = await authenticatedFetch(`/api/advanced-development/media/storage-field/by-key/${encodedKey}`);
            if (!res.ok) throw new Error(_("Download failed."));
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            message.error(err?.message || _("Download failed."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Button size="small" icon={<DownloadOutlined />} loading={busy} onClick={handleDownload}>
            {filename}
        </Button>
    );
};

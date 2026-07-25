import React, { useState } from "react";
import { Modal, Upload, Button, Alert, Table, Typography, Space, Spin, message } from "antd";
import { UploadOutlined, InboxOutlined } from "@ant-design/icons";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import { useLicensePool } from "../../hooks/useLicensePool";
import { SampleRowsTable } from "./SampleRowsTable";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

interface ImportReport {
    inserted: number;
    updated: number;
    errors: { row: number; message: string }[];
    total_rows: number;
    sample_rows?: Record<string, any>[];
}

/** Model name of the IQVigilant module that provides "Smart" import/export, if installed. */
const SMART_IMPORT_EXPORT_MODULE = "data_import_export";

/**
 * "Import CSV" modal for the generic Basic-tier import endpoint
 * (`POST {resourcePath}/import-csv`). Two-step flow: dry-run preview, then
 * explicit confirmation — the preview call and the real import call are the
 * exact same request with `dry_run` toggled, so there is one code path here,
 * not two.
 */
export const ImportCsvModal: React.FC<{
    open: boolean;
    onClose: () => void;
    apiUrl: string;
    resourcePath: string;
    onImported?: () => void;
}> = ({ open, onClose, apiUrl, resourcePath, onImported }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportReport | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    // Tracks a header-mismatch (422) response specifically — that's the
    // literal "custom/messy headers" case the upsell copy names, but it
    // never reaches `preview` (the request fails before any report exists),
    // so it needs its own flag to be able to trigger the same hint.
    const [hadHeaderError, setHadHeaderError] = useState(false);
    // Free, instant, client-side-only signal shown right after file
    // selection — a rough header/row count parsed in the browser, with no
    // server round-trip. Deliberately not the authoritative validation
    // (that stays behind the Preview button, which does a real per-row DB
    // check server-side); this is just "does the file look roughly right"
    // feedback before committing to that more expensive step.
    const [localFileInfo, setLocalFileInfo] = useState<{ rowCount: number; headers: string[] } | null>(null);
    const { pool, loading: licenseLoading } = useLicensePool();

    const isSmartTierInstalled = !licenseLoading
        && Object.values(pool?.module_groups ?? {}).flat().includes(SMART_IMPORT_EXPORT_MODULE);

    // The upsell is contextual, not a permanent banner — only shown once the
    // user has actually hit something Basic can't solve (validation errors
    // in a preview, or a header-mismatch rejection), not the instant the
    // modal opens.
    const showUpsell = (preview !== null && preview.errors.length > 0) || hadHeaderError;

    const reset = () => {
        setFile(null);
        setPreview(null);
        setConfirmed(false);
        setHadHeaderError(false);
        setLocalFileInfo(null);
    };

    const parseLocalFileInfo = (f: File) => {
        f.text()
            .then((text) => {
                const lines = text.split(/\r\n|\n|\r/).filter((line) => line.length > 0);
                const headers = lines.length > 0 ? lines[0].split(",").map((h) => h.trim()) : [];
                setLocalFileInfo({ rowCount: Math.max(0, lines.length - 1), headers });
            })
            .catch(() => setLocalFileInfo(null));
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const runImport = async (dryRun: boolean): Promise<ImportReport | null> => {
        if (!file) return null;
        setBusy(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await authenticatedFetch(
                `${apiUrl}/${resourcePath}/import-csv?dry_run=${dryRun ? "true" : "false"}`,
                { method: "POST", body: formData },
            );
            if (!response.ok) {
                if (response.status === 422) setHadHeaderError(true);
                const bodyText = await response.text();
                let detail = bodyText;
                try {
                    detail = JSON.parse(bodyText)?.detail || bodyText;
                } catch {
                    // Not JSON — use the raw text as-is.
                }
                throw new Error(detail || _("Import failed."));
            }
            return await response.json();
        } finally {
            setBusy(false);
        }
    };

    const handlePreview = async () => {
        try {
            const report = await runImport(true);
            setPreview(report);
        } catch (err: any) {
            message.error(err?.message || _("Import failed."));
        }
    };

    const handleConfirm = async () => {
        try {
            const report = await runImport(false);
            setPreview(report);
            setConfirmed(true);
            onImported?.();
        } catch (err: any) {
            message.error(err?.message || _("Import failed."));
        }
    };

    return (
        <Modal
            title={_("Import CSV")}
            open={open}
            onCancel={handleClose}
            footer={null}
            destroyOnClose
            width={860}
            style={{ maxWidth: "95vw" }}
        >
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
                {!confirmed && (
                    <Upload.Dragger
                        beforeUpload={(f) => {
                            setFile(f);
                            setPreview(null);
                            setHadHeaderError(false);
                            setLocalFileInfo(null);
                            parseLocalFileInfo(f);
                            return false;
                        }}
                        showUploadList={false}
                        multiple={false}
                        disabled={busy}
                    >
                        <p style={{ marginBottom: 4 }}>
                            {busy ? <Spin size="small" /> : <InboxOutlined style={{ fontSize: 24, color: "#1677ff" }} />}
                        </p>
                        <p style={{ fontSize: 13, margin: 0 }}>
                            {file ? file.name : _("Click or drag a CSV file here")}
                        </p>
                        <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>
                            {_("Headers must match the model's field names exactly.")}
                        </p>
                    </Upload.Dragger>
                )}

                {!confirmed && !preview && localFileInfo && (
                    <Typography.Text style={{ fontSize: 12, color: "#888" }}>
                        {localFileInfo.rowCount} {_("rows detected")} — {_("headers")}: {localFileInfo.headers.join(", ")}
                    </Typography.Text>
                )}

                {preview && (
                    <Alert
                        type={preview.errors.length > 0 ? "warning" : "success"}
                        showIcon
                        message={
                            confirmed
                                ? _("Import complete")
                                : _("Preview (no changes made yet)")
                        }
                        description={
                            <>
                                <Typography.Text>
                                    {_("Rows")}: {preview.total_rows} — {_("Valid")}: {preview.inserted + preview.updated} — {_("Errors")}: {preview.errors.length}
                                </Typography.Text>
                                {preview.errors.length > 0 && (
                                    <Table
                                        size="small"
                                        style={{ marginTop: 8 }}
                                        pagination={{ pageSize: 8 }}
                                        dataSource={preview.errors}
                                        rowKey="row"
                                        // Long DB/validation error messages don't fit a table cell —
                                        // show a truncated preview and let the row expand for the
                                        // full text, instead of forcing the column wide/tall.
                                        expandable={{
                                            rowExpandable: (record) => record.message.length > 80,
                                            expandedRowRender: (record) => (
                                                <Typography.Paragraph
                                                    copyable
                                                    style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}
                                                >
                                                    {record.message}
                                                </Typography.Paragraph>
                                            ),
                                        }}
                                        columns={[
                                            { title: _("Row"), dataIndex: "row", width: 80 },
                                            { title: _("Error"), dataIndex: "message", ellipsis: true },
                                        ]}
                                    />
                                )}
                                {!!preview.sample_rows?.length && (
                                    <>
                                        <Typography.Text style={{ display: "block", marginTop: 12 }}>
                                            {_("Sample of rows that will be loaded")} ({preview.sample_rows.length}/{preview.inserted + preview.updated})
                                        </Typography.Text>
                                        <SampleRowsTable rows={preview.sample_rows} />
                                    </>
                                )}
                            </>
                        }
                    />
                )}

                {!confirmed && showUpsell && (
                    <div
                        style={{
                            fontSize: 12,
                            color: "#888",
                            background: "rgba(128,128,128,0.06)",
                            padding: "6px 10px",
                            borderRadius: 4,
                        }}
                    >
                        {_("Validation error, or custom/messy headers?")}{" "}
                        {_("Need AI column mapping, foreign key resolution, or bulk loads over 1,000 rows?")}
                        {" "}
                        <Typography.Link
                            style={{ fontSize: 12 }}
                            href={
                                isSmartTierInstalled
                                    ? `/data-import-export?model=${encodeURIComponent(resourcePath)}`
                                    : "https://www.juicemantics.com/iqvigilant"
                            }
                            target={isSmartTierInstalled ? undefined : "_blank"}
                            rel={isSmartTierInstalled ? undefined : "noreferrer"}
                        >
                            {_("Open in IQVigilant Workbench →")}
                        </Typography.Link>
                    </div>
                )}

                <Space>
                    {!confirmed && (
                        <Button
                            type="default"
                            icon={<UploadOutlined />}
                            disabled={!file || busy}
                            loading={busy && !preview}
                            onClick={handlePreview}
                        >
                            {_("Preview")}
                        </Button>
                    )}
                    {!confirmed && preview && (
                        <Button
                            type="primary"
                            disabled={busy}
                            loading={busy}
                            onClick={handleConfirm}
                        >
                            {_("Confirm import")}
                        </Button>
                    )}
                    {confirmed && (
                        <Button type="primary" onClick={handleClose}>
                            {_("Close")}
                        </Button>
                    )}
                </Space>
            </Space>
        </Modal>
    );
};

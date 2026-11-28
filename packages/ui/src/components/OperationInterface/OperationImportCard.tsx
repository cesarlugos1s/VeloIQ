/**
 * Import operations: an OpenAPI description (an address or an uploaded JSON or YAML file) or, when the content is not a
 * description, the address of one endpoint. One operation is handed to `onSingleOperation` (to fill a form); several are listed,
 * and the selected ones are handed one by one to `onImportOperation`. Taken from IQVigilant's API tool page.
 */
import React, { useMemo, useState } from "react";
import { Alert, Button, Card, Col, Form, Input, Row, Space, Typography, Upload, message } from "antd";
import { ImportOutlined, SearchOutlined, UploadOutlined } from "@ant-design/icons";
import { useInvalidate } from "@refinedev/core";
import { DynamicList } from "../DynamicResource";
import type { BulkActionDef, ModelDef } from "../DynamicResource/types";
import { useInPageRowsStore } from "../../hooks/useInPageRowsStore";
import type { DiscoveredOperation, OperationInterfaceClient } from "./operationInterfaceTypes";

// Resolved when called (not when the file loads), so the host's translations are always the current ones.
const _ = (text: string): string => {
    const translate = (window as any)._;
    return typeof translate === "function" ? (translate(text) as string) : text;
};

/** The operations a description offers, as rows that exist only in this page. */
const DISCOVERED_OPERATIONS_MODEL: Omit<ModelDef, "resource"> = {
    name: "DiscoveredOperation",
    label: "Operations",
    capabilities: { create: false, update: false, delete: false },
    fields: [
        { key: "http_method", label: "Method", type: "string", readOnly: true },
        { key: "path", label: "Path", type: "string", readOnly: true },
        { key: "summary", label: "Summary", type: "string", readOnly: true },
        { key: "base_url", label: "Base URL", type: "string", readOnly: true },
        { key: "response_type", label: "Response Type", type: "string", readOnly: true },
    ],
};

export interface OperationImportCardProps {
    client: OperationInterfaceClient;
    /** A single endpoint (or a one-operation description) is discovered: fill the form with it. */
    onSingleOperation: (operation: DiscoveredOperation) => void;
    /** Record one selected operation; `values` holds the base address and the extra fields. Throw to report a failure. */
    onImportOperation: (operation: DiscoveredOperation, values: Record<string, string>) => Promise<void>;
    /** Extra text fields asked once for the selected operations (for example the module of an API tool). */
    extraFields?: { key: string; label: string }[];
    /** Resource whose lists are refreshed after the import (for example the API tools list). */
    refreshResource?: string;
    /** Resource to store the listed operations under; unique per page. */
    storeName?: string;
}

export const OperationImportCard: React.FC<OperationImportCardProps> = ({
    client, onSingleOperation, onImportOperation, extraFields = [], refreshResource, storeName = "discovered_operations",
}) => {
    const invalidate = useInvalidate();
    const [specUrl, setSpecUrl] = useState("");
    const [specFile, setSpecFile] = useState<File | null>(null);
    const [discovering, setDiscovering] = useState(false);
    const [specWarnings, setSpecWarnings] = useState<string[]>([]);
    const [importBaseUrl, setImportBaseUrl] = useState("");
    const [extraValues, setExtraValues] = useState<Record<string, string>>({});
    const [operationsFound, setOperationsFound] = useState(0);
    const discovered = useInPageRowsStore(storeName, DISCOVERED_OPERATIONS_MODEL);

    const handleDiscover = async () => {
        if (!specUrl.trim() && !specFile) {
            message.warning(_("Provide a spec URL or upload a JSON/YAML file"));
            return;
        }
        setDiscovering(true);
        setSpecWarnings([]);
        try {
            const { operations, warnings } = await client.discoverOperations({ address: specUrl.trim() || undefined, file: specFile });
            setSpecWarnings(warnings || []);
            if (operations.length === 1) {
                // A single endpoint (discovery, or a one-operation description) fills the form.
                discovered.setRows([]);
                setOperationsFound(0);
                onSingleOperation(operations[0]);
                message.success(_("Discovery completed"));
                return;
            }
            discovered.setRows(operations.map((operation, index) => ({ ...operation, eid: String(index + 1) })));
            setOperationsFound(operations.length);
            setImportBaseUrl(operations[0]?.base_url || "");
            if (operations.length === 0) message.warning(_("No operations found"));
        } catch (error: any) {
            message.error(error?.message || _("Import failed"));
        } finally {
            setDiscovering(false);
        }
    };

    const importBulkActions: BulkActionDef[] = useMemo(() => [{
        key: "import_discovered_operations",
        label: _("Import Selected"),
        icon: <ImportOutlined />,
        onExecuteOne: async (operation: any) => {
            await onImportOperation({ ...operation, base_url: importBaseUrl.trim() || operation.base_url || "" }, { base_url: importBaseUrl.trim(), ...extraValues });
            if (refreshResource) void invalidate({ resource: refreshResource, invalidates: ["list", "many"] });
        },
    }], [importBaseUrl, extraValues, onImportOperation, refreshResource, invalidate]);

    return (
        <Card size="small" title={<Space><ImportOutlined /><span>{_("Import from OpenAPI Spec")}</span></Space>} style={{ marginBottom: 16 }}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
                {_("Provide an OpenAPI 3.0/3.1 spec URL or upload a JSON/YAML spec file to import its operations. If the content isn't a recognized spec, it falls back to single-endpoint Auto-Discover.")}
            </Typography.Paragraph>
            <Row gutter={[16, 16]} align="bottom">
                <Col flex="auto">
                    <Form.Item label={_("Spec URL or Endpoint URL")} help={_("e.g. https://api.example.com/openapi.json, or a single endpoint URL")} style={{ marginBottom: 0 }}>
                        <Input value={specUrl} onChange={(event) => setSpecUrl(event.target.value)} placeholder="https://api.example.com/openapi.json" />
                    </Form.Item>
                </Col>
                <Col>
                    <Upload accept=".json,.yaml,.yml" maxCount={1}
                            fileList={specFile ? [{ uid: "-1", name: specFile.name, status: "done" as const }] : []}
                            beforeUpload={(file) => { setSpecFile(file); return false; }}
                            onRemove={() => setSpecFile(null)}>
                        <Button icon={<UploadOutlined />}>{_("Upload Spec File")}</Button>
                    </Upload>
                </Col>
                <Col>
                    <Button type="primary" icon={<SearchOutlined />} loading={discovering} onClick={handleDiscover}>{_("Discover / Import")}</Button>
                </Col>
            </Row>
            {specWarnings.length > 0 && (
                <Alert type="warning" showIcon style={{ marginTop: 16 }} message={_("Some sections could not be parsed")}
                       description={<ul style={{ margin: 0, paddingLeft: 20 }}>{specWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>} />
            )}
            {operationsFound > 1 && (
                <>
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24} md={12}>
                            <Form.Item label={_("Base URL for Selected")} style={{ marginBottom: 8 }}>
                                <Input value={importBaseUrl} onChange={(event) => setImportBaseUrl(event.target.value)} placeholder="https://api.example.com" />
                            </Form.Item>
                        </Col>
                        {extraFields.map((field) => (
                            <Col xs={24} md={12} key={field.key}>
                                <Form.Item label={_(field.label)} style={{ marginBottom: 8 }}>
                                    <Input value={extraValues[field.key] || ""} onChange={(event) => setExtraValues({ ...extraValues, [field.key]: event.target.value })} />
                                </Form.Item>
                            </Col>
                        ))}
                    </Row>
                    <DynamicList key={discovered.model.resource} model={discovered.model} isEmbedded={true} showCreate={false} showActions={false} bulkActions={importBulkActions} />
                </>
            )}
        </Card>
    );
};

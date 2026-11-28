/**
 * "Test API": sends an operation for real and shows what came back.
 *
 * A POST, PUT, PATCH or DELETE call is first shown as a "Mutating Request" warning and is sent only when the user
 * chooses "Send Anyway"; the result then says that data may have been changed. Taken from IQVigilant's API tool page.
 * `OperationTestWindow` is the window itself (controlled, for a page that tests from a row); `OperationTestButton` is the button that runs a
 * test and opens it.
 */
import React, { useState } from "react";
import { Alert, Badge, Button, Collapse, Descriptions, Modal, Space, Tag, Typography, message } from "antd";
import { ApiOutlined, PlayCircleOutlined } from "@ant-design/icons";
import type { OperationCall, OperationInterfaceClient, OperationTestResult } from "./operationInterfaceTypes";

// Resolved when called (not when the file loads), so the host's translations are always the current ones.
const _ = (text: string): string => {
    const translate = (window as any)._;
    return typeof translate === "function" ? (translate(text) as string) : text;
};

const { Text } = Typography;

/** The window that shows a test: the confirmation of a write call, or the result, with the offer to record the output as the schema. */
export const OperationTestWindow: React.FC<{
    result: OperationTestResult | null;
    onClose: () => void;
    /** Send the call again with the confirmation of a write method. */
    onConfirm: () => void;
    /** When given, a successful test with a JSON answer offers to record its structure as the output of the operation. */
    onRecordOutput?: (result: OperationTestResult) => Promise<void>;
}> = ({ result, onClose, onConfirm, onRecordOutput }) => {
    const [recording, setRecording] = useState(false);
    const canRecordOutput = Boolean(onRecordOutput && result?.status === "success" && result.body_parsed);
    const footer = result?.status === "warning"
        ? [
            <Button key="cancel" onClick={onClose}>{_("Cancel")}</Button>,
            <Button key="confirm" type="primary" danger onClick={() => { onClose(); onConfirm(); }}>{_("Send Anyway")}</Button>,
        ]
        : [
            ...(canRecordOutput ? [<Button key="record" loading={recording} onClick={async () => {
                setRecording(true);
                try { await onRecordOutput!(result!); message.success(_("The output structure was recorded.")); } catch (problem: any) { message.error(problem?.message || _("The output structure could not be recorded.")); } finally { setRecording(false); }
            }}>{_("Record the output structure")}</Button>] : []),
            <Button key="close" type="primary" onClick={onClose}>{_("Close")}</Button>,
        ];
    return (
        <Modal title={<Space><ApiOutlined />{_("API Test Result")}</Space>} open={result !== null} onCancel={onClose} width={780} footer={footer}>
            {result?.status === "warning" ? (
                <Alert type="warning" showIcon message={_("Mutating Request")}
                       description={<pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13 }}>{result.warning}</pre>} />
            ) : result ? (
                <>
                    <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                        <Descriptions.Item label={_("URL")} span={2}><Text code style={{ wordBreak: "break-all" }}>{result.url}</Text></Descriptions.Item>
                        <Descriptions.Item label={_("HTTP Status")}>
                            {result.http_status != null
                                ? <Badge status={result.http_status < 400 ? "success" : "error"} text={<Text strong>{result.http_status}</Text>} />
                                : <Tag color="default">—</Tag>}
                        </Descriptions.Item>
                        <Descriptions.Item label={_("Duration")}><Text>{result.duration_ms} ms</Text></Descriptions.Item>
                        <Descriptions.Item label={_("Status")}><Tag color={result.status === "success" ? "green" : "red"}>{result.status}</Tag></Descriptions.Item>
                        <Descriptions.Item label={_("Content-Type")}><Text code>{result.headers?.["content-type"] || result.headers?.["Content-Type"] || "—"}</Text></Descriptions.Item>
                    </Descriptions>
                    {result.warning && <Alert type="warning" showIcon message={_("Note")} description={result.warning} style={{ marginBottom: 16 }} />}
                    {result.error && (
                        <Alert type="error" showIcon message={_("Error")} style={{ marginBottom: 16 }}
                               description={<pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{result.error}</pre>} />
                    )}
                    {(result.body_parsed || result.body) && (
                        <Collapse defaultActiveKey={["body"]} items={[{
                            key: "body",
                            label: _("Response Body"),
                            children: (
                                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 400, overflow: "auto", padding: 12, borderRadius: 4,
                                              fontSize: 12, fontFamily: "monospace", margin: 0 }}>
                                    {result.body_parsed ? JSON.stringify(result.body_parsed, null, 2) : result.body}
                                </pre>
                            ),
                        }]} />
                    )}
                </>
            ) : null}
        </Modal>
    );
};

export const OperationTestButton: React.FC<{
    /** Returns the call to test (the form's current values and the parameters), or undefined when there is none yet. */
    readCall: () => Promise<OperationCall | undefined>;
    client: OperationInterfaceClient;
    onRecordOutput?: (result: OperationTestResult) => Promise<void>;
}> = ({ readCall, client, onRecordOutput }) => {
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<OperationTestResult | null>(null);

    const runTest = async (confirmed: boolean) => {
        setTesting(true);
        try {
            const call = await readCall();
            if (!call?.path) {
                message.warning(_("API URL is required"));
                return;
            }
            setTestResult(await client.testOperation(call, confirmed));
        } catch (error: any) {
            setTestResult({ status: "error", error: error?.message || _("Test request failed") });
        } finally {
            setTesting(false);
        }
    };

    return (
        <>
            <Button icon={<PlayCircleOutlined />} loading={testing} onClick={() => runTest(false)}>{_("Test API")}</Button>
            <OperationTestWindow result={testResult} onClose={() => setTestResult(null)} onConfirm={() => void runTest(true)} onRecordOutput={onRecordOutput} />
        </>
    );
};

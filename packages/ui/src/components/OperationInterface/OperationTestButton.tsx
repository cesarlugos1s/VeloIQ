/**
 * "Test API": sends an operation for real and shows what came back.
 *
 * A POST, PUT, PATCH or DELETE call is first shown as a "Mutating Request" warning and is sent only when the user
 * chooses "Send Anyway"; the result then says that data may have been changed. Taken from IQVigilant's API tool page.
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

export const OperationTestButton: React.FC<{
    /** Returns the call to test (the form's current values and the parameters), or undefined when there is none yet. */
    readCall: () => Promise<OperationCall | undefined>;
    client: OperationInterfaceClient;
}> = ({ readCall, client }) => {
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<OperationTestResult | null>(null);
    const [resultOpen, setResultOpen] = useState(false);

    const runTest = async (confirmed: boolean) => {
        setTesting(true);
        try {
            const call = await readCall();
            if (!call?.path) {
                message.warning(_("API URL is required"));
                return;
            }
            setTestResult(await client.testOperation(call, confirmed));
            setResultOpen(true);
        } catch (error: any) {
            setTestResult({ status: "error", error: error?.message || _("Test request failed") });
            setResultOpen(true);
        } finally {
            setTesting(false);
        }
    };

    return (
        <>
            <Button icon={<PlayCircleOutlined />} loading={testing} onClick={() => runTest(false)}>{_("Test API")}</Button>
            <Modal
                title={<Space><ApiOutlined />{_("API Test Result")}</Space>}
                open={resultOpen}
                onCancel={() => setResultOpen(false)}
                width={780}
                footer={testResult?.status === "warning"
                    ? [
                        <Button key="cancel" onClick={() => setResultOpen(false)}>{_("Cancel")}</Button>,
                        <Button key="confirm" type="primary" danger onClick={() => { setResultOpen(false); void runTest(true); }}>{_("Send Anyway")}</Button>,
                    ]
                    : [<Button key="close" type="primary" onClick={() => setResultOpen(false)}>{_("Close")}</Button>]}
            >
                {testResult?.status === "warning" ? (
                    <Alert type="warning" showIcon message={_("Mutating Request")}
                           description={<pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13 }}>{testResult.warning}</pre>} />
                ) : testResult ? (
                    <>
                        <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                            <Descriptions.Item label={_("URL")} span={2}><Text code style={{ wordBreak: "break-all" }}>{testResult.url}</Text></Descriptions.Item>
                            <Descriptions.Item label={_("HTTP Status")}>
                                {testResult.http_status != null
                                    ? <Badge status={testResult.http_status < 400 ? "success" : "error"} text={<Text strong>{testResult.http_status}</Text>} />
                                    : <Tag color="default">—</Tag>}
                            </Descriptions.Item>
                            <Descriptions.Item label={_("Duration")}><Text>{testResult.duration_ms} ms</Text></Descriptions.Item>
                            <Descriptions.Item label={_("Status")}><Tag color={testResult.status === "success" ? "green" : "red"}>{testResult.status}</Tag></Descriptions.Item>
                            <Descriptions.Item label={_("Content-Type")}><Text code>{testResult.headers?.["content-type"] || testResult.headers?.["Content-Type"] || "—"}</Text></Descriptions.Item>
                        </Descriptions>
                        {testResult.warning && <Alert type="warning" showIcon message={_("Note")} description={testResult.warning} style={{ marginBottom: 16 }} />}
                        {testResult.error && (
                            <Alert type="error" showIcon message={_("Error")} style={{ marginBottom: 16 }}
                                   description={<pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{testResult.error}</pre>} />
                        )}
                        {(testResult.body_parsed || testResult.body) && (
                            <Collapse defaultActiveKey={["body"]} items={[{
                                key: "body",
                                label: _("Response Body"),
                                children: (
                                    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 400, overflow: "auto", padding: 12, borderRadius: 4,
                                                  fontSize: 12, fontFamily: "monospace", margin: 0 }}>
                                        {testResult.body_parsed ? JSON.stringify(testResult.body_parsed, null, 2) : testResult.body}
                                    </pre>
                                ),
                            }]} />
                        )}
                    </>
                ) : null}
            </Modal>
        </>
    );
};

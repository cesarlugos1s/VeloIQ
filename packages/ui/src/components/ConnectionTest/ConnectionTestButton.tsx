/**
 * "Test Connection": runs a test and shows the result in a window, laid out as IQVigilant's database connection test is: a success or
 * failure alert (the failure with its message), then the facts of the test. Taken from IQVigilant's DbConnector page; the facts are given
 * by the test, so a REST connection, and later a database connection, use the same window.
 */
import React, { useState } from "react";
import { Alert, Badge, Button, Descriptions, Modal, Space, Typography } from "antd";
import { ApiOutlined } from "@ant-design/icons";
import type { ConnectionTestResult } from "./connectionTestTypes";

// Resolved when called (not when the file loads), so the host's translations are always the current ones.
const _ = (text: string): string => {
    const translate = (window as any)._;
    return typeof translate === "function" ? (translate(text) as string) : text;
};

const { Text } = Typography;

export const ConnectionTestButton: React.FC<{ runTest: () => Promise<ConnectionTestResult>; disabled?: boolean }> = ({ runTest, disabled }) => {
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState<ConnectionTestResult | null>(null);

    const handleTest = async () => {
        setTesting(true);
        try {
            setResult(await runTest());
        } catch (problem: any) {
            setResult({ status: "error", error_type: "Error", error_message: problem?.message || _("Test request failed"), details: [] });
        } finally {
            setTesting(false);
        }
    };

    const isSuccess = result?.status === "success";
    return (
        <>
            <Button icon={<ApiOutlined />} onClick={handleTest} loading={testing} disabled={disabled}>{_("Test Connection")}</Button>
            <Modal title={<Space><ApiOutlined />{_("Test Connection")}</Space>} open={result !== null} onCancel={() => setResult(null)} width={640}
                   footer={[<Button key="close" type="primary" onClick={() => setResult(null)}>{_("Close")}</Button>]}>
                {result && (
                    <div>
                        {isSuccess ? (
                            <Alert type="success" showIcon message={_("Connection successful")} description={result.note || undefined} style={{ marginBottom: 16 }} />
                        ) : (
                            <Alert type="error" showIcon message={_("Connection failed")} style={{ marginBottom: 16 }}
                                   description={<pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{result.error_message || ""}</pre>} />
                        )}
                        <Descriptions bordered size="small" column={2}>
                            {result.details.map((detail) => (
                                <Descriptions.Item key={detail.label} label={_(detail.label)}><Text code>{detail.value}</Text></Descriptions.Item>
                            ))}
                            <Descriptions.Item label={_("Status")}>
                                <Badge status={isSuccess ? "success" : "error"} text={<Text strong>{isSuccess ? _("Success") : result.error_type || _("Error")}</Text>} />
                            </Descriptions.Item>
                            <Descriptions.Item label={_("Response Time")}><Text>{result.duration_ms != null ? `${result.duration_ms} ms` : "—"}</Text></Descriptions.Item>
                        </Descriptions>
                    </div>
                )}
            </Modal>
        </>
    );
};

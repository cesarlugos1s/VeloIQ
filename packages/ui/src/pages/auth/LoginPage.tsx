import React from "react";
import { useLogin } from "@refinedev/core";
import { Button, Card, Form, Input, Typography, Alert, Space } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export interface LoginPageProps {
    /** App title shown on the login card. Defaults to "VeloIQ". */
    appTitle?: string;
    /** Logo element or image URL shown above the title. */
    logo?: React.ReactNode | string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ appTitle = "VeloIQ", logo }) => {
    const { mutate: login, isLoading, error } = useLogin();
    const [form] = Form.useForm();

    const onFinish = (values: { username: string; password: string }) => {
        login(values);
    };

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "100vh",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            }}
        >
            <Card
                style={{
                    width: 400,
                    borderRadius: 12,
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
                }}
            >
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                    <div style={{ textAlign: "center" }}>
                        {logo && (
                            <div style={{ marginBottom: 8 }}>
                                {typeof logo === "string"
                                    ? <img src={logo} alt={appTitle} style={{ height: 48, width: "auto" }} />
                                    : logo}
                            </div>
                        )}
                        <Typography.Title level={3} style={{ marginBottom: 4 }}>
                            {appTitle}
                        </Typography.Title>
                        <Typography.Text type="secondary">
                            {_("Sign in to your account")}
                        </Typography.Text>
                    </div>

                    {error && (
                        <Alert
                            type="error"
                            message={(error as any)?.name || _("Login failed")}
                            description={(error as any)?.message || _("Invalid credentials")}
                            showIcon
                        />
                    )}

                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={onFinish}
                        autoComplete="off"
                    >
                        <Form.Item
                            name="username"
                            label={_("Username")}
                            rules={[{ required: true, message: _("Please enter your username") }]}
                        >
                            <Input
                                prefix={<UserOutlined />}
                                placeholder={_("Username")}
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            label={_("Password")}
                            rules={[{ required: true, message: _("Please enter your password") }]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder={_("Password")}
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item style={{ marginBottom: 0 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={isLoading}
                                block
                                size="large"
                            >
                                {_("Login")}
                            </Button>
                        </Form.Item>
                    </Form>
                </Space>
            </Card>
        </div>
    );
};

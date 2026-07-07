import React from "react";
import { Result, Button, Spin } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useLicensePool } from "../hooks/useLicensePool";

// i18n helper — resolved at CALL time so window._ is always current.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

/**
 * License-gated route wrapper.
 *
 * When ``module`` is set and that module is not licensed, the component
 * renders a "not licensed" placeholder instead of ``children``.
 * When ``module`` is omitted or the module is licensed, ``children``
 * are rendered normally — fully backwards compatible with routes that
 * do not declare a license dependency.
 */
export const LicenseGate: React.FC<{
    module?: string;
    children: React.ReactNode;
}> = ({ module: moduleName, children }) => {
    const navigate = useNavigate();
    const { isModuleLicensed, loading } = useLicensePool();

    if (!moduleName) return <>{children}</>;
    if (loading) return <div style={{ padding: 48, textAlign: "center" }}><Spin size="large" /></div>;
    if (isModuleLicensed(moduleName)) return <>{children}</>;

    return (
        <Result
            status="warning"
            icon={<LockOutlined />}
            title={_("Module Not Licensed")}
            subTitle={_(
                `This page requires a license for the "${moduleName}" module. Please contact your administrator to obtain a license key.`,
            )}
            extra={
                <Button type="primary" onClick={() => navigate("/dashboard")}>
                    {_("Go to Dashboard")}
                </Button>
            }
        />
    );
};
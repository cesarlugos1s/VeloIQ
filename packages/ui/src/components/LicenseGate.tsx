import React from "react";
import { Result, Button, Spin } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAccess } from "../hooks/useAccess";
import { NoAccessResult } from "./AccessGate";

// i18n helper — resolved at CALL time so window._ is always current.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

/**
 * Access-gated route wrapper for module pages.
 *
 * When ``module`` is set, the page needs Read on that module through the
 * shared access check (licensing, role methods, access policies). An
 * unlicensed module shows the "not licensed" placeholder; a module the user's
 * role may not read shows the "no access" page. When ``module`` is omitted,
 * ``children`` render normally — backwards compatible with routes that
 * declare no module.
 */
export const LicenseGate: React.FC<{
    module?: string;
    children: React.ReactNode;
}> = ({ module: moduleName, children }) => {
    const navigate = useNavigate();
    const { isModuleLicensed, canModule, loading } = useAccess();

    if (!moduleName) return <>{children}</>;
    if (loading) return <div style={{ padding: 48, textAlign: "center" }}><Spin size="large" /></div>;
    if (isModuleLicensed(moduleName)) {
        return canModule(moduleName, "read") ? <>{children}</> : <NoAccessResult />;
    }

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
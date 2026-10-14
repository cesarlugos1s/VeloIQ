import React from "react";
import { Button, Result } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAccess } from "../hooks/useAccess";
import type { AccessAction } from "../access/evaluateAccess";

// i18n helper — resolved at CALL time so window._ is always current.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

/**
 * The "no access" page shown when the user opens a page they can't use
 * (AC-E3). Same layout as the "not licensed" page in LicenseGate; the text
 * names neither the role nor the policy.
 */
export const NoAccessResult: React.FC = () => {
    const navigate = useNavigate();
    return (
        <Result
            status="warning"
            icon={<LockOutlined />}
            title={_("No Access")}
            subTitle={_("You do not have permission to open this page. Please contact your administrator.")}
            extra={
                <Button type="primary" onClick={() => navigate("/dashboard")}>
                    {_("Go to Dashboard")}
                </Button>
            }
        />
    );
};

/**
 * Render `children` only when the user may perform `action` on `resource`
 * (a Refine resource / table name); otherwise render the "no access" page.
 * Used by the Dynamic list/show/create/edit pages, so a denied page opened by
 * URL never renders a broken list.
 */
export const ResourceAccessGate: React.FC<{
    resource: string;
    action: AccessAction;
    children: React.ReactNode;
    /** Embedded views render nothing instead of the full-page message. */
    embedded?: boolean;
}> = ({ resource, action, children, embedded = false }) => {
    const { can } = useAccess();
    if (can(resource, action)) return <>{children}</>;
    return embedded ? null : <NoAccessResult />;
};

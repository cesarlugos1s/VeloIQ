import React from "react";
import { Navigate } from "react-router-dom";
import { Spin } from "antd";
import { useDashboardConfig } from "./hooks/useDashboardConfig";

interface LandingRedirectProps {
    /** Route to land on when the Dashboard has no cells configured in any tab. */
    fallbackPath: string;
}

/**
 * Decides the app's "/" landing page: the Dashboard if at least one of its
 * tabs has cells configured, otherwise `fallbackPath` (the first model page
 * in the first module shown in the menu).
 */
export const LandingRedirect: React.FC<LandingRedirectProps> = ({ fallbackPath }) => {
    const { config, enabled, loading } = useDashboardConfig();

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
                <Spin size="large" />
            </div>
        );
    }

    const hasCells = enabled && !!config?.tabs?.some((tab) => tab.cells.length > 0);
    return <Navigate to={hasCells ? "/dashboard" : fallbackPath} replace />;
};

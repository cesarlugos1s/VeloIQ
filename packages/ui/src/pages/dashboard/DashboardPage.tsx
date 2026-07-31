import React from "react";
import { Tabs, Spin, Empty, Typography, theme } from "antd";
import { DashboardOutlined } from "@ant-design/icons";
import { useAllModels } from "../../contexts/AllModelsContext";
import { useDashboardConfig } from "./hooks/useDashboardConfig";
import { ViewsGrid } from "./ViewsGrid";
import { RecentActivityPanel } from "./RecentActivityPanel";
import { PinnedRecordsPanel } from "./PinnedRecordsPanel";
import { useSetHelpPageKey } from "../../contexts/HelpContext";
import { DASHBOARD_MAIN_PAGE_KEY } from "../../components/Help/HelpButton";

const { Text } = Typography;

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const ComingSoon: React.FC<{ label: string }> = ({ label }) => (
    <div style={{ padding: 48, textAlign: "center" }}>
        <Text type="secondary">{label} — coming soon.</Text>
    </div>
);

interface DashboardPageProps {
    /** Extension point (see list_header_button_components in the VeloIQ
     * extension manifest contract): rendered inside each Models-Grid tab's
     * model-backed cell toolbar. */
    cellExtraActions?: (resource: string, model: any, allModels: any[]) => React.ReactNode;
    /** Extension point (see dashboard_tab_header_components in the VeloIQ
     * extension manifest contract): rendered next to each tab's name. */
    tabExtraActions?: (tab: any, allModels: any[]) => React.ReactNode;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ cellExtraActions, tabExtraActions }) => {
    useSetHelpPageKey(DASHBOARD_MAIN_PAGE_KEY);
    const { token } = theme.useToken();
    const allModels = useAllModels();
    const { config, enabled, loading, save } = useDashboardConfig();

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
                <Spin />
            </div>
        );
    }

    if (!enabled || !config) {
        return (
            <div style={{ padding: 48 }}>
                <Empty
                    image={<DashboardOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />}
                    imageStyle={{ height: 60 }}
                    description={
                        <span>
                            No dashboard configured.<br />
                            <Text type="secondary">Run <code>veloiq add-dashboard &lt;model&gt; …</code> to get started.</Text>
                        </span>
                    }
                />
            </div>
        );
    }

    const tabs = [
        {
            key: "models_grid",
            label: _("Models Grid"),
            children: (
                <div style={{ height: "calc(100vh - 140px)", overflow: "auto" }}>
                    <ViewsGrid
                        config={config}
                        allModels={allModels}
                        onConfigChange={save}
                        cellExtraActions={cellExtraActions}
                        tabExtraActions={tabExtraActions}
                    />
                </div>
            ),
        },
        {
            key: "recent_activity",
            label: _("Recent Activity"),
            children: (
                <div style={{ height: "calc(100vh - 140px)", overflow: "auto", padding: "0 12px" }}>
                    <RecentActivityPanel />
                </div>
            ),
        },
        {
            key: "pinned_records",
            label: _("Pinned Records"),
            children: (
                <div style={{ height: "calc(100vh - 140px)", overflow: "auto", padding: "0 12px" }}>
                    <PinnedRecordsPanel />
                </div>
            ),
        },
    ];

    return (
        <div style={{ padding: "0 16px", height: "100%" }}>
            <Tabs
                items={tabs}
                tabBarStyle={{ marginBottom: 0 }}
            />
        </div>
    );
};

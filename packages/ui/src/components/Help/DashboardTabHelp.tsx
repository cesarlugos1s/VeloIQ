import React, { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCan } from "@refinedev/core";
import { Button, Popover, Skeleton, Empty } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useHelpContent } from "./useHelpContent";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

// Same lazy-import pattern as HelpDrawer.tsx / renderFieldValue.tsx.
const ReactMarkdown = lazy(() => import("react-markdown").then((m) => ({ default: m.default })));

export interface DashboardTabHelpProps {
    tabId: string;
}

/**
 * Small anchored Popover with curated help for one Dashboard tab. Every
 * tab's label row mounts concurrently (antd Tabs renders all labels
 * regardless of which tab is active), so — same reasoning as
 * DashboardCellHelp — this can't go through the shared HelpContext/HelpDrawer.
 *
 * Unlike List/Show/Edit/Create and dashboard-cell, tab docs are NOT
 * auto-seeded: tabs are an arbitrary frontend-only grouping the backend has
 * no way to enumerate, so this always starts at the no-content fallback
 * until an author writes one for this specific tab id.
 */
export const DashboardTabHelp: React.FC<DashboardTabHelpProps> = ({ tabId }) => {
    const navigate = useNavigate();
    const pageKey = `dashboard-tab:${tabId}`;
    const { loading, doc, fetchContent } = useHelpContent(pageKey);
    const [open, setOpen] = useState(false);
    const { data: canCreateHelpDoc } = useCan({ resource: "veloiq_help_document", action: "create" });

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) fetchContent();
    };

    const content = (
        <div style={{ width: 280 }}>
            {loading && <Skeleton active paragraph={{ rows: 2 }} />}
            {!loading && doc?.found && (
                <Suspense fallback={<Skeleton active paragraph={{ rows: 2 }} />}>
                    <ReactMarkdown>{doc.body || ""}</ReactMarkdown>
                </Suspense>
            )}
            {!loading && doc && !doc.found && (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={_("No help written for this tab yet.")}
                >
                    {canCreateHelpDoc?.can !== false && (
                        <Button
                            type="link"
                            size="small"
                            onClick={() => navigate(`/veloiq_help_document/create?page_key=${encodeURIComponent(pageKey)}`)}
                        >
                            {_("Write help for this")}
                        </Button>
                    )}
                </Empty>
            )}
        </div>
    );

    return (
        <Popover
            open={open}
            onOpenChange={handleOpenChange}
            trigger="click"
            placement="bottomRight"
            content={content}
        >
            <Button
                type="text" size="small"
                icon={<QuestionCircleOutlined style={{ fontSize: 11 }} />}
                aria-label={_("Dashboard tab help")}
                title={_("Dashboard tab help")}
                onClick={(e) => e.stopPropagation()}
                style={{ padding: "0 2px", height: 18, minWidth: 18 }}
            />
        </Popover>
    );
};

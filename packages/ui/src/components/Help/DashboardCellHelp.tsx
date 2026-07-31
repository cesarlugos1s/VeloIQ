import React, { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCan } from "@refinedev/core";
import { Button, Popover, Skeleton, Empty, theme } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useHelpContent } from "./useHelpContent";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

// Same lazy-import pattern as HelpDrawer.tsx / renderFieldValue.tsx.
const ReactMarkdown = lazy(() => import("react-markdown").then((m) => ({ default: m.default })));

export interface DashboardCellHelpProps {
    resource: string;
}

/**
 * Small anchored Popover (not the shared HelpDrawer) with curated help for
 * one Dashboard cell. Popover, not a docked panel, because many cells render
 * concurrently in a toolbar only ~28px tall — the same constraint that made
 * the framework's "suggest me what to ask" feature use a Popover in the
 * first place. Content-only this pass — no action buttons (see Phase-2 plan:
 * cells share one page URL, so a ?param=1-style action can't target one
 * specific cell unambiguously).
 */
export const DashboardCellHelp: React.FC<DashboardCellHelpProps> = ({ resource }) => {
    const { token } = theme.useToken();
    const navigate = useNavigate();
    const pageKey = `${resource}:dashboard-cell`;
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
                    description={_("No help written for this cell yet.")}
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
                aria-label={_("Dashboard cell help")}
                title={_("Dashboard cell help")}
                style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
            />
        </Popover>
    );
};

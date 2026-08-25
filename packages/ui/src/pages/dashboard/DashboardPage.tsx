import React, { useEffect, useRef, useState } from "react";
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

    // Each sub-tab's content area used to be pinned to a hardcoded
    // calc(100vh - 140px), which assumes a fixed height for everything
    // above it (the app shell's own header plus this page's own tab bar).
    // That 140px was already wrong by ~30px in practice, and any future
    // change to either chrome's height (as just happened when the
    // dashboard cell-size slider moved in and out of ViewsGrid's own tab
    // row) silently drifts it further — leaving a dead strip of unusable
    // space at the bottom of the page that features like the cell-size
    // slider's "Fit page" step can never reach, since filling it would
    // just overflow this wrapper and reintroduce a page-level scrollbar.
    // Measuring the real rendered chrome height instead keeps this correct
    // regardless of what that chrome contains or how it changes over time.
    // Attached directly to the "Models Grid" tab's own content div (the
    // first/default tab). Reconstructing "where content should start" from
    // the nav bar's own height/position (an earlier version of this fix)
    // kept undercounting antd's own internal Tabs spacing by a few dozen
    // pixels — measuring the content div's own rendered `top` sidesteps
    // that entirely: `top` is fixed by whatever sits above it in normal
    // flow (nav bar, wrapper padding, antd's internal spacing, whatever it
    // is) and is NOT affected by the `height` this same effect assigns to
    // that div below, so reading it back is safe and exact regardless of
    // what antd does internally or how that changes across versions.
    const contentRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState<number | null>(null);

    useEffect(() => {
        const contentEl = contentRef.current;
        if (!contentEl) return;

        const recompute = () => {
            const top = contentEl.getBoundingClientRect().top;

            // `window.innerHeight - top` alone assumes nothing else claims
            // space below this div before the viewport actually ends. That
            // held for everything DashboardPage itself renders (verified:
            // its own tab bar + grid land exactly on window.innerHeight),
            // but the surrounding app shell reserves more: Refine's
            // ThemedLayoutV2 wraps every page's content in
            // <AntdLayout.Content style={{ padding: isSmall ? 24 : 12 }}>,
            // and other chrome (e.g. an Exception Alerts banner reserving
            // its own space at the page bottom) can add more on top of
            // that. Rather than hardcode any one of those numbers — which
            // drift by breakpoint, by app, and by what banners happen to be
            // present — sum every ancestor's own padding-bottom/border-
            // bottom between this div and <body>, whatever they turn out
            // to be, and reserve that too.
            let reservedBelow = 0;
            let ancestor = contentEl.parentElement;
            while (ancestor && ancestor !== document.body) {
                const cs = window.getComputedStyle(ancestor);
                reservedBelow += parseFloat(cs.paddingBottom || "0") + parseFloat(cs.borderBottomWidth || "0");
                ancestor = ancestor.parentElement;
            }

            const available = window.innerHeight - top - reservedBelow;
            setContentHeight(Math.max(200, Math.floor(available)));
        };

        recompute();
        window.addEventListener("resize", recompute);
        return () => window.removeEventListener("resize", recompute);
        // Re-run once the loading/empty-state early returns below give way
        // to the real markup this ref is attached to — on first mount,
        // while `loading` is still true, this effect fires against a
        // `contentRef` that was never attached to anything (the loading
        // branch renders a totally different tree), so without these in
        // the dependency array this would never recompute again once the
        // real content actually appears.
    }, [loading, enabled, config]);

    // Falls back to the old fixed estimate only for the very first paint,
    // before the effect above has measured the real chrome height.
    const contentAreaStyle: React.CSSProperties = {
        height: contentHeight !== null ? `${contentHeight}px` : "calc(100vh - 140px)",
        overflow: "auto",
    };

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
                <div ref={contentRef} style={contentAreaStyle}>
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
                <div style={{ ...contentAreaStyle, padding: "0 12px" }}>
                    <RecentActivityPanel />
                </div>
            ),
        },
        {
            key: "pinned_records",
            label: _("Pinned Records"),
            children: (
                <div style={{ ...contentAreaStyle, padding: "0 12px" }}>
                    <PinnedRecordsPanel />
                </div>
            ),
        },
    ];

    return (
        // No horizontal padding here — Refine's ThemedLayoutV2 already wraps
        // every page (this one included) in its own
        // <AntdLayout.Content style={{ padding: isSmall ? 24 : 12 }}>, so an
        // extra "0 16px" here was pure duplication: it narrowed every cell's
        // usable width by 32px total for no reason, making it that much
        // easier for cell content (long chart labels, wide table columns) to
        // need its own horizontal scroll.
        <div style={{ height: "100%" }}>
            <Tabs
                items={tabs}
                tabBarStyle={{ marginBottom: 0 }}
            />
        </div>
    );
};

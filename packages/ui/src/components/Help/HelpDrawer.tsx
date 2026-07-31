import React, { lazy, Suspense, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApiUrl, useCan, useGo } from "@refinedev/core";
import { Drawer, Button, Skeleton, Empty, Typography, Space, Grid, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { HelpContext } from "../../contexts/HelpContext";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import { HELP_ACTION_CATALOG } from "./actionCatalog";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

// Same lazy-import pattern as renderFieldValue.tsx's "read-only-markdown"
// field type — the MarkdownEditor/renderer there are unexported locals, not
// part of the public component surface, so this replicates the pattern
// rather than importing them.
const ReactMarkdown = lazy(() => import("react-markdown").then((m) => ({ default: m.default })));

interface HelpDocResponse {
    found: boolean;
    title?: string;
    body?: string;
    actions?: { label: string; action_key: string }[];
}

export interface HelpDrawerProps {
    open: boolean;
    onClose: () => void;
    /**
     * Extension-contributed help blurbs, keyed by page type, threaded down
     * from the host app's generated extensions.gen.tsx (globalListHeaderButtonHelp /
     * globalShowHeaderButtonHelp) — appended below the page's own curated content.
     */
    helpButtonTexts?: { list?: (string | null)[]; show?: (string | null)[] };
}

export const HelpDrawer: React.FC<HelpDrawerProps> = ({ open, onClose, helpButtonTexts }) => {
    const { pageKey, recordId } = useContext(HelpContext);
    const location = useLocation();
    const navigate = useNavigate();
    const go = useGo();
    const apiUrl = useApiUrl();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;

    const [loading, setLoading] = useState(false);
    const [doc, setDoc] = useState<HelpDocResponse | null>(null);

    useEffect(() => {
        if (!open || !pageKey) return;
        let cancelled = false;
        setLoading(true);
        setDoc(null);
        authenticatedFetch(`${apiUrl}/help-documents/by-page/${encodeURIComponent(pageKey)}`)
            .then((res) => res.json())
            .then((data) => { if (!cancelled) setDoc(data); })
            .catch(() => { if (!cancelled) setDoc({ found: false }); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, pageKey, apiUrl]);

    // Gates the "Write help for this" fallback link — same useCan pattern
    // used throughout DynamicResource.
    const { data: canCreateHelpDoc } = useCan({ resource: "veloiq_help_document", action: "create" });

    const [resource, pageType] = pageKey ? pageKey.split(":") : ["", ""];

    const runAction = (actionKey: string) => {
        const entry = HELP_ACTION_CATALOG[actionKey];
        if (!entry) return;
        void entry.execute({
            resource,
            apiUrl,
            recordId,
            go,
            setSearchParam: (key, value) => {
                const params = new URLSearchParams(location.search);
                params.set(key, value);
                navigate({ pathname: location.pathname, search: params.toString() }, { replace: false });
            },
        });
    };

    const extraTexts = (pageType === "list" ? helpButtonTexts?.list
        : pageType === "show" ? helpButtonTexts?.show
        : undefined)?.filter((t): t is string => Boolean(t));

    return (
        <Drawer
            title={<Space><QuestionCircleOutlined /> {_("Help")}</Space>}
            placement="right"
            mask={false}
            open={open}
            onClose={onClose}
            width={isMobile ? "100%" : 420}
        >
            {loading && <Skeleton active />}

            {!loading && doc?.found && (
                <>
                    <Suspense fallback={<Skeleton active />}>
                        <ReactMarkdown>{doc.body || ""}</ReactMarkdown>
                    </Suspense>
                    {!!doc.actions?.length && (
                        <div style={{ marginTop: 16 }}>
                            <Typography.Text type="secondary">
                                {_("Click any of these to do it for you:")}
                            </Typography.Text>
                            <Space wrap style={{ marginTop: 8, display: "flex" }}>
                                {doc.actions.map((a) => {
                                    const entry = HELP_ACTION_CATALOG[a.action_key];
                                    const button = (
                                        <Button key={a.action_key} size="small" onClick={() => runAction(a.action_key)}>
                                            {a.label}
                                        </Button>
                                    );
                                    return entry ? (
                                        <Tooltip key={a.action_key} title={_(entry.description)}>
                                            {button}
                                        </Tooltip>
                                    ) : button;
                                })}
                            </Space>
                        </div>
                    )}
                </>
            )}

            {!loading && doc && !doc.found && (
                <Empty description={_("No help written for this page yet.")}>
                    {canCreateHelpDoc?.can !== false && pageKey && (
                        <Button
                            type="link"
                            onClick={() => navigate(`/veloiq_help_document/create?page_key=${encodeURIComponent(pageKey)}`)}
                        >
                            {_("Write help for this")}
                        </Button>
                    )}
                </Empty>
            )}

            {!!extraTexts?.length && (
                <div style={{ marginTop: 24 }}>
                    <Typography.Text type="secondary">{_("Related actions")}</Typography.Text>
                    <Suspense fallback={null}>
                        {extraTexts.map((t, i) => <ReactMarkdown key={i}>{t}</ReactMarkdown>)}
                    </Suspense>
                </div>
            )}
        </Drawer>
    );
};

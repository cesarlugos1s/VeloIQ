import React, { useEffect, useState } from "react";
import { Skeleton, theme, Tooltip, Typography } from "antd";
import { useApiUrl } from "@refinedev/core";
import { CommentOutlined, EyeOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import { ExecutableHtml } from "../../ExecutableHtml";

interface NLSentenceBlockProps {
    eid: number;
    title?: string | null;
    showLabel?: boolean;
}

export const NLSentenceBlock: React.FC<NLSentenceBlockProps> = ({ eid, title: titleProp, showLabel }) => {
    const { token } = theme.useToken();
    const apiUrl = useApiUrl();
    const [html, setHtml] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchedTitle, setFetchedTitle] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setHtml(null);
        setError(null);
        authenticatedFetch(`${apiUrl}/nlsentence/${eid}/custom_content?results_only=1`)
            .then(r => r.json())
            .then(data => {
                if (!cancelled) {
                    setHtml(data?.html ?? "");
                    setFetchedTitle(data?.title ?? null);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setError("Failed to load NLSentence result");
                    setLoading(false);
                }
            });
        return () => { cancelled = true; };
    }, [apiUrl, eid]);

    const displayTitle = titleProp || fetchedTitle || null;

    return (
        <div style={{ marginBottom: 8 }}>
            {showLabel !== false && displayTitle && (
                <div style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                    marginBottom: 4,
                    padding: "4px 6px",
                    background: token.colorFillAlter,
                    borderRadius: 6,
                    borderLeft: `3px solid ${token.colorPrimary}`,
                }}>
                    <CommentOutlined style={{ color: token.colorPrimary, marginTop: 2, flexShrink: 0 }} />
                    <Typography.Text style={{ flex: 1, whiteSpace: "pre-wrap", fontSize: token.fontSize, lineHeight: 1.4 }}>
                        {displayTitle}
                    </Typography.Text>
                    <Tooltip title="View NLSentence">
                        <Link to={`/nlsentence/show/${eid}`} onClick={e => e.stopPropagation()}>
                            <EyeOutlined style={{ color: token.colorPrimary, fontSize: 12 }} />
                        </Link>
                    </Tooltip>
                </div>
            )}
            {showLabel !== false && !displayTitle && !loading && (
                <div style={{ marginBottom: 4, display: "flex", justifyContent: "flex-end" }}>
                    <Tooltip title="View NLSentence">
                        <Link to={`/nlsentence/show/${eid}`} onClick={e => e.stopPropagation()}>
                            <EyeOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />
                        </Link>
                    </Tooltip>
                </div>
            )}
            {loading && <Skeleton active paragraph={{ rows: 3 }} />}
            {!loading && error && (
                <div style={{ color: token.colorError, fontSize: 12, padding: "4px 6px" }}>{error}</div>
            )}
            {!loading && html !== null && (
                <ExecutableHtml html={html} />
            )}
        </div>
    );
};

/**
 * Triggers server-side generation of docs/user_manuals/user_guide.pdf from
 * curated Help content, on mount. Admin-only — the backend enforces this via
 * require_role("Admin"); a non-admin sees the 403 detail as an error Result.
 */
import React, { useEffect, useState } from "react";
import { Result, Spin, Button } from "antd";
import { API_URL, authenticatedFetch } from "@juicemantics/veloiq-ui";

const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? t(text) : text;
};

type Status = "pending" | "success" | "error";

export default function GenerateUserGuidePage() {
    const [status, setStatus] = useState<Status>("pending");
    const [detail, setDetail] = useState<string>("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authenticatedFetch(`${API_URL}/help/generate-user-guide`, {
                    method: "POST",
                });
                const body = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok) {
                    setDetail(body?.detail || _("Failed to generate the user guide."));
                    setStatus("error");
                    return;
                }
                setDetail(body?.path || "docs/user_manuals/user_guide.pdf");
                setStatus("success");
            } catch {
                if (!cancelled) {
                    setDetail(_("Network error."));
                    setStatus("error");
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (status === "pending") {
        return (
            <Result
                icon={<Spin size="large" />}
                title={_("Generating the user guide…")}
                subTitle={_("Reading curated Help content and rendering the PDF.")}
            />
        );
    }

    if (status === "success") {
        return (
            <Result
                status="success"
                title={_("User guide generated")}
                subTitle={`${_("Written to")} ${detail}`}
                extra={
                    <Button type="primary" onClick={() => window.history.back()}>
                        {_("Back")}
                    </Button>
                }
            />
        );
    }

    return (
        <Result
            status="error"
            title={_("Could not generate the user guide")}
            subTitle={detail}
            extra={
                <Button type="primary" onClick={() => window.history.back()}>
                    {_("Back")}
                </Button>
            }
        />
    );
}

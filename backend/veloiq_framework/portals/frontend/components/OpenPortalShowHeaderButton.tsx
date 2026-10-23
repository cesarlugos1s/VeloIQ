/**
 * "Open portal" — a Show header button of the Portals configuration page.
 *
 * Declared by VeloIQ's built-in Portals manifest (veloiq_framework/portals/menu.py)
 * as a `show_header_button_components` entry, so `veloiq generate` adds it to
 * the header of every standard Show page; it renders only on a record of the
 * `veloiq_portals` resource and opens that portal (`/portals/<site>/`) in a
 * new tab. A portal not built yet (`veloiq build`) shows it disabled.
 */
import React from "react";
import { Button, Tooltip } from "antd";
import { ExportOutlined } from "@ant-design/icons";

/** Resource of the Portals configuration page (backend PORTALS_RESOURCE_NAME). */
const PORTALS_RESOURCE_NAME = "veloiq_portals";

// i18n helper — resolved at CALL time so window._ is always current.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

const OpenPortalShowHeaderButton: React.FC<{ resource: string; record?: any }> = ({ resource, record }) => {
    if (resource !== PORTALS_RESOURCE_NAME || !record?.address) return null;
    const built = Boolean(record.built);
    return (
        <Tooltip title={built ? _("Open the portal in a new tab") : _("The portal is not built yet. Run veloiq build.")}>
            <Button
                icon={<ExportOutlined />}
                disabled={!built}
                onClick={() => window.open(record.address, "_blank", "noopener,noreferrer")}
            >
                {_("Open portal")}
            </Button>
        </Tooltip>
    );
};

export default OpenPortalShowHeaderButton;

import React from "react";
import * as AntDIcons from "@ant-design/icons";

/** One entry in navigation.config.json — one per module or model. */
export interface NavConfigEntry {
    /** Refine resource key: "module:tasks", "task", "dashboard" */
    key: string;
    /** Human-readable display label */
    label: string;
    /** Ant Design icon component name, e.g. "UserOutlined" */
    icon: string;
    /** Display order — lower numbers appear first; ties keep original registration order */
    sequence: number;
    /** "module" for a top-level group, "model" for a leaf resource */
    type: "module" | "model";
}

export type NavConfig = NavConfigEntry[];

// ---------------------------------------------------------------------------
// Keyword → icon guessing
// ---------------------------------------------------------------------------

const KEYWORD_ICON_MAP: Array<[RegExp, string]> = [
    [/dashboard|overview|home/i, "DashboardOutlined"],
    [/user|person|people|member|staff|employee|contact|customer|client/i, "UserOutlined"],
    [/team|group|department|division|unit|crew/i, "TeamOutlined"],
    [/role|permission|access|security|privilege|policy/i, "LockOutlined"],
    [/tenant|organization|company|account|workspace|business/i, "BankOutlined"],
    [/task|todo|checklist|backlog|ticket/i, "CheckSquareOutlined"],
    [/project|initiative|program|campaign|sprint|epic/i, "FolderOpenOutlined"],
    [/invoice|bill|payment|financ|transaction|ledger|accounting|receipt/i, "FileTextOutlined"],
    [/product|catalog|inventory|stock|sku|variant/i, "ShoppingOutlined"],
    [/order|purchase|sale|cart|checkout|shipment/i, "ShoppingCartOutlined"],
    [/setting|config|preference|option|setup/i, "SettingOutlined"],
    [/report|analytic|metric|stat|chart|analysis|insight/i, "BarChartOutlined"],
    [/document|file|attachment|note|memo|contract|paper/i, "FileOutlined"],
    [/calendar|event|schedule|appointment|booking|slot/i, "CalendarOutlined"],
    [/message|email|notification|comment|chat|inbox|mail/i, "MailOutlined"],
    [/categor|tag|label|class/i, "TagOutlined"],
    [/location|address|region|area|country|city|place|site/i, "EnvironmentOutlined"],
    [/equipment|asset|machine|hardware/i, "ToolOutlined"],
    [/log|audit|histor|trail|activity/i, "HistoryOutlined"],
    [/animal|pet|livestock|breed|horse/i, "DatabaseOutlined"],
    [/building|room|floor|facility|barn|stable|stall/i, "HomeOutlined"],
    [/vehicle|car|truck|fleet|transport|bike/i, "CarOutlined"],
    [/health|medical|clinical|treatment|drug|patient/i, "MedicineBoxOutlined"],
];

/** Guess an Ant Design icon name from a resource name or label. */
export function guessIcon(text: string, isModule = false): string {
    const normalized = text.toLowerCase().replace(/[_:-]/g, " ");
    for (const [pattern, icon] of KEYWORD_ICON_MAP) {
        if (pattern.test(normalized)) return icon;
    }
    return isModule ? "FolderOutlined" : "TableOutlined";
}

/** Resolve an icon name string to a React element using the AntD icon registry. */
export function resolveIcon(iconName: string): React.ReactNode {
    const registry = AntDIcons as unknown as Record<string, React.ComponentType>;
    const IconCls = registry[iconName];
    return IconCls
        ? React.createElement(IconCls)
        : React.createElement(registry["TableOutlined"]);
}

/** Find a NavConfigEntry by exact resource key. */
export function getNavEntry(navConfig: NavConfig, key: string): NavConfigEntry | undefined {
    return navConfig.find((e) => e.key === key);
}

/**
 * Resolve the flat navigation.config.json key for a Refine menu/tree item.
 *
 * Refine's `useMenu()` builds `item.key` as a full path from the resource
 * tree — e.g. "/module:action" for a module, "/module:action/jm_action" for
 * one of its models — while navigation.config.json stores the bare resource
 * identifier ("module:action", "jm_action"). `item.name` always carries that
 * bare identifier unchanged, so prefer it; fall back to the last path
 * segment of `key` for any item that lacks `name`.
 */
export function resolveNavKey(item: { key?: string; name?: string } | null | undefined): string {
    if (item?.name) return String(item.name);
    const key = String(item?.key ?? "");
    return key.split("/").filter(Boolean).pop() ?? key;
}

/**
 * Resolve the app's landing fallback path — where "/" should send a user
 * when the Dashboard has no cells configured. This is the first model of
 * the first module, ordered by navigation.config.json's `sequence` (so it
 * matches whatever the menu itself shows first), not the raw registration
 * order of `allModels`.
 */
export function resolveFallbackLandingPath(
    navConfig: NavConfig,
    allModels: Array<{ resource?: string; name?: string }>,
): string {
    const firstModelEntry = [...navConfig]
        .filter((e) => e.type === "model" && e.key !== "dashboard")
        .sort((a, b) => a.sequence - b.sequence)[0];

    if (firstModelEntry) {
        const match = allModels.find(
            (m) => (m.resource || m.name) === firstModelEntry.key,
        );
        return `/${(match && (match.resource || match.name)) || firstModelEntry.key}`;
    }

    return `/${allModels[0]?.resource || allModels[0]?.name || "dashboard"}`;
}

/**
 * Sort items by the `sequence` values in navConfig.
 * Items without a matching entry sort to the end (sequence = 999).
 * Original array order serves as a stable tiebreaker.
 */
export function sortItemsByNavConfig<T extends { key?: string; name?: string }>(
    items: T[],
    navConfig: NavConfig,
): T[] {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => {
        const aSeq = getNavEntry(navConfig, resolveNavKey(a))?.sequence ?? 999;
        const bSeq = getNavEntry(navConfig, resolveNavKey(b))?.sequence ?? 999;
        return aSeq - bSeq;
    });
}

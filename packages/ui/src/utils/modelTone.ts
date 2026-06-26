import { useContext } from "react";
import { ColorModeContext } from "../contexts/ColorModeContext";

export type ModelTone = {
    solid: string;
    soft: string;
    softer: string;
    text: string;
    border: string;
    shadow: string;
};

// Color-coded tones for light mode — one distinct hue per slot.
// Both modules and models use this palette (color-coded schema).
const MODEL_TONES_LIGHT: ModelTone[] = [
    { solid: "#2563eb", soft: "#dbeafe", softer: "#eff6ff", text: "#1e3a8a", border: "#93c5fd", shadow: "rgba(37, 99, 235, 0.22)" },
    { solid: "#0f766e", soft: "#ccfbf1", softer: "#f0fdfa", text: "#115e59", border: "#5eead4", shadow: "rgba(15, 118, 110, 0.22)" },
    { solid: "#059669", soft: "#d1fae5", softer: "#ecfdf5", text: "#065f46", border: "#6ee7b7", shadow: "rgba(5, 150, 105, 0.22)" },
    { solid: "#d97706", soft: "#fef3c7", softer: "#fffbeb", text: "#92400e", border: "#fcd34d", shadow: "rgba(217, 119, 6, 0.24)" },
    { solid: "#7c3aed", soft: "#ede9fe", softer: "#f5f3ff", text: "#5b21b6", border: "#c4b5fd", shadow: "rgba(124, 58, 237, 0.22)" },
    { solid: "#e11d48", soft: "#ffe4e6", softer: "#fff1f2", text: "#9f1239", border: "#fda4af", shadow: "rgba(225, 29, 72, 0.22)" },
];

// Color-coded tones for dark mode — same hue order, dark-mode-safe values.
// soft/softer are deep tinted dark backgrounds; text and border are bright for legibility.
const MODEL_TONES_DARK: ModelTone[] = [
    { solid: "#3b82f6", soft: "#1e3a5f", softer: "#0f2040", text: "#93c5fd", border: "#3b82f6", shadow: "rgba(59, 130, 246, 0.35)" },
    { solid: "#14b8a6", soft: "#134e4a", softer: "#0c3330", text: "#5eead4", border: "#14b8a6", shadow: "rgba(20, 184, 166, 0.35)" },
    { solid: "#10b981", soft: "#064e3b", softer: "#032b20", text: "#6ee7b7", border: "#10b981", shadow: "rgba(16, 185, 129, 0.35)" },
    { solid: "#f59e0b", soft: "#451a03", softer: "#2d1000", text: "#fcd34d", border: "#f59e0b", shadow: "rgba(245, 158, 11, 0.35)" },
    { solid: "#8b5cf6", soft: "#2e1065", softer: "#1a0840", text: "#c4b5fd", border: "#8b5cf6", shadow: "rgba(139, 92, 246, 0.35)" },
    { solid: "#f43f5e", soft: "#4c0519", softer: "#2d0310", text: "#fda4af", border: "#f43f5e", shadow: "rgba(244, 63, 94, 0.35)" },
];

// Plain-color tones — used when modules_color_schema or models_color_schema is "plain-color".
// All modules/models share this single neutral tone, adapting to light or dark mode.
const PLAIN_TONE_LIGHT: ModelTone = {
    solid: "#374151", soft: "#f3f4f6", softer: "#f9fafb",
    text: "#374151", border: "#9ca3af", shadow: "rgba(55, 65, 81, 0.18)",
};
const PLAIN_TONE_DARK: ModelTone = {
    solid: "#ffffff", soft: "#1e293b", softer: "#0f172a",
    text: "#ffffff", border: "#94a3b8", shadow: "rgba(255, 255, 255, 0.15)",
};

// Keep the old name as an alias so any direct references outside this module still compile.
const MODEL_TONES = MODEL_TONES_LIGHT;

// Color schema settings — set once at app startup via setColorSchemas().
// Initialise from localStorage so the menu renders correctly even before the
// async /config/views fetch completes (avoids flash of wrong color scheme).
let _modulesColorSchema: string = (typeof localStorage !== "undefined" && localStorage.getItem("jm_modulesColorSchema")) || "plain-color";
let _modelsColorSchema: string = (typeof localStorage !== "undefined" && localStorage.getItem("jm_modelsColorSchema")) || "plain-color";

// Store the generated custom plain tones
let _customPlainToneLight: ModelTone | null = null;
let _customPlainToneDark: ModelTone | null = null;

// ── Subscription mechanism ─────────────────────────────────────────────────
// setColorSchemas() updates module-level variables outside of React's
// knowledge.  Components that call useModelTone() need to re-render when the
// schema changes (e.g. after the async /config/views fetch completes in
// production mode).  This simple listener list bridges the gap: the provider
// subscribes via onColorSchemaChange(), and setColorSchemas() fires all
// listeners after updating the module-level state.
let _colorSchemaListeners: Array<() => void> = [];

/** Subscribe to color-schema changes. Returns an unsubscribe function. */
export const onColorSchemaChange = (listener: () => void): (() => void) => {
    _colorSchemaListeners.push(listener);
    return () => {
        _colorSchemaListeners = _colorSchemaListeners.filter((l) => l !== listener);
    };
};

const _notifyColorSchemaListeners = () => {
    // Iterate a copy so a listener can unsubscribe itself during the loop.
    for (const l of [..._colorSchemaListeners]) l();
};

const hexToRgb = (hex: string) => {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return null;
    return {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16),
    };
};

const isDarkColor = (hexColor: string) => {
    const rgb = hexToRgb(hexColor);
    if (!rgb) return false;
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance < 0.53;
};

export const setColorSchemas = (schemas: {
    modulesColorSchema?: string;
    modelsColorSchema?: string;
    plainColorBaseHex?: string;
}) => {
    if (schemas.modulesColorSchema) {
        _modulesColorSchema = schemas.modulesColorSchema;
        try { localStorage.setItem("jm_modulesColorSchema", schemas.modulesColorSchema); } catch (_e) { /* quota */ }
    }
    if (schemas.modelsColorSchema) {
        _modelsColorSchema = schemas.modelsColorSchema;
        try { localStorage.setItem("jm_modelsColorSchema", schemas.modelsColorSchema); } catch (_e) { /* quota */ }
    }

    if (schemas.plainColorBaseHex) {
        try { localStorage.setItem("jm_plainColorBaseHex", schemas.plainColorBaseHex); } catch (_e) { /* quota */ }
        const rgb = hexToRgb(schemas.plainColorBaseHex);
        if (rgb) {
            const { r, g, b } = rgb;
            const hex = schemas.plainColorBaseHex;

            // 1. Inner component tones
            _customPlainToneLight = {
                solid: hex,
                soft: `rgba(${r}, ${g}, ${b}, 0.12)`,
                softer: `rgba(${r}, ${g}, ${b}, 0.05)`,
                text: isDarkColor(hex) ? hex : "#0f172a",
                border: `rgba(${r}, ${g}, ${b}, 0.3)`,
                shadow: `rgba(${r}, ${g}, ${b}, 0.18)`,
            };

            // Reverted back to the proper, legible dark mode components
            _customPlainToneDark = {
                solid: "#ffffff",
                soft: `rgba(${r}, ${g}, ${b}, 0.35)`,
                softer: `rgba(${r}, ${g}, ${b}, 0.15)`,
                text: "#ffffff",
                border: `rgba(${r}, ${g}, ${b}, 0.5)`,
                shadow: `rgba(${r}, ${g}, ${b}, 0.3)`,
            };

            // 2. Inject global CSS for BOTH Light and Dark mode backgrounds
            if (typeof document !== "undefined") {
                let styleEl = document.getElementById("jm-dynamic-theme-styles");
                if (!styleEl) {
                    styleEl = document.createElement("style");
                    styleEl.id = "jm-dynamic-theme-styles";
                    document.head.appendChild(styleEl);
                }

                // Helper to tint for Light Mode (mixing with white)
                // 0.96 means 96% white, 4% color.
                const tint = (val: number, amount: number) => Math.floor(val + (255 - val) * amount);
                const lightBgContent = `rgb(${tint(r, 0.97)}, ${tint(g, 0.97)}, ${tint(b, 0.97)})`;
                const lightBgElements = `rgb(${tint(r, 0.93)}, ${tint(g, 0.93)}, ${tint(b, 0.93)})`;
                const lightBgHover = `rgb(${tint(r, 0.85)}, ${tint(g, 0.85)}, ${tint(b, 0.85)})`;

                // Helper to shade for Dark Mode (mixing with black)
                // 0.06 means 6% color, 94% black.
                const shade = (val: number, amount: number) => Math.floor(val * amount);
                const darkBgContent = `rgb(${shade(r, 0.06)}, ${shade(g, 0.06)}, ${shade(b, 0.06)})`;
                const darkBgElements = `rgb(${shade(r, 0.11)}, ${shade(g, 0.11)}, ${shade(b, 0.11)})`;
                const darkBgHover = `rgb(${shade(r, 0.16)}, ${shade(g, 0.16)}, ${shade(b, 0.16)})`;

                // Inverted sidebar/header: background + computed readable text
                const sidebarLightBg = hex;
                const sidebarLightText = isDarkColor(hex) ? "#ffffff" : "#0f172a";
                const sidebarDarkBg = lightBgElements;
                const sidebarDarkText = "#0f172a";  // lightBgElements is always light

                styleEl.innerHTML = `
                    /* --- LIGHT MODE OVERRIDES --- */
                    body.jm-light .ant-layout,
                    body.jm-light .ant-layout-content,
                    body.jm-light .ant-tabs-content-holder,
                    body.jm-light .ant-tabs-content,
                    body.jm-light .ant-tabs-tabpane {
                        background-color: ${lightBgContent} !important;
                    }
                    body.jm-light .ant-layout-sider,
                    body.jm-light .ant-menu,
                    body.jm-light .ant-menu-submenu,
                    body.jm-light .ant-menu-submenu-title,
                    body.jm-light .ant-layout-header {
                        background-color: ${sidebarLightBg} !important;
                        color: ${sidebarLightText} !important;
                    }
                    body.jm-light .ant-layout-sider *,
                    body.jm-light .ant-layout-header * {
                        color: ${sidebarLightText} !important;
                    }
                    body.jm-light .ant-layout-sider .ant-menu-item-selected,
                    body.jm-light .ant-layout-sider .ant-menu-item-selected *,
                    body.jm-light .ant-layout-sider .ant-menu-item:hover,
                    body.jm-light .ant-layout-sider .ant-menu-item:hover *,
                    body.jm-light .ant-layout-header .ant-menu-item-selected,
                    body.jm-light .ant-layout-header .ant-menu-item-selected *,
                    body.jm-light .ant-layout-header .ant-menu-item:hover,
                    body.jm-light .ant-layout-header .ant-menu-item:hover * {
                        color: revert !important;
                    }
                    body.jm-light .ant-menu-submenu-popup {
                        background-color: ${sidebarLightBg} !important;
                    }
                    body.jm-light .ant-menu-submenu-popup .ant-menu-item:not(.ant-menu-item-selected),
                    body.jm-light .ant-menu-submenu-popup .ant-menu-submenu-title:not(.ant-menu-submenu-selected) {
                        color: ${sidebarLightText} !important;
                    }
                    body.jm-light .ant-card,
                    body.jm-light .ant-table-wrapper .ant-table,
                    body.jm-light .ant-table-thead > tr > th,
                    body.jm-light .ant-tabs-nav,
                    body.jm-light .ant-tabs-nav::before,
                    body.jm-light .ant-tabs-tab {
                        background-color: ${lightBgElements} !important;
                    }
                    body.jm-light .ant-tabs-tab-active {
                        background-color: ${lightBgContent} !important;
                    }
                    body.jm-light .ant-menu-light .ant-menu-item-selected,
                    body.jm-light .ant-menu-light .ant-menu-item-active,
                    body.jm-light .ant-menu-light .ant-menu-submenu-title-active {
                        background-color: ${lightBgHover} !important;
                    }

                    /* --- DARK MODE OVERRIDES --- */
                    body.jm-dark .ant-layout,
                    body.jm-dark .ant-layout-content,
                    body.jm-dark .ant-tabs-content-holder,
                    body.jm-dark .ant-tabs-content,
                    body.jm-dark .ant-tabs-tabpane {
                        background-color: ${darkBgContent} !important;
                    }
                    body.jm-dark .ant-layout-sider,
                    body.jm-dark .ant-menu,
                    body.jm-dark .ant-menu-submenu,
                    body.jm-dark .ant-menu-submenu-title,
                    body.jm-dark .ant-layout-header {
                        background-color: ${sidebarDarkBg} !important;
                        color: ${sidebarDarkText} !important;
                    }
                    body.jm-dark .ant-layout-sider *,
                    body.jm-dark .ant-layout-header * {
                        color: ${sidebarDarkText} !important;
                    }
                    body.jm-dark .ant-layout-sider .ant-menu-item-selected,
                    body.jm-dark .ant-layout-sider .ant-menu-item-selected *,
                    body.jm-dark .ant-layout-sider .ant-menu-item:hover,
                    body.jm-dark .ant-layout-sider .ant-menu-item:hover *,
                    body.jm-dark .ant-layout-header .ant-menu-item-selected,
                    body.jm-dark .ant-layout-header .ant-menu-item-selected *,
                    body.jm-dark .ant-layout-header .ant-menu-item:hover,
                    body.jm-dark .ant-layout-header .ant-menu-item:hover * {
                        color: revert !important;
                    }
                    body.jm-dark .ant-menu-submenu-popup {
                        background-color: ${sidebarDarkBg} !important;
                    }
                    body.jm-dark .ant-menu-submenu-popup .ant-menu-item:not(.ant-menu-item-selected),
                    body.jm-dark .ant-menu-submenu-popup .ant-menu-submenu-title:not(.ant-menu-submenu-selected) {
                        color: ${sidebarDarkText} !important;
                    }
                    body.jm-dark .ant-card,
                    body.jm-dark .ant-table-wrapper .ant-table,
                    body.jm-dark .ant-table-thead > tr > th,
                    body.jm-dark .ant-tabs-nav,
                    body.jm-dark .ant-tabs-nav::before,
                    body.jm-dark .ant-tabs-tab {
                        background-color: ${darkBgElements} !important;
                    }
                    body.jm-dark .ant-tabs-tab-active {
                        background-color: ${darkBgContent} !important;
                    }
                    body.jm-dark .ant-menu-dark .ant-menu-item-selected,
                    body.jm-dark .ant-menu-dark .ant-menu-item-active,
                    body.jm-dark .ant-menu-dark .ant-menu-submenu-title-active {
                        background-color: ${darkBgHover} !important;
                    }
                `;
            }
        }
    }

    // Notify React components (via ColorModeContextProvider's subscription)
    // that the color schema changed so they re-render with the updated tones.
    _notifyColorSchemaListeners();
};

const hashString = (input: string) => {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) hash = (hash * 31 + input.charCodeAt(i)) | 0;
    return Math.abs(hash);
};

export const normalizeToneKey = (value?: string) =>
    (value || "")
        .toLowerCase()
        .replace(/[_\s-]+/g, "")
        .replace(/[^a-z0-9:]/g, "");

const toneSeedFromModel = (
    modelLike?: string | { resource?: string; name?: string; label?: string },
) => {
    if (typeof modelLike === "string") return normalizeToneKey(modelLike) || "default";
    const resourceKey = normalizeToneKey(modelLike?.resource);
    const nameKey = normalizeToneKey(modelLike?.name);
    const labelKey = normalizeToneKey(modelLike?.label);
    return resourceKey || nameKey || labelKey || "default";
};

// Detect whether the UI is currently in dark mode by reading the class that
// App.tsx toggles on <body> ("jm-dark" / "jm-light").
// An explicit `darkMode` argument takes precedence so callers can override if needed.
export const getModelTone = (
    modelLike?: string | { resource?: string; name?: string; label?: string },
    darkMode?: boolean,
) => {
    const dark =
        darkMode !== undefined
            ? darkMode
            : typeof document !== "undefined" && document.body.classList.contains("jm-dark");
    const seed = toneSeedFromModel(modelLike);
    const isModule = seed.startsWith("module:");
    const schema = isModule ? _modulesColorSchema : _modelsColorSchema;

    if (schema === "plain-color") {
        // USE THE CUSTOM GENERATED TONES IF AVAILABLE
        if (_customPlainToneLight && _customPlainToneDark) {
            return dark ? _customPlainToneDark : _customPlainToneLight;
        }
        // FALLBACK TO GRAYSCALE IF NO HEX WAS PROVIDED IN CONFIG
        return dark ? PLAIN_TONE_DARK : PLAIN_TONE_LIGHT;
    }

    const tones = dark ? MODEL_TONES_DARK : MODEL_TONES_LIGHT;
    return tones[hashString(seed) % tones.length];
};

// Reactive hook — re-evaluates whenever dark mode is toggled or the color
// schema (plain-color / color-coded / custom hex) changes via setColorSchemas().
// Use this instead of getModelTone() inside React components so that tones
// update immediately on mode or schema change.
export const useModelTone = (
    modelLike?: string | { resource?: string; name?: string; label?: string },
): ModelTone => {
    const { mode, schemaVersion } = useContext(ColorModeContext);
    // schemaVersion is read to make this hook reactive to setColorSchemas()
    // calls; the actual value is unused because getModelTone reads the
    // module-level _customPlainToneLight/Dark variables directly.
    void schemaVersion;
    return getModelTone(modelLike, mode === "dark");
};

export const getContrastingTextColor = (background: string) =>
    (isDarkColor(background) ? "#f8fafc" : "#0f172a");

// Hydrate plain-color tones and CSS from localStorage at module load time so the
// very first render already has the correct tones (no flash of "color-coded").
if (typeof localStorage !== "undefined") {
    const cachedHex = localStorage.getItem("jm_plainColorBaseHex");
    if (cachedHex) {
        setColorSchemas({
            modulesColorSchema: _modulesColorSchema,
            modelsColorSchema: _modelsColorSchema,
            plainColorBaseHex: cachedHex,
        });
    }
}
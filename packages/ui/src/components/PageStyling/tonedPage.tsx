/**
 * Styles a tool, builder or configuration page of an extension package like the framework's own
 * dynamic pages (list, show, edit, create): titles, section headings, boxes and shadows take the
 * tone derived from the color scheme and base color of the system configuration page. A change of
 * scheme, base color or light/dark mode restyles the page with no change in the extension.
 *
 * Tables get the dynamic pages' header colors through the same tone scope.
 * Elements opt in by tag or class: ant-design headings and cards are styled automatically;
 * add `jm-panel-title`, `jm-panel-header`, `jm-toolbar-group` or `jm-panel-box` to custom ones.
 */
import React, { useContext } from "react";
import { ColorModeContext } from "../../contexts/ColorModeContext";
import { getModelTone } from "../../utils/modelTone";
import { ToneSharedStyles, toneScopeStyle } from "../DynamicResource/utils/colors";

/** The tone of an extension's pages; `seed` is "module:<name>" so the module color scheme applies. */
export const usePageTone = (seed: string = "module:extension") => {
    const { mode, schemaVersion } = useContext(ColorModeContext) as any;
    void schemaVersion;   // read so the page re-renders when the scheme or base color changes
    return getModelTone(seed, mode === "dark");
};

export const TonedPage: React.FC<{ seed?: string; style?: React.CSSProperties; children: React.ReactNode }> =
    ({ seed, style, children }) => {
        const tone = usePageTone(seed);
        return (
            <div className="jm-tone-scope jm-toned-page" style={{ ...toneScopeStyle(tone), ...style }}>
                <ToneSharedStyles />
                <style>{`
                    .jm-toned-page h1.ant-typography, .jm-toned-page h2.ant-typography,
                    .jm-toned-page h3.ant-typography, .jm-toned-page h4.ant-typography {
                        color: ${tone.solid}; font-size: 18px; font-weight: 700;
                    }
                    .jm-toned-page h5.ant-typography, .jm-toned-page .ant-card-head-title, .jm-toned-page .jm-panel-title {
                        color: ${tone.solid}; font-weight: 600;
                    }
                    .jm-toned-page .ant-card { border-color: ${tone.border}; box-shadow: 0 8px 20px -16px ${tone.shadow}; }
                    .jm-toned-page .ant-card-head { border-bottom-color: ${tone.border}; }
                    .jm-toned-page .jm-panel-header { background: ${tone.softer}; border-bottom-color: ${tone.border} !important; }
                    .jm-toned-page .jm-toolbar-group { background: ${tone.softer} !important; border-color: ${tone.border} !important; }
                    .jm-toned-page .jm-panel-box { border-color: ${tone.border} !important; box-shadow: 0 8px 20px -16px ${tone.shadow}; }
                `}</style>
                {children}
            </div>
        );
    };

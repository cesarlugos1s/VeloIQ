import { createContext, useContext } from "react";
import type { NavConfig } from "../utils/navConfig";

/**
 * Makes the app's navigation.config.json available to any component rendered
 * inside LayoutWrapper (including extension-contributed routes). This is the
 * authoritative list of modules ("module:{name}" entries) and their labels.
 */
export const NavConfigContext = createContext<NavConfig>([]);

export const useNavConfig = (): NavConfig => useContext(NavConfigContext);

/** Convenience: module entries from the nav config as {value, label} options. */
export function useNavModules(): { value: string; label: string }[] {
    const navConfig = useNavConfig();
    return (navConfig || [])
        .filter((e) => e.type === "module" && String(e.key || "").startsWith("module:"))
        .map((e) => ({ value: String(e.key).slice("module:".length), label: e.label || String(e.key).slice("module:".length) }));
}

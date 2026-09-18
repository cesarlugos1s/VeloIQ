import type React from "react";
import type { PaneNavigationValue } from "../../contexts/PaneNavigationContext";
import type { ModelDef, PrimaryShowRendererProps } from "../DynamicResource/types";
import type { ResolvedPane } from "./PaneParts";

/** Props every pane layout mode receives from `MultiPaneLayout`. */
export interface PaneLayoutProps {
    /** Detail panes from the URL whose model resolved, in order. */
    entries: ResolvedPane[];
    allModels: ModelDef[];
    /** The main page the layout wraps (list or show page). */
    listContent: React.ReactNode;
    /** Navigation context for the main page (pane index 0). */
    listContext: PaneNavigationValue;
    /** Navigation contexts for detail panes, indexed by URL pane index. */
    detailContexts: PaneNavigationValue[];
    PrimaryShowRenderer: React.ComponentType<PrimaryShowRendererProps> | null | undefined;
    /** Drops the URL panes from this array index onward (0 closes every pane). */
    closeFrom: (fromArrayIndex: number) => void;
    /** Measured width in px of the layout container (0 before the first measure). */
    containerWidth: number;
    /** Cap of fully visible panes ("stack" mode). */
    cap: number;
    /** Fixed pane width in px. */
    fixedWidth: number;
}

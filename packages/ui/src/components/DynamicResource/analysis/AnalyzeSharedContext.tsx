/**
 * The Analyze configuration a page shares with the views nested in it.
 *
 * A page that owns an Analyze section (a list page, a relation block) provides its settings here around
 * the views that draw several lists of its records, e.g. the columns of a kanban board. An "analyze" view
 * inside them reads the page's chart configuration (chart type, categories, summary function, ranking,
 * series) instead of keeping its own, so every list is drawn the same way and a change in the page's Analyze
 * section reaches them at once.
 */
import React, { createContext, useContext } from "react";
import type { AnalyzeSettings } from "./useAnalyze";

export interface AnalyzeSharedConfig {
    /** The page's Analyze configuration (useAnalyzeSettings of the page's model). */
    settings: AnalyzeSettings;
    /** Resolved display labels of referenced records, keyed `"<reference>:<id>"`. */
    labelCache: Record<string, string>;
    /** Fill colour of the in-cell value bars (crosstab chart type). */
    numericBarColor: string;
}

const AnalyzeSharedContext = createContext<AnalyzeSharedConfig | null>(null);

export const AnalyzeSharedProvider = AnalyzeSharedContext.Provider;

/** The Analyze configuration the page shares, or null when no page provides one. */
export const useAnalyzeSharedConfig = (): AnalyzeSharedConfig | null => useContext(AnalyzeSharedContext);

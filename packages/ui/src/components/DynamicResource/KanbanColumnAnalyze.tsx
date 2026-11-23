/**
 * The content of one kanban column shown as Analyze: the model's Analyze section (the shared
 * AnalyzePanel) built from the column's records only.
 *
 * The chart configuration (chart type, categories, summary function, ranking filter and series)
 * is the model's, held once for the whole board, so every column draws the same chart and the
 * columns can be compared. Each column keeps its own results (data, statistics, flip state).
 */
import React from "react";
import { AnalyzePanel } from "./analysis/AnalyzePanel";
import { useAnalyzeResults, type AnalyzeSettings } from "./analysis/useAnalyze";
import { useModelTone } from "../../utils/modelTone";
import type { FieldDef, ModelDef } from "./types";

/** What a kanban board needs from its page to show its columns as Analyze. */
export interface KanbanAnalyzeConfig {
    /** The page's Analyze configuration (useAnalyzeSettings of the same model). */
    settings: AnalyzeSettings;
    /** Resolved display labels of referenced records, keyed `"<reference>:<id>"`. */
    labelCache: Record<string, string>;
    /** Fill colour of the in-cell value bars (crosstab chart type). */
    numericBarColor: string;
}

export interface KanbanColumnAnalyzeProps {
    model: ModelDef;
    /** The column's records. */
    records: any[];
    /** The fields the statistics side of the card summarises. */
    cardFields: FieldDef[];
    analyze: KanbanAnalyzeConfig;
}

export const KanbanColumnAnalyze: React.FC<KanbanColumnAnalyzeProps> = ({ model, records, cardFields, analyze }) => {
    const tone = useModelTone(model);
    const results = useAnalyzeResults(analyze.settings, {
        rows: records,
        statsFields: cardFields,
        labelCache: analyze.labelCache,
    });
    // The saved preferences load once for the page; until then the chart would flash its defaults.
    if (!analyze.settings.analyzePrefsReady) return null;
    return (
        <AnalyzePanel
            analyze={results}
            allFields={model.fields}
            tone={tone}
            numericBarColor={analyze.numericBarColor}
        />
    );
};

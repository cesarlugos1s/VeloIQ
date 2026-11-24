/**
 * The "analyze" view type: the records shown with the Analyze section (the shared AnalyzePanel -- chart
 * and statistics) instead of as a list.
 *
 * Inside a page that shares its Analyze configuration (see analysis/AnalyzeSharedContext), the view draws
 * the page's chart configuration from only its own records, which is how kanban columns can be compared.
 * Elsewhere it keeps the model's own saved Analyze configuration.
 */
import React from "react";
import { useApiUrl } from "@refinedev/core";
import { AnalyzePanel } from "./analysis/AnalyzePanel";
import { AnalyzeSharedProvider, useAnalyzeSharedConfig, type AnalyzeSharedConfig } from "./analysis/AnalyzeSharedContext";
import { useAnalyzeResults, useAnalyzeSettings } from "./analysis/useAnalyze";
import { useModelTone } from "../../utils/modelTone";
import { resolveResourcePath } from "./utils/model";
import type { FieldDef, ModelDef } from "./types";

export interface AnalyzeViewProps {
    model: ModelDef;
    allModels?: ModelDef[];
    /** The records to analyse. */
    records: any[];
    /** The fields the statistics side of the card summarises. */
    statsFields: FieldDef[];
}

const AnalyzeViewBody: React.FC<{ config: AnalyzeSharedConfig; records: any[]; statsFields: FieldDef[]; allModels?: ModelDef[]; resolveTitles: boolean }> = ({ config, records, statsFields, allModels, resolveTitles }) => {
    const { settings } = config;
    const tone = useModelTone(settings.model);
    const results = useAnalyzeResults(settings, {
        rows: records,
        statsFields,
        labelCache: config.labelCache,
        // The page (or the board) that shares its settings already holds the titles of the reference categories.
        referenceModels: resolveTitles ? allModels : undefined,
    });
    // The saved preferences load once; until then the chart would flash its defaults.
    if (!settings.analyzePrefsReady) return null;
    return <AnalyzePanel analyze={results} allFields={settings.model.fields} tone={tone} numericBarColor={config.numericBarColor} />;
};

/** The view's own Analyze configuration, for use outside a page that shares one. */
const AnalyzeViewWithOwnSettings: React.FC<AnalyzeViewProps> = ({ model, allModels, records, statsFields }) => {
    const apiUrl = useApiUrl();
    const tone = useModelTone(model);
    const settings = useAnalyzeSettings({
        model,
        apiUrl,
        prefsResourceKey: resolveResourcePath(model.resource || model.name, allModels),
        currentViewName: "",
    });
    const [labelCache] = React.useState<Record<string, string>>({});
    const config: AnalyzeSharedConfig = { settings, labelCache, numericBarColor: tone.soft };
    return <AnalyzeViewBody config={config} records={records} statsFields={statsFields} allModels={allModels} resolveTitles />;
};

export const AnalyzeView: React.FC<AnalyzeViewProps> = (props) => {
    const shared = useAnalyzeSharedConfig();
    // A configuration shared by a page of another model (a list appended to it) is not this model's.
    if (shared && shared.settings.model.name === props.model.name) {
        return <AnalyzeViewBody config={shared} records={props.records} statsFields={props.statsFields} allModels={props.allModels} resolveTitles={false} />;
    }
    return <AnalyzeViewWithOwnSettings {...props} />;
};

export { AnalyzeSharedProvider };

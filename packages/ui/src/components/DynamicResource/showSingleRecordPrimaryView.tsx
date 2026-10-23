/**
 * The "primary" view of a single-record resource (`ModelDef.isSingleRecord`,
 * e.g. the System Configuration settings): the record's own show/edit form,
 * without the list around it (search, filters and Analyze mean nothing for one
 * record).
 *
 * DynamicList renders this for such a resource in the "primary" view type, so
 * a settings page, a Views Grid cell and a Sections Grid "view" item all show
 * the same form. The form is the app's PrimaryShowRenderer (the one every
 * primary view uses), or DynamicShow when the app provides none.
 */
import React, { useContext, useEffect, useState } from "react";
import { Alert, Spin } from "antd";
import { useApiUrl } from "@refinedev/core";
import type { ModelDef } from "./types";
import { PrimaryShowContext } from "./types";
import { resolveResourcePath } from "./utils/model";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import { DynamicShow } from "./pages/DynamicShow";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/** True when `model` is a single-record resource shown with the "primary" view type. */
export function isSingleRecordPrimaryView(model: ModelDef, listViewType?: string): boolean {
    return Boolean(model.isSingleRecord) && String(listViewType || model.listViewType || "").toLowerCase() === "primary";
}

export const SingleRecordPrimaryView: React.FC<{ model: ModelDef; allModels?: ModelDef[] }> = ({ model, allModels }) => {
    const apiUrl = useApiUrl();
    const PrimaryShowRenderer = useContext(PrimaryShowContext);
    const [recordId, setRecordId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const resourcePath = resolveResourcePath(model.resource || model.name, allModels);

    // The record's id is whatever the resource's one row has; read it from the list.
    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        authenticatedFetch(`${apiUrl}/${resourcePath}?_start=0&_end=1`)
            .then(async (response) => {
                const body = await response.json().catch(() => null);
                if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : _("The data of this list could not be read."));
                const row = Array.isArray(body) ? body[0] : undefined;
                if (!cancelled) setRecordId(row ? String(row.eid ?? row.id) : null);
            })
            .catch((error) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error)); });
        return () => { cancelled = true; };
    }, [apiUrl, resourcePath]);

    if (loadError) return <Alert type="error" showIcon message={loadError} />;
    if (recordId === null) {
        return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spin /></div>;
    }
    return PrimaryShowRenderer
        ? <PrimaryShowRenderer model={model} id={recordId} allModels={allModels || []} />
        : <DynamicShow model={model} allModels={allModels} idOverride={recordId} />;
};

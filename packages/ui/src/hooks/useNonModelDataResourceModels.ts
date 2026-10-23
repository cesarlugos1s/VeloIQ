/**
 * The ModelDefs of the non-model data resources (non-model data served by the backend
 * with the REST contract of a model), loaded at runtime from
 * `GET /api/veloiq/non-model-data-resources`.
 *
 * They are not in `allModels.gen.ts`: the backend knows which non-model data resources
 * the signed-in user may read and which fields their roles may see, so the list
 * is fetched after sign-in and again whenever the user's permissions are
 * refreshed (login, window focus, a saved access policy).
 */
import { useEffect, useState } from "react";
import type { ModelDef } from "../components/DynamicResource/types";
import { subscribeAccess } from "../access/accessStore";
import { authenticatedFetch } from "../utils/authenticatedFetch";
import { API_URL } from "../providers/constants";

const TOKEN_KEY = "jm_access_token";

/** Fetch the non-model data resources' ModelDefs (an empty list when signed out or on error). */
export async function fetchNonModelDataResourceModels(): Promise<ModelDef[]> {
    if (!localStorage.getItem(TOKEN_KEY)) return [];
    try {
        const response = await authenticatedFetch(`${API_URL}/veloiq/non-model-data-resources`);
        if (!response.ok) return [];
        const body = await response.json();
        return Array.isArray(body?.models) ? (body.models as ModelDef[]) : [];
    } catch {
        return [];
    }
}

/** Return the non-model data resources' ModelDefs, kept current with the user's permissions. */
export function useNonModelDataResourceModels(): ModelDef[] {
    const [models, setModels] = useState<ModelDef[]>([]);
    useEffect(() => {
        let cancelled = false;
        let lastLoadedModelsSignature = "";
        const loadNonModelDataModels = () => {
            void fetchNonModelDataResourceModels().then((next) => {
                const signature = JSON.stringify(next);
                // Keep the same array while nothing changed, so consumers don't re-render.
                if (cancelled || signature === lastLoadedModelsSignature) return;
                lastLoadedModelsSignature = signature;
                setModels(next);
            });
        };
        loadNonModelDataModels();
        const unsubscribe = subscribeAccess(loadNonModelDataModels);
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, []);
    return models;
}

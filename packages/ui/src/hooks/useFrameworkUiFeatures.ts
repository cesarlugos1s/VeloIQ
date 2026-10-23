/**
 * The framework UI features the signed-in user may use, from
 * `GET /api/veloiq/ui-features` (backend: veloiq_framework/portals/framework_ui_features.py).
 *
 * A role's feature policy and an external portal's profile can switch off the
 * Analyze section, CSV export, saved views and layouts, the column selector and
 * the model metadata window. The server refuses what is switched off; the
 * standard pages also hide it. Until the answer arrives every feature counts as
 * off, so a portal user never sees, even briefly, a tool their site hides.
 */
import { useEffect, useState } from "react";
import { authenticatedFetch } from "../utils/authenticatedFetch";
import { API_URL } from "../providers/constants";

export interface FrameworkUiFeatures {
    analyze: boolean;
    csv_export: boolean;
    saved_views: boolean;
    column_selector: boolean;
    record_metadata: boolean;
}

const ALL_FEATURES_OFF: FrameworkUiFeatures = {
    analyze: false, csv_export: false, saved_views: false, column_selector: false, record_metadata: false,
};

/** The request in progress (or done), shared by every page of the session. */
let frameworkUiFeaturesRequest: Promise<FrameworkUiFeatures> | null = null;
/** The answer once known, so later pages start with it. */
let knownFrameworkUiFeatures: FrameworkUiFeatures | null = null;

function fetchFrameworkUiFeatures(): Promise<FrameworkUiFeatures> {
    if (!frameworkUiFeaturesRequest) {
        frameworkUiFeaturesRequest = authenticatedFetch(`${API_URL}/veloiq/ui-features`)
            .then(async (response) => {
                if (!response.ok) throw new Error(String(response.status));
                const body = await response.json();
                const loaded: FrameworkUiFeatures = { ...ALL_FEATURES_OFF, ...(body?.features || {}) };
                knownFrameworkUiFeatures = loaded;
                return loaded;
            })
            .catch(() => {
                // Ask again next time (e.g. after signing in); meanwhile the features stay hidden.
                frameworkUiFeaturesRequest = null;
                return ALL_FEATURES_OFF;
            });
    }
    return frameworkUiFeaturesRequest!;
}

/** Forget the known features (call after signing in or out, so the next page asks again). */
export function resetFrameworkUiFeatures(): void {
    frameworkUiFeaturesRequest = null;
    knownFrameworkUiFeatures = null;
}

/** Return the framework UI features of the signed-in user (all off until known). */
export function useFrameworkUiFeatures(): FrameworkUiFeatures {
    const [features, setFeatures] = useState<FrameworkUiFeatures>(knownFrameworkUiFeatures ?? ALL_FEATURES_OFF);
    useEffect(() => {
        let cancelled = false;
        fetchFrameworkUiFeatures().then((loaded) => { if (!cancelled) setFeatures(loaded); });
        return () => { cancelled = true; };
    }, []);
    return features;
}

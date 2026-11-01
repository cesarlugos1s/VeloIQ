/**
 * Resolves the page template a user picked for now (temporary page layout)
 * into page-configuration rows, using the template provider an extension
 * registered. The rows are meant to be passed as `overrideConfigRows`.
 */
import { useEffect, useState } from "react";
import type { ModelDef, ViewConfigRow } from "../types";
import { getRegisteredPageTemplateProvider, type TemporaryLayoutPageType } from "./pageTemplateProviderRegistry";
import { useTemporaryPageLayoutFor } from "./temporaryPageLayoutStore";

/**
 * @param pageKey   store key of the page; null (embedded page) never has a template
 * @param model     model the page shows
 * @param pageType  list, show, edit or create
 * @returns the rows of the chosen template, or undefined while none is chosen,
 *          while it is being resolved, or when it cannot be resolved (the page
 *          then keeps its configured layout).
 */
export function useTemporaryTemplateRows(
    pageKey: string | null,
    model: ModelDef | undefined,
    pageType: TemporaryLayoutPageType,
): ViewConfigRow[] | undefined {
    const { templateName } = useTemporaryPageLayoutFor(pageKey);
    const [resolved, setResolved] = useState<{ templateName: string; rows: ViewConfigRow[] } | null>(null);

    useEffect(() => {
        const provider = getRegisteredPageTemplateProvider();
        if (!templateName || !model || !provider) { setResolved(null); return; }
        let cancelled = false;
        provider.resolveTemplateRows(model, pageType, templateName)
            .then((rows) => { if (!cancelled) setResolved({ templateName, rows }); })
            .catch(() => { if (!cancelled) setResolved(null); });
        return () => { cancelled = true; };
    }, [templateName, model, pageType]);

    // Ignore rows that belong to a template the user has since left.
    return resolved && resolved.templateName === templateName ? resolved.rows : undefined;
}

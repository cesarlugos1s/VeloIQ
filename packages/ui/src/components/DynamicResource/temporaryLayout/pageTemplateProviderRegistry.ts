/**
 * Registry through which an extension package (for example Advanced
 * Development) tells the framework which page templates exist and how to turn
 * one into page-configuration rows.
 *
 * The framework never imports an extension: an extension calls
 * `registerPageTemplateProvider` when it loads, and the temporary page layout
 * controls offer the "template" button only while a provider is registered.
 */
import type { ModelDef, ViewConfigRow } from "../types";

/** The page types a template can be applied to. */
export type TemporaryLayoutPageType = "list" | "show" | "edit" | "create";

/** One template a user can pick for the page being used. */
export interface PageTemplateChoice {
    /** Stable identifier, passed back to `resolveTemplateRows`. */
    name: string;
    /** Text shown to the user (already translated by the provider). */
    label: string;
    /** Optional longer explanation, shown as a tooltip. */
    description?: string;
}

/** What an extension implements to supply page templates. */
export interface PageTemplateProvider {
    /** Templates applicable to the given model and page type (the model carries the fields and relations a template expands). */
    listTemplatesForPage(model: ModelDef, pageType: TemporaryLayoutPageType): Promise<PageTemplateChoice[]>;
    /** The page-configuration rows produced by applying a template to the model. */
    resolveTemplateRows(model: ModelDef, pageType: TemporaryLayoutPageType, templateName: string): Promise<ViewConfigRow[]>;
}

let registeredProvider: PageTemplateProvider | null = null;
const registrationListeners = new Set<() => void>();

/** Registers (or, with null, removes) the provider; notifies subscribed controls. */
export function registerPageTemplateProvider(provider: PageTemplateProvider | null): void {
    registeredProvider = provider;
    registrationListeners.forEach((listener) => listener());
}

/** The registered provider, or null when no extension supplies templates. */
export function getRegisteredPageTemplateProvider(): PageTemplateProvider | null {
    return registeredProvider;
}

/** Subscribes to registration changes (shape required by useSyncExternalStore). */
export function subscribeToPageTemplateProviderRegistration(listener: () => void): () => void {
    registrationListeners.add(listener);
    return () => { registrationListeners.delete(listener); };
}

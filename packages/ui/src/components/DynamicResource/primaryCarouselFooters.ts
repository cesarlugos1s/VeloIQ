/**
 * Footers of the primary view's carousel layout, per resource.
 *
 * The carousel layout of the primary view (view type "primary-carousel") shows
 * one record's page at a time. A host application that needs actions under
 * that page (e.g. decision buttons) registers a footer component for the
 * resource once, when its code loads; every carousel of that resource shows it.
 */
import type React from "react";

export interface PrimaryCarouselFooterProps {
    /** The record shown. */
    record: any;
    /** Take the record out of the carousel (e.g. after the user decided on it); the next one takes its place. */
    removeRecord: () => void;
}

const footersByResource = new Map<string, React.ComponentType<PrimaryCarouselFooterProps>>();

/** Register the footer of the carousel layout for `resource` (replacing any registered before). */
export function registerPrimaryCarouselFooter(resource: string, footer: React.ComponentType<PrimaryCarouselFooterProps>): void {
    footersByResource.set(resource, footer);
}

/** Return the footer registered for `resource`, if any. */
export function registeredPrimaryCarouselFooter(resource: string): React.ComponentType<PrimaryCarouselFooterProps> | undefined {
    return footersByResource.get(resource);
}

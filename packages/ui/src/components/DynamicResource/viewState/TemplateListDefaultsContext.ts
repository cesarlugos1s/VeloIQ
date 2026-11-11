/**
 * Defaults a page template gives the list block of the page that hosts it,
 * offered by the host page (StandardCrud) to the list inside it.
 */
import React from "react";

export const TemplateListDefaultsContext = React.createContext<{ fieldSequenceKeys: string[] }>({ fieldSequenceKeys: [] });

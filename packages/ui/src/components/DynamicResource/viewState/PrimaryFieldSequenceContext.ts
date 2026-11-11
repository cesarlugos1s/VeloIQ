/**
 * The visible fields of the host list page in sequence order, offered to the
 * primary (single record) views it shows, which apply them inside their
 * configured sections (see orderSectionFieldRows).
 */
import React from "react";

export const PrimaryFieldSequenceContext = React.createContext<string[]>([]);

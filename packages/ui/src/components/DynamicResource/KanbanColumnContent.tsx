/**
 * The content of one kanban column: the column's records shown by the standard DynamicList in the
 * chosen view type, so the column has that view type's own controls (search, filters, sorting,
 * column selector, paging).
 *
 * The records are held by an in-page rows store (see hooks/useInPageRowsStore), which answers the
 * list's requests; the records' links keep pointing to the model's own show pages.
 */
import React, { useEffect, useId, useMemo, useRef } from "react";
import { useInPageRowsStore } from "../../hooks/useInPageRowsStore";
import type { FieldDef, ModelDef } from "./types";
import type { KanbanColumnViewType } from "./utils/kanban";
import { DynamicList } from "./index";

export interface KanbanColumnContentProps {
    /** The model whose records the kanban shows. */
    model: ModelDef;
    allModels?: ModelDef[];
    /** The column's records. */
    records: any[];
    /** The fields the column's cards show. */
    cardFields: FieldDef[];
    viewType: KanbanColumnViewType;
    /** Position of the column in the board; with the board's id it names the column's store. */
    columnIndex: number;
}

export const KanbanColumnContent: React.FC<KanbanColumnContentProps> = ({ model, allModels, records, cardFields, viewType, columnIndex }) => {
    const boardId = useId().replace(/[^a-zA-Z0-9]/g, "");
    // The store is made again (with the records) when the shown fields change, as its model is fixed at creation.
    const storeName = `kanban_${boardId}_${columnIndex}_${cardFields.map((field) => field.key).join("_")}`;
    const rowModel = useMemo((): Omit<ModelDef, "resource"> => {
        const { resource: _ownResource, ...modelWithoutResource } = model;
        return {
            ...modelWithoutResource,
            fields: cardFields,
            // Records link to their own show pages; the column has no create, import or Analyze section.
            isNamedQuery: true,
            primaryResource: model.resource || model.name,
            showAnalyzeSection: false,
        };
    }, [model, cardFields]);
    const rowsStore = useInPageRowsStore(storeName, rowModel, records);

    // The store starts with the records; later changes of the records (filters, other column) replace its rows.
    const shownRecords = useRef(records);
    useEffect(() => {
        if (shownRecords.current === records) return;
        shownRecords.current = records;
        rowsStore.setRows(records);
    }, [records, rowsStore]);

    return <DynamicList key={rowsStore.model.resource} model={rowsStore.model} allModels={allModels} listViewType={viewType} isEmbedded />;
};

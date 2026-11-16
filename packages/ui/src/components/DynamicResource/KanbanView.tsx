/**
 * Kanban view: the records split into columns by the values of one or more fields, each column
 * showing its records with a view type (list by default) and its own paging.
 *
 * The component owns the kanban preferences (split fields, column view type, card fields) and the
 * column layout; each column's content is the standard DynamicList in the chosen view type
 * (KanbanColumnContent), so it has that view type's own controls.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import { resolveResourcePath } from "./utils/model";
import { Empty, Select, Space, Typography, theme } from "antd";
import type { FieldDef, ModelDef } from "./types";
import { KanbanColumnContent } from "./KanbanColumnContent";
import { getReferenceRecordTitle } from "./fields/ReferenceField";
import {
    DEFAULT_KANBAN_COLUMN_VIEW_TYPE,
    buildKanbanColumns,
    getDefaultKanbanSplitFieldKeys,
    getKanbanCardFieldOptions,
    getKanbanSplitFieldOptions,
    type KanbanColumnViewType,
} from "./utils/kanban";
import { getSelectableViewTypes } from "./utils/applicableViewTypes";
import { getViewTypeLabel } from "./utils/viewTypeCatalog";
import { useModelTone } from "../../utils/modelTone";
import { translateText } from "./utils/i18n";

// Resolved at call time — see utils/i18n.ts's translateText for why.
const _ = (text: string): string => translateText(text, text);

const { Text } = Typography;

/** A column is never narrower than this; it grows to its widest card, up to the maximum. */
const KANBAN_COLUMN_MINIMUM_WIDTH = 420;
const KANBAN_COLUMN_MAXIMUM_WIDTH = 720;
/** The board scrolls inside the room left under the page header and the view's own controls. */
const KANBAN_BOARD_MAX_HEIGHT = "calc(100vh - 280px)";

export interface KanbanViewProps {
    /** The model whose records the board shows (its fields are the frontend schema's). */
    model: ModelDef;
    allModels?: ModelDef[];
    /** The records to split into columns. */
    records: any[];
    /** The most columns shown (the [views] setting maximum_columns_in_kanban_view). */
    maximumColumns: number;
    /** Text of a record's value in a field (e.g. an option's label), used in the column headers. */
    formatValue: (field: FieldDef, record: any) => string;
    /** The view type of the columns' content when the user has not chosen (list by default). */
    initialColumnViewType?: KanbanColumnViewType;
    /** Buttons shown after the kanban's dropdowns (e.g. the toggle of the page's Analyze section). */
    toolbarExtra?: React.ReactNode;
    /** Page size of every column (the shared view state's page size). */
    pageSize?: number;
    /** Visible fields in the shared field sequence order; the cards show these (all card fields when empty). */
    fieldSequenceKeys?: string[];
}

const KanbanColumnPanel: React.FC<{
    label: string;
    records: any[];
    viewType: KanbanColumnViewType;
    cardFields: FieldDef[];
    columnIndex: number;
    pageSize?: number;
    model: ModelDef;
    allModels?: ModelDef[];
}> = ({ label, records, viewType, cardFields, columnIndex, pageSize, model, allModels }) => {
    const { token } = theme.useToken();
    // The title bar takes the model's tone: the colour scheme chosen in System Configuration.
    const tone = useModelTone(model);
    return (
        <div
            data-kanban-column={label}
            style={{
                flex: "0 0 auto",
                width: "max-content",
                minWidth: KANBAN_COLUMN_MINIMUM_WIDTH,
                maxWidth: KANBAN_COLUMN_MAXIMUM_WIDTH,
                display: "flex",
                flexDirection: "column",
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                background: token.colorBgContainer,
                boxShadow: `0 8px 20px -16px ${tone.shadow}`,
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    padding: "8px 12px",
                    background: tone.soft,
                    borderBottom: `1px solid ${tone.border}`,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                }}
            >
                <Text strong style={{ overflowWrap: "anywhere", color: tone.text }}>{label}</Text>
                <Text style={{ fontSize: 12, whiteSpace: "nowrap", color: tone.text, opacity: 0.65 }}>({records.length})</Text>
            </div>
            <div style={{ padding: 12, flex: 1, minHeight: 0, minWidth: 0, overflowX: "auto" }}>
                <KanbanColumnContent
                    model={model}
                    allModels={allModels}
                    records={records}
                    cardFields={cardFields}
                    viewType={viewType}
                    columnIndex={columnIndex}
                    pageSize={pageSize}
                />
            </div>
        </div>
    );
};

export const KanbanView: React.FC<KanbanViewProps> = (props) => {
    const { model, allModels, records, maximumColumns, formatValue, initialColumnViewType, toolbarExtra, pageSize, fieldSequenceKeys } = props;
    const fields = model.fields;
    const splitFieldOptions = useMemo(() => getKanbanSplitFieldOptions(fields), [fields]);
    const cardFieldOptions = useMemo(() => getKanbanCardFieldOptions(fields), [fields]);

    const [splitFieldKeys, setSplitFieldKeys] = useState<string[]>(() => getDefaultKanbanSplitFieldKeys(fields));
    const [chosenColumnViewType, setColumnViewType] = useState<KanbanColumnViewType>(initialColumnViewType ?? DEFAULT_KANBAN_COLUMN_VIEW_TYPE);
    // Only the view types that suit the model's fields are offered; a choice that does not suit falls back to the default.
    const applicableColumnViewTypes = useMemo(() => getSelectableViewTypes("kanban-column", model) as KanbanColumnViewType[], [model]);
    const columnViewType = applicableColumnViewTypes.includes(chosenColumnViewType) ? chosenColumnViewType : DEFAULT_KANBAN_COLUMN_VIEW_TYPE;

    const splitFields = useMemo(
        () => splitFieldKeys.map((key) => fields.find((field) => field.key === key)).filter((field): field is FieldDef => Boolean(field)),
        [fields, splitFieldKeys],
    );
    // The cards show the shared field sequence, in its order.
    const cardFields = useMemo(() => {
        const fromSequence = (fieldSequenceKeys ?? [])
            .map((key) => cardFieldOptions.find((field) => field.key === key))
            .filter((field): field is FieldDef => Boolean(field));
        return fromSequence.length > 0 ? fromSequence : cardFieldOptions;
    }, [fieldSequenceKeys, cardFieldOptions]);
    // A foreign key split field shows the related record's title (dc_title(), fetched as the Show page does), not the id.
    const apiUrl = useApiUrl();
    const [referenceTitles, setReferenceTitles] = useState<Record<string, string>>({});
    // Keys already requested live in a ref and responses are kept after a re-render: the parents
    // (e.g. the related lists) pass a new records array on every render, which must not drop in-flight fetches.
    const requestedTitleKeys = useRef<Set<string>>(new Set());
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
    useEffect(() => {
        splitFields.filter((field) => field.reference).forEach((field) => {
            records.forEach((record) => {
                const id = record?.[field.key];
                if (id === undefined || id === null || id === "") return;
                const cacheKey = `${field.reference}:${id}`;
                if (requestedTitleKeys.current.has(cacheKey)) return;
                requestedTitleKeys.current.add(cacheKey);
                const resourcePath = field.referencePath || resolveResourcePath(field.reference as string, allModels);
                authenticatedFetch(`${apiUrl}/${resourcePath}/${id}`)
                    .then(async (response) => {
                        if (!response.ok) throw new Error(String(response.status));
                        const data = await response.json();
                        if (!isMounted.current) return;
                        const title = String(getReferenceRecordTitle(data, id));
                        setReferenceTitles((previous) => (previous[cacheKey] === title ? previous : { ...previous, [cacheKey]: title }));
                    })
                    .catch(() => { requestedTitleKeys.current.delete(cacheKey); /* best-effort: the column keeps the raw value */ });
            });
        });
    }, [records, splitFields, apiUrl, allModels]);
    const formatColumnValue = useMemo(
        () => (field: FieldDef, record: any): string => {
            if (field.reference) {
                const title = referenceTitles[`${field.reference}:${record?.[field.key]}`];
                if (title !== undefined) return title;
            }
            return formatValue(field, record);
        },
        [referenceTitles, formatValue],
    );
    const columns = useMemo(
        () => buildKanbanColumns(records, splitFields, maximumColumns, formatColumnValue, _("(empty)"), _("All")),
        [records, splitFields, maximumColumns, formatColumnValue],
    );

    return (
        <div style={{ display: "grid", gap: 12 }}>
            <Space wrap size={8} align="start">
                <Select
                    size="small"
                    mode="multiple"
                    allowClear
                    maxTagCount="responsive"
                    value={splitFieldKeys}
                    onChange={setSplitFieldKeys}
                    options={splitFieldOptions.map((field) => ({ label: field.label, value: field.key }))}
                    style={{ minWidth: 240 }}
                    placeholder={_("Split columns by")}
                    aria-label={_("Split columns by")}
                />
                <Select
                    size="small"
                    value={columnViewType}
                    onChange={setColumnViewType}
                    options={applicableColumnViewTypes.map((viewType) => ({ label: getViewTypeLabel(viewType), value: viewType }))}
                    style={{ minWidth: 140 }}
                    aria-label={_("Column view type")}
                />
                {toolbarExtra}
            </Space>
            {columns.length === 0 ? (
                <Empty description={_("No records available")} />
            ) : (
                <div
                    data-kanban-board
                    style={{ overflow: "auto", maxHeight: KANBAN_BOARD_MAX_HEIGHT, paddingBottom: 4 }}
                >
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", width: "max-content", minWidth: "100%" }}>
                        {columns.map((column, columnIndex) => (
                            <KanbanColumnPanel
                                key={column.label}
                                label={column.label}
                                records={column.records}
                                viewType={columnViewType}
                                cardFields={cardFields}
                                columnIndex={columnIndex}
                                pageSize={pageSize}
                                model={model}
                                allModels={allModels}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default KanbanView;

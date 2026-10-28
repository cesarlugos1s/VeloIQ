/**
 * Kanban view: the records split into columns by the values of one or more fields, each column
 * showing its records with a view type (list by default) and its own paging.
 *
 * The component owns the kanban preferences (split fields, column view type, card fields) and the
 * column layout; each column's content is the standard DynamicList in the chosen view type
 * (KanbanColumnContent), so it has that view type's own controls.
 */
import React, { useMemo, useState } from "react";
import { Empty, Select, Space, Typography, theme } from "antd";
import type { FieldDef, ModelDef } from "./types";
import { KanbanColumnContent } from "./KanbanColumnContent";
import {
    DEFAULT_KANBAN_COLUMN_VIEW_TYPE,
    KANBAN_COLUMN_VIEW_TYPES,
    buildKanbanColumns,
    getDefaultKanbanSplitFieldKeys,
    getKanbanCardFieldOptions,
    getKanbanSplitFieldOptions,
    type KanbanColumnViewType,
} from "./utils/kanban";
import { translateText } from "./utils/i18n";

// Resolved at call time — see utils/i18n.ts's translateText for why.
const _ = (text: string): string => translateText(text, text);

const { Text } = Typography;

const KANBAN_COLUMN_WIDTH = 420;
/** The board scrolls inside the room left under the page header and the view's own controls. */
const KANBAN_BOARD_MAX_HEIGHT = "calc(100vh - 280px)";

const COLUMN_VIEW_TYPE_LABELS: Record<KanbanColumnViewType, string> = {
    list: "List",
    table: "Table",
    gallery: "Gallery",
    image: "Image",
    primary: "Primary",
    "totals-details": "Totals / Details",
    crosstab: "Crosstab",
    calendar: "Calendar",
};

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
}

const KanbanColumnPanel: React.FC<{
    label: string;
    records: any[];
    viewType: KanbanColumnViewType;
    cardFields: FieldDef[];
    columnIndex: number;
    model: ModelDef;
    allModels?: ModelDef[];
}> = ({ label, records, viewType, cardFields, columnIndex, model, allModels }) => {
    const { token } = theme.useToken();
    return (
        <div
            data-kanban-column={label}
            style={{
                flex: `0 0 ${KANBAN_COLUMN_WIDTH}px`,
                width: KANBAN_COLUMN_WIDTH,
                display: "flex",
                flexDirection: "column",
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 8,
                background: token.colorBgContainer,
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    padding: "8px 12px",
                    background: token.colorFillAlter,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                }}
            >
                <Text strong style={{ overflowWrap: "anywhere" }}>{label}</Text>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>({records.length})</Text>
            </div>
            <div style={{ padding: 12, flex: 1, minHeight: 0, minWidth: 0, overflowX: "auto" }}>
                <KanbanColumnContent
                    model={model}
                    allModels={allModels}
                    records={records}
                    cardFields={cardFields}
                    viewType={viewType}
                    columnIndex={columnIndex}
                />
            </div>
        </div>
    );
};

export const KanbanView: React.FC<KanbanViewProps> = (props) => {
    const { model, allModels, records, maximumColumns, formatValue, initialColumnViewType, toolbarExtra } = props;
    const fields = model.fields;
    const splitFieldOptions = useMemo(() => getKanbanSplitFieldOptions(fields), [fields]);
    const cardFieldOptions = useMemo(() => getKanbanCardFieldOptions(fields), [fields]);

    const [splitFieldKeys, setSplitFieldKeys] = useState<string[]>(() => getDefaultKanbanSplitFieldKeys(fields));
    const [columnViewType, setColumnViewType] = useState<KanbanColumnViewType>(initialColumnViewType ?? DEFAULT_KANBAN_COLUMN_VIEW_TYPE);
    const [cardFieldKeys, setCardFieldKeys] = useState<string[]>(() => cardFieldOptions.map((field) => field.key));

    const splitFields = useMemo(
        () => splitFieldKeys.map((key) => fields.find((field) => field.key === key)).filter((field): field is FieldDef => Boolean(field)),
        [fields, splitFieldKeys],
    );
    const cardFields = useMemo(
        () => cardFieldOptions.filter((field) => cardFieldKeys.includes(field.key)),
        [cardFieldKeys, cardFieldOptions],
    );
    const columns = useMemo(
        () => buildKanbanColumns(records, splitFields, maximumColumns, formatValue, _("(empty)"), _("All")),
        [records, splitFields, maximumColumns, formatValue],
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
                    options={KANBAN_COLUMN_VIEW_TYPES.map((viewType) => ({ label: _(COLUMN_VIEW_TYPE_LABELS[viewType]), value: viewType }))}
                    style={{ minWidth: 140 }}
                    aria-label={_("Column view type")}
                />
                <Select
                    size="small"
                    mode="multiple"
                    allowClear
                    maxTagCount="responsive"
                    value={cardFieldKeys}
                    onChange={setCardFieldKeys}
                    options={cardFieldOptions.map((field) => ({ label: field.label, value: field.key }))}
                    style={{ minWidth: 260 }}
                    placeholder={_("Fields shown in the cards")}
                    aria-label={_("Fields shown in the cards")}
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

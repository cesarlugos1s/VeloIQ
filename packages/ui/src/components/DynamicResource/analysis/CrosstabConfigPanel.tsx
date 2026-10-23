import React from "react";
import { Button, Collapse, Select, Tooltip, theme } from "antd";
import { SaveOutlined, SettingOutlined } from "@ant-design/icons";
import type { ModelDef } from "../types";
import { isPkField } from "../utils/model";
import { getSummaryFnOptions } from "./aggregation";
import type { AnalyzeSettings } from "./useAnalyze";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/** Props of {@link CrosstabConfigPanel}. */
export interface CrosstabConfigPanelProps {
    /** State returned by `useAnalyzeSettings`; the crosstab shares the Analyze configuration. */
    analyze: AnalyzeSettings;
    /** Model shown in the crosstab. */
    model: ModelDef;
    /** Opens the page's "save view" dialog for the Analyze preferences. */
    /** Saves the configuration as a view; without it (saved views switched off) there is no save button. */
    onSaveClick?: () => void;
}

/**
 * Collapsible configuration of the crosstab view (rows, columns, Category 3 added to the columns, cell fields,
 * summary function and filter fields), shared by list pages and relation views.
 */
export const CrosstabConfigPanel: React.FC<CrosstabConfigPanelProps> = ({ analyze, model, onSaveClick }) => {
    const { token } = theme.useToken();
    const {
        categoricalFields,
        categoryField1,
        setCategoryField1,
        categoryField2,
        setCategoryField2,
        categoryField3,
        setCategoryField3,
        selectedSeriesKeys,
        setSelectedSeriesKeys,
        summaryFn,
        setSummaryFn,
        crosstabFilterFields,
        setCrosstabFilterFields,
        isSavingAnalyzePrefs,
        markAnalyzePrefsTouched,
    } = analyze;
    const controlLabelStyle: React.CSSProperties = { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 };

    return (
        <Collapse
            size="small"
            defaultActiveKey={[]}
            style={{ marginBottom: 12 }}
            items={[{
                key: "crosstab-config",
                label: <Tooltip title={_("Crosstab configuration")}><span><SettingOutlined /></span></Tooltip>,
                children: (
                    <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 200, flex: 1 }}>
                                <div style={controlLabelStyle}>{_("Category 1 (rows)")}</div>
                                <Select
                                    value={categoryField1 || undefined}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setCategoryField1(value); }}
                                    style={{ width: "100%" }}
                                    options={categoricalFields.map((field) => ({ label: field.label, value: field.key }))}
                                    placeholder={_("Select category")}
                                />
                            </div>
                            <div style={{ minWidth: 200, flex: 1 }}>
                                <div style={controlLabelStyle}>{_("Category 2 (columns)")}</div>
                                <Select
                                    value={categoryField2 || "__none__"}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setCategoryField2(value === "__none__" ? null : value); }}
                                    style={{ width: "100%" }}
                                    options={[
                                        { label: _("None"), value: "__none__" },
                                        ...categoricalFields.filter((field) => field.key !== categoryField1).map((field) => ({ label: field.label, value: field.key })),
                                    ]}
                                />
                            </div>
                            <div style={{ minWidth: 200, flex: 1 }}>
                                <div style={controlLabelStyle}>{_("Category 3 (columns)")}</div>
                                <Select
                                    value={categoryField3 || "__none__"}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setCategoryField3(value === "__none__" ? null : value); }}
                                    style={{ width: "100%" }}
                                    options={[
                                        { label: _("None"), value: "__none__" },
                                        ...categoricalFields
                                            .filter((field) => field.key !== categoryField1 && field.key !== categoryField2)
                                            .map((field) => ({ label: field.label, value: field.key })),
                                    ]}
                                />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 200, flex: 1 }}>
                                <div style={controlLabelStyle}>{_("Cell fields")}</div>
                                <Select
                                    mode="multiple"
                                    allowClear
                                    value={selectedSeriesKeys || []}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setSelectedSeriesKeys(value); }}
                                    style={{ width: "100%" }}
                                    options={model.fields.filter((field) => !isPkField(field, model)).map((field) => ({ label: field.label, value: field.key }))}
                                    placeholder={_("All numeric fields")}
                                    maxTagCount="responsive"
                                />
                            </div>
                            <div style={{ minWidth: 150 }}>
                                <div style={controlLabelStyle}>{_("Summary")}</div>
                                <Select
                                    value={summaryFn}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setSummaryFn(value); }}
                                    style={{ width: "100%" }}
                                    options={getSummaryFnOptions()}
                                />
                            </div>
                            <div style={{ minWidth: 200, flex: 1 }}>
                                <div style={controlLabelStyle}>{_("Filter fields")}</div>
                                <Select
                                    mode="multiple"
                                    allowClear
                                    value={crosstabFilterFields}
                                    onChange={(value) => { markAnalyzePrefsTouched(); setCrosstabFilterFields(value); }}
                                    style={{ width: "100%" }}
                                    options={categoricalFields.map((field) => ({ label: field.label, value: field.key }))}
                                    placeholder={_("Select filter fields")}
                                    maxTagCount="responsive"
                                />
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <Tooltip title={_("Save configuration")}>
                                {onSaveClick && <Button size="small" icon={<SaveOutlined />} onClick={onSaveClick} loading={isSavingAnalyzePrefs} aria-label={_("Save configuration")} />}
                            </Tooltip>
                        </div>
                    </div>
                ),
            }]}
        />
    );
};

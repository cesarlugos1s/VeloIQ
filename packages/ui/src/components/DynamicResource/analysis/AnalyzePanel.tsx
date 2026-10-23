import React from "react";
import { Alert, Button, Card, Checkbox, Collapse, InputNumber, Select, Spin, Table, Tooltip, theme } from "antd";
import {
    BarChartOutlined,
    CloseCircleOutlined,
    DownloadOutlined,
    FilePdfOutlined,
    FileTextOutlined,
    SaveOutlined,
} from "@ant-design/icons";
import type { ModelTone } from "../../../utils/modelTone";
import type { FieldDef } from "../types";
import { formatNumberValue } from "../utils/formatting";
import { renderStatBar } from "../utils/statistics";
import { isDarkColor } from "../utils/colors";
import { AnalysisChart } from "./AnalysisChart";
import { CrosstabTable } from "./CrosstabTable";
import { ChartTypeIcon } from "./ChartTypeIcon";
import { COUNT_SERIES_KEY, getSummaryFnOptions } from "./aggregation";
import { getChartTypeLabel, getFrontendChartTypes } from "./chartCatalog";
import type { AnalyzeChartType, AnalyzeState, RankingMode } from "./useAnalyze";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/** Chart-type options of the "Chart Type" selector: catalogue icon and translated label. */
const getChartTypeOptions = (): Array<{ label: React.ReactNode; value: AnalyzeChartType; title: string }> =>
    getFrontendChartTypes().map((def) => ({
        value: def.id,
        title: getChartTypeLabel(def.id),
        label: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <ChartTypeIcon chartType={def.id} />
                {getChartTypeLabel(def.id)}
            </span>
        ),
    }));

/** Props of {@link AnalyzePanel}. */
export interface AnalyzePanelProps {
    /** State returned by `useAnalyzeResults`. */
    analyze: AnalyzeState;
    /** Every field of the analysed model (the chart resolves category fields from them). */
    allFields: FieldDef[];
    /** Colour tone of the analysed model, used for the statistics titles. */
    tone: ModelTone;
    /** Fill colour of the in-cell value bars (crosstab chart type). */
    numericBarColor: string;
    /** Opens the page's "save view" dialog for the Analyze preferences. */
    /** Saves the configuration as a view; without it (saved views switched off) there is no save button. */
    onSaveClick?: () => void;
    /** Optional status lines shown under the chart controls (for example a loading message). */
    customizeFooter?: React.ReactNode;
}

/**
 * The Analyze card shared by list pages and relation views.
 *
 * The front shows the chart (a Plotly chart, or the crosstab table), its
 * actions (save preferences, statistics, export PDF, export PNG -- the exports
 * are hidden for the crosstab, which is a table) and the "Customize chart"
 * controls. The back shows
 * the statistics of the analysed rows with a PDF export. All state comes from
 * `useAnalyzeSettings` and `useAnalyzeResults`.
 */
export const AnalyzePanel: React.FC<AnalyzePanelProps> = ({
    analyze,
    allFields,
    tone,
    numericBarColor,
    onSaveClick,
    customizeFooter,
}) => {
    const { token } = theme.useToken();
    const {
        categoricalFields,
        numericFields,
        categoryField1,
        setCategoryField1,
        categoryField2,
        setCategoryField2,
        categoryField3,
        setCategoryField3,
        chartType,
        setChartType,
        summaryFn,
        setSummaryFn,
        selectedSeriesKeys,
        setSelectedSeriesKeys,
        rankingMode,
        setRankingMode,
        rankingFieldKey,
        setRankingFieldKey,
        rankingN,
        setRankingN,
        isStatsFlipped,
        setIsStatsFlipped,
        isSavingAnalyzePrefs,
        chartGraphRef,
        markAnalyzePrefsTouched,
        formatCategoryValue,
        categoryLabelOf,
        rowCategoryLabelOf,
        columnCategoryLabelOf,
        cellRows,
        cellSummaryFn,
        sampleInfo,
        serverAggregation,
        chartData,
        chartTitle,
        statsSummary,
        statsNumericMaxes,
        exportChartImage,
        exportChartPdf,
        exportStatsPdf,
    } = analyze;

    const valueBackground = isDarkColor(token.colorBgBase || token.colorBgContainer)
        ? token.colorFillQuaternary
        : "#F9FFFF";
    const statsLabelStyle: React.CSSProperties = {
        background: valueBackground,
        borderRadius: 4,
        padding: "2px 6px",
        display: "inline-block",
    };
    const statsHeaderStyle: React.CSSProperties = { background: valueBackground };
    const statsTitleStyle: React.CSSProperties = { color: tone.solid, margin: 0 };
    const controlLabelStyle: React.CSSProperties = { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 };
    const isCrosstab = chartType === "crosstab";
    // Charts that plot individual rows: above the server-aggregation threshold they draw a sample.
    const plotsIndividualRows = (["scatter", "bubble", "scatter3d", "histogram", "box"] as AnalyzeChartType[]).includes(chartType);
    // Above the threshold, nothing is drawn until the server's first aggregation arrives.
    const waitingForServer = Boolean(serverAggregation && !serverAggregation.hasResult && !serverAggregation.error);
    // Which selected series fill the numeric axes of scatter, bubble and 3D charts (Series 1, 2, 3).
    const axisRoles: Partial<Record<AnalyzeChartType, string[]>> = {
        scatter: [_("X"), _("Y")],
        bubble: [_("X"), _("Y"), _("Bubble size")],
        scatter3d: [_("X"), _("Y"), _("Z")],
    };
    const axisSeries = chartData.seriesKeys.filter((key) => key !== COUNT_SERIES_KEY);
    const axisHint = axisRoles[chartType] && axisSeries.length > 0
        ? axisRoles[chartType]!
            .map((role, index) => `${role}: ${chartData.seriesLabels[axisSeries[Math.min(index, axisSeries.length - 1)]] || ""}`)
            .join(" · ")
        : null;
    // Category 3 options: any categorical field not already used as Category 1 or 2.
    const category3Options = [
        { label: _("None"), value: "__none__" },
        ...categoricalFields
            .filter((field) => field.key !== categoryField1 && field.key !== categoryField2)
            .map((field) => ({ label: field.label, value: field.key })),
    ];

    return (
        <Card
            size="small"
            // No header bar: its title was always "Analyze", and the chart carries its own
            // title and toolbar. The label stays for screen readers.
            aria-label={_("Analyze")}
            styles={{ body: { padding: 0 } }}
        >
            <div style={{ perspective: 1600, padding: 12 }}>
                <div
                    style={{
                        display: "grid",
                        transformStyle: "preserve-3d",
                        transition: "transform 0.6s",
                        transform: isStatsFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                >
                    <Card
                        size="small"
                        style={{
                            gridArea: "1 / 1",
                            backfaceVisibility: "hidden",
                            pointerEvents: isStatsFlipped ? "none" : "auto",
                        }}
                        styles={{ body: { display: "grid", gap: 16, position: "relative", paddingTop: 48 } }}
                    >
                        <div style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 8 }}>
                            <Tooltip title={_("Save preferences")}>
                                {onSaveClick && <Button size="small" icon={<SaveOutlined />} onClick={onSaveClick} loading={isSavingAnalyzePrefs} />}
                            </Tooltip>
                            <Tooltip title={_("Stats")}>
                                <Button size="small" icon={<FileTextOutlined />} onClick={() => setIsStatsFlipped(true)} />
                            </Tooltip>
                            {!isCrosstab && (
                                <Tooltip title={_("Export chart PDF")}>
                                    <Button size="small" icon={<FilePdfOutlined />} onClick={exportChartPdf} />
                                </Tooltip>
                            )}
                            {!isCrosstab && (
                                <Tooltip title={_("Export chart PNG")}>
                                    <Button size="small" icon={<DownloadOutlined />} onClick={exportChartImage} aria-label={_("Export chart")} />
                                </Tooltip>
                            )}
                        </div>
                        {serverAggregation?.error && (
                            <Alert type="error" showIcon message={serverAggregation.error} />
                        )}
                        {waitingForServer ? (
                            <div style={{ padding: 48, textAlign: "center", color: token.colorTextSecondary }}>
                                <Spin />
                                <div style={{ marginTop: 12 }}>{_("Aggregating on the server...")}</div>
                            </div>
                        ) : isCrosstab ? (
                            <CrosstabTable
                                rows={cellRows}
                                rowField={categoryField1}
                                colField={categoryField2 ?? categoryField1}
                                colField3={categoryField3}
                                cellFieldKeys={chartData.seriesKeys}
                                cellFieldLabels={chartData.seriesLabels}
                                allFields={allFields}
                                summaryFn={cellSummaryFn}
                                formatCategoryValue={formatCategoryValue}
                                numericBarColor={numericBarColor}
                                caption={chartTitle}
                            />
                        ) : (
                            <AnalysisChart
                                chartType={chartType}
                                data={chartData.groups}
                                seriesKeys={chartData.seriesKeys}
                                seriesLabels={chartData.seriesLabels}
                                rawRows={chartData.filteredRawRows}
                                categoryLabelOf={categoryLabelOf}
                                rowCategoryLabelOf={rowCategoryLabelOf}
                                columnCategoryLabelOf={columnCategoryLabelOf}
                                summaryFn={summaryFn}
                                cellRows={cellRows}
                                cellSummaryFn={cellSummaryFn}
                                title={chartTitle}
                                graphRef={chartGraphRef}
                            />
                        )}
                        {!waitingForServer && sampleInfo && plotsIndividualRows && (
                            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                                {_("Showing a sample of {shown} of {total} rows")
                                    .replace("{shown}", sampleInfo.shown.toLocaleString())
                                    .replace("{total}", sampleInfo.total.toLocaleString())}
                            </div>
                        )}
                        <Collapse
                            size="small"
                            defaultActiveKey={[]}
                            items={[
                                {
                                    key: "configure-chart",
                                    label: _("Customize chart"),
                                    children: (
                                        <div style={{ display: "grid", gap: 16 }}>
                                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                                                <div style={{ minWidth: 220, flex: 1 }}>
                                                    <div style={controlLabelStyle}>{_("Category 1")}</div>
                                                    <Select
                                                        value={categoryField1 || undefined}
                                                        onChange={(value) => {
                                                            markAnalyzePrefsTouched();
                                                            setCategoryField1(value);
                                                        }}
                                                        style={{ width: "100%" }}
                                                        options={categoricalFields.map((field) => ({ label: field.label, value: field.key }))}
                                                        placeholder={_("Select category")}
                                                    />
                                                </div>
                                                <div style={{ minWidth: 220, flex: 1 }}>
                                                    <div style={controlLabelStyle}>{_("Category 2")}</div>
                                                    <Select
                                                        value={categoryField2 || "__none__"}
                                                        onChange={(value) => {
                                                            markAnalyzePrefsTouched();
                                                            setCategoryField2(value === "__none__" ? null : value);
                                                        }}
                                                        style={{ width: "100%" }}
                                                        options={[
                                                            { label: _("None"), value: "__none__" },
                                                            ...categoricalFields
                                                                .filter((field) => field.key !== categoryField1)
                                                                .map((field) => ({ label: field.label, value: field.key })),
                                                        ]}
                                                    />
                                                </div>
                                                <div style={{ minWidth: 220, flex: 1 }}>
                                                    <div style={controlLabelStyle}>{_("Category 3")}</div>
                                                    <Select
                                                        value={categoryField3 || "__none__"}
                                                        onChange={(value) => {
                                                            markAnalyzePrefsTouched();
                                                            setCategoryField3(value === "__none__" ? null : value);
                                                        }}
                                                        style={{ width: "100%" }}
                                                        options={category3Options}
                                                    />
                                                </div>
                                                <div style={{ minWidth: 200 }}>
                                                    <div style={controlLabelStyle}>{_("Chart Type")}</div>
                                                    <Select
                                                        value={chartType}
                                                        onChange={(value) => {
                                                            markAnalyzePrefsTouched();
                                                            setChartType(value);
                                                        }}
                                                        style={{ width: "100%" }}
                                                        options={getChartTypeOptions()}
                                                        optionLabelProp="label"
                                                        showSearch
                                                        optionFilterProp="title"
                                                    />
                                                </div>
                                                <div style={{ minWidth: 200 }}>
                                                    <div style={controlLabelStyle}>{_("Summary")}</div>
                                                    <Select
                                                        value={summaryFn}
                                                        onChange={(value) => {
                                                            markAnalyzePrefsTouched();
                                                            setSummaryFn(value);
                                                        }}
                                                        style={{ width: "100%" }}
                                                        options={getSummaryFnOptions()}
                                                    />
                                                </div>
                                                <div style={{ minWidth: 180 }}>
                                                    <div style={controlLabelStyle}>{_("Ranking Filter")}</div>
                                                    <Select<RankingMode>
                                                        value={rankingMode}
                                                        onChange={(value) => {
                                                            markAnalyzePrefsTouched();
                                                            setRankingMode(value);
                                                        }}
                                                        style={{ width: "100%" }}
                                                        options={[
                                                            { label: _("None"), value: "none" },
                                                            { label: _("Top N"), value: "top" },
                                                            { label: _("Bottom N"), value: "bottom" },
                                                        ]}
                                                    />
                                                </div>
                                                <div style={{ minWidth: 220 }}>
                                                    <div style={controlLabelStyle}>{_("Ranking Column")}</div>
                                                    <Select
                                                        value={rankingFieldKey || undefined}
                                                        onChange={(value) => {
                                                            markAnalyzePrefsTouched();
                                                            setRankingFieldKey(value);
                                                        }}
                                                        style={{ width: "100%" }}
                                                        options={numericFields.map((field) => ({ label: field.label, value: field.key }))}
                                                        placeholder={_("Select numeric column")}
                                                        disabled={rankingMode === "none" || numericFields.length === 0}
                                                    />
                                                </div>
                                                <div style={{ minWidth: 120 }}>
                                                    <div style={controlLabelStyle}>{_("N")}</div>
                                                    <InputNumber
                                                        min={1}
                                                        value={rankingN}
                                                        onChange={(value) => {
                                                            markAnalyzePrefsTouched();
                                                            const nextN = Number(value);
                                                            setRankingN(Number.isFinite(nextN) && nextN > 0 ? Math.floor(nextN) : 10);
                                                        }}
                                                        style={{ width: "100%" }}
                                                        disabled={rankingMode === "none"}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                                                    <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{_("Series")}</div>
                                                    <Tooltip title={_("Unselect All")}>
                                                        <Button
                                                            size="small"
                                                            icon={<CloseCircleOutlined />}
                                                            onClick={() => {
                                                                markAnalyzePrefsTouched();
                                                                setSelectedSeriesKeys([]);
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </div>
                                                <Checkbox.Group
                                                    value={selectedSeriesKeys || []}
                                                    onChange={(values) => {
                                                        markAnalyzePrefsTouched();
                                                        setSelectedSeriesKeys(values as string[]);
                                                    }}
                                                    options={
                                                        numericFields.length > 0
                                                            ? numericFields.map((field) => ({ label: field.label, value: field.key }))
                                                            : [{ label: _("Count"), value: COUNT_SERIES_KEY }]
                                                    }
                                                />
                                                {axisHint && (
                                                    <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 6 }}>{axisHint}</div>
                                                )}
                                            </div>
                                            {customizeFooter}
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </Card>
                    <Card
                        size="small"
                        style={{
                            gridArea: "1 / 1",
                            backfaceVisibility: "hidden",
                            transform: "rotateY(180deg)",
                            pointerEvents: isStatsFlipped ? "auto" : "none",
                        }}
                        styles={{ body: { display: "grid", gap: 16, position: "relative", paddingTop: 48 } }}
                    >
                        <div style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 8 }}>
                            <Tooltip title={_("Analysis")}>
                                <Button size="small" icon={<BarChartOutlined />} onClick={() => setIsStatsFlipped(false)} />
                            </Tooltip>
                            <Tooltip title={_("Export stats PDF")}>
                                <Button size="small" icon={<FilePdfOutlined />} onClick={exportStatsPdf} />
                            </Tooltip>
                        </div>
                        <div style={{ display: "grid", gap: 16 }}>
                            {statsSummary.numericStats.length > 0 && (
                                <Card size="small" title={<span style={statsTitleStyle}>{_("Numeric columns")}</span>}>
                                    <Table
                                        dataSource={statsSummary.numericStats}
                                        size="small"
                                        pagination={false}
                                        rowKey={(row) => row.key}
                                    >
                                        <Table.Column
                                            title={_("Field")}
                                            dataIndex="label"
                                            key="label"
                                            render={(label: string) => <span style={statsLabelStyle}>{label}</span>}
                                            onHeaderCell={() => ({ style: statsHeaderStyle })}
                                        />
                                        <Table.Column title={_("Sum")} key="sum" align="right" render={(_unused, row: any) => renderStatBar(row.sum, statsNumericMaxes.sum, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                        <Table.Column title={_("Average")} key="avg" align="right" render={(_unused, row: any) => renderStatBar(row.avg, statsNumericMaxes.avg, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                        <Table.Column title={_("Min")} key="min" align="right" render={(_unused, row: any) => renderStatBar(row.min, statsNumericMaxes.min, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                        <Table.Column title={_("Max")} key="max" align="right" render={(_unused, row: any) => renderStatBar(row.max, statsNumericMaxes.max, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                        <Table.Column title={_("Std Dev")} key="stddev" align="right" render={(_unused, row: any) => renderStatBar(row.stddev, statsNumericMaxes.stddev, formatNumberValue)} onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                    </Table>
                                </Card>
                            )}
                            {statsSummary.categoricalStats.length > 0 && (
                                <Collapse
                                    size="small"
                                    defaultActiveKey={[]}
                                    items={[
                                        {
                                            key: "categorical-columns",
                                            label: <span style={statsTitleStyle}>{_("Categorical columns (distinct < 20)")}</span>,
                                            children: statsSummary.categoricalStats.map((field) => (
                                                <div key={field.key} style={{ marginBottom: 12 }}>
                                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                                        <span style={statsLabelStyle}>{field.label}</span>
                                                    </div>
                                                    <Table
                                                        dataSource={field.counts}
                                                        size="small"
                                                        pagination={false}
                                                        rowKey={(row) => row.value}
                                                    >
                                                        <Table.Column title={_("Value")} dataIndex="value" key="value" onHeaderCell={() => ({ style: statsHeaderStyle })} />
                                                        <Table.Column
                                                            title={_("Count")}
                                                            dataIndex="count"
                                                            key="count"
                                                            align="right"
                                                            onHeaderCell={() => ({ style: statsHeaderStyle })}
                                                            render={(value: number) => {
                                                                const maxCount = Math.max(1, ...field.counts.map((entry) => entry.count));
                                                                return renderStatBar(value, maxCount, (val) => formatNumberValue(val));
                                                            }}
                                                        />
                                                    </Table>
                                                </div>
                                            )),
                                        },
                                    ]}
                                />
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </Card>
    );
};

import React from "react";
import { theme, Empty } from "antd";
import type { FieldDef } from "../types";
import { CrosstabTable } from "./CrosstabTable";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const AnalysisChart: React.FC<{
    data: { key: string; label: string; values: Record<string, number> }[];
    seriesKeys: string[];
    seriesLabels: Record<string, string>;
    chartType: "bar" | "line" | "area" | "stacked" | "pie" | "donut" | "bar-horizontal" | "stacked-horizontal" | "area-horizontal" | "scatter" | "bubble" | "histogram" | "box" | "boxplot" | "waterfall" | "heatmap" | "crosstab" | "radar" | "combo" | "3d";
    svgRef?: React.RefObject<SVGSVGElement>;
    animationKey: number;
    animationStage: "enter" | "update";
    rawRows: any[];
    numericFields: FieldDef[];
    allFields: FieldDef[];
    categoryField1: string | null;
    categoryField2: string | null | undefined;
    formatCategoryValue: (field: FieldDef | undefined, record: any) => string;
    summaryFn: "sum" | "avg" | "count" | "max" | "min" | "stddev";
    title: string;
    numericBarColor: string;
}> = ({
    data,
    seriesKeys,
    seriesLabels,
    chartType,
    svgRef,
    animationKey,
    animationStage,
    rawRows,
    numericFields,
    allFields,
    categoryField1,
    categoryField2,
    formatCategoryValue,
    summaryFn,
    title,
    numericBarColor,
}) => {
    const { token } = theme.useToken();
    const width = 1000;
    const isHorizontal = chartType === "bar-horizontal" || chartType === "stacked-horizontal" || chartType === "area-horizontal";
    const hasXAxisLabels =
        !isHorizontal &&
        (chartType === "bar" ||
            chartType === "line" ||
            chartType === "area" ||
            chartType === "stacked" ||
            chartType === "combo" ||
            chartType === "histogram" ||
            chartType === "box" ||
            chartType === "waterfall" ||
            chartType === "heatmap");
    const usesLegend =
        chartType === "pie" ||
        chartType === "donut" ||
        chartType === "scatter" ||
        chartType === "bubble" ||
        chartType === "bar" ||
        chartType === "line" ||
        chartType === "area" ||
        chartType === "stacked" ||
        chartType === "bar-horizontal" ||
        chartType === "stacked-horizontal" ||
        chartType === "area-horizontal" ||
        chartType === "combo";
    const basePaddingLeft = 60;
    const maxHorizontalLabelLength = isHorizontal || chartType === "histogram" || chartType === "heatmap"
        ? Math.max(0, ...data.map((group) => group.label.length))
        : 0;
    const paddingLeft = isHorizontal || chartType === "histogram" || chartType === "heatmap"
        ? Math.min(330, Math.max(basePaddingLeft, Math.round((28 + maxHorizontalLabelLength * 7) * 1.1)))
        : basePaddingLeft;
    const legendWidth = usesLegend ? (isHorizontal ? 220 : 290) : 0;
    const paddingRight = 20 + legendWidth;
    const paddingTop = 44;
    // Dynamically size bottom padding so rotated x-axis labels (35°) always fit.
    // Each char is ~7px wide at font-size 11; vertical projection = len * 7 * sin(35°).
    // Add a 20px gap above the label origin + 16px margin below the longest label tip.
    const maxXLabelLen = hasXAxisLabels
        ? Math.max(0, ...data.map((g) => g.label.length))
        : 0;
    const xLabelVerticalExtent = Math.ceil(maxXLabelLen * 7 * Math.sin((35 * Math.PI) / 180));
    const basePaddingBottom = hasXAxisLabels ? 144 : 120;
    const paddingBottom = hasXAxisLabels
        ? Math.max(basePaddingBottom, 20 + xLabelVerticalExtent + 16)
        : basePaddingBottom;
    const height = 420 + (paddingBottom - basePaddingBottom);
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const colors = ["#1677ff", "#52c41a", "#faad14", "#eb2f96", "#722ed1", "#13c2c2", "#f5222d"];

    const modelField = (key: string | null | undefined) => {
        if (!key) return undefined;
        return allFields.find((field) => field.key === key);
    };
    const primarySeriesKey = seriesKeys[0] || "__count__";
    const secondarySeriesKey = seriesKeys[1];

    const resolveNumericField = (fields: FieldDef[], n: number): FieldDef =>
        fields[Math.min(n, fields.length - 1)] ?? { key: "__count__", label: _("Count") } as FieldDef;

    const resolveCategoryField = (field1: string | null, field2: string | null | undefined): string | null =>
        field2 ?? field1;
    const getNumericValue = (record: any, key: string) => {
        if (key === "__count__") return 1;
        const value = Number(record?.[key]);
        return Number.isNaN(value) ? null : value;
    };
    const summarizeValues = (values: number[]) => {
        if (values.length === 0) return 0;
        switch (summaryFn) {
            case "count":
                return values.length;
            case "avg":
                return values.reduce((acc, val) => acc + val, 0) / values.length;
            case "max":
                return Math.max(...values);
            case "min":
                return Math.min(...values);
            case "stddev": {
                const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
                const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;
                return Math.sqrt(variance);
            }
            case "sum":
            default:
                return values.reduce((acc, val) => acc + val, 0);
        }
    };

    const legendX = paddingLeft + chartWidth + 12;
    const renderLegendItems = (items: { label: string; color: string }[], startY: number) => {
        const rowHeight = 16;
        return (
            <g>
                {items.map((item, index) => {
                    const y = startY + index * rowHeight;
                    return (
                        <g key={`legend-${item.label}-${index}`} transform={`translate(${legendX}, ${y})`}>
                            <rect width={10} height={10} rx={2} fill={item.color} />
                            <text x={16} y={9} fontSize="11" fill={token.colorTextSecondary}>
                                {item.label}
                            </text>
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderCaption = (text: string) => {
        return (
            <text x={paddingLeft} y={16} fontSize="12" fill={token.colorTextSecondary}>
                {text}
            </text>
        );
    };

    const renderTitle = () => {
        if (!title) return null;
        return (
            <text x={paddingLeft} y={24} fontSize="14" fill={token.colorText} fontWeight={600}>
                {title}
            </text>
        );
    };

    const renderNoChartDataMessage = () => (
        <div style={{ padding: 24, color: token.colorTextTertiary, textAlign: "center" }}>
            {_("No data available for this chart.")}
        </div>
    );

    if (!data.length && chartType !== "scatter" && chartType !== "bubble" && chartType !== "histogram" && chartType !== "box" && chartType !== "heatmap" && chartType !== "crosstab") {
        return renderNoChartDataMessage();
    }

    if (chartType === "pie" || chartType === "donut") {
        const sliceMap = new Map<string, { key: string; label: string; value: number }>();
        data.forEach((group) => {
            const baseLabel = group.label.split(" • ")[0];
            const value = seriesKeys.reduce((acc, key) => acc + (group.values[key] || 0), 0);
            const existing = sliceMap.get(baseLabel);
            if (existing) {
                existing.value += value;
            } else {
                sliceMap.set(baseLabel, { key: baseLabel, label: baseLabel, value });
            }
        });
        const sliceValues = Array.from(sliceMap.values());
        const total = sliceValues.reduce((acc, slice) => acc + slice.value, 0);
        if (total <= 0) {
            return renderNoChartDataMessage();
        }
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(chartWidth, chartHeight) / 2;
        const innerRadius = chartType === "donut" ? radius * 0.55 : 0;
        let currentAngle = -Math.PI / 2;
        const slices = sliceValues.map((slice, index) => {
            const angle = (slice.value / total) * Math.PI * 2;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;
            const x1 = centerX + radius * Math.cos(startAngle);
            const y1 = centerY + radius * Math.sin(startAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);
            const largeArc = angle > Math.PI ? 1 : 0;
            const path = [
                `M ${centerX} ${centerY}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                "Z",
            ].join(" ");
            const donutPath = [
                `M ${centerX + innerRadius * Math.cos(startAngle)} ${centerY + innerRadius * Math.sin(startAngle)}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                `L ${centerX + innerRadius * Math.cos(endAngle)} ${centerY + innerRadius * Math.sin(endAngle)}`,
                `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${centerX + innerRadius * Math.cos(startAngle)} ${centerY + innerRadius * Math.sin(startAngle)}`,
                "Z",
            ].join(" ");
            return (
                <path
                    key={slice.key}
                    className="chart-item chart-slice"
                    style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}
                    d={innerRadius > 0 ? donutPath : path}
                    fill={colors[index % colors.length]}
                >
                    <title>{`${slice.label}: ${slice.value}`}</title>
                </path>
            );
        });
        const legendItems = sliceValues.map((slice, index) => ({
            label: slice.label,
            color: colors[index % colors.length],
        }));
        return (
            <div className={`chart-motion chart-effect--sweep chart-stage--${animationStage}`} key={animationKey}>
                <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                    {renderTitle()}
                    {renderLegendItems(legendItems, 8)}
                    {slices}
                </svg>
            </div>
        );
    }

    const values = data.flatMap((group) => seriesKeys.map((key) => group.values[key] || 0));
    const maxValue = Math.max(0, ...values);
    const minValue = Math.min(0, ...values);
    const valueRange = Math.max(1, maxValue - minValue);
    const scaleY = (value: number) => ((value - minValue) / valueRange) * chartHeight;
    const scaleX = (value: number) => ((value - minValue) / valueRange) * chartWidth;
    const zeroY = paddingTop + (chartHeight - scaleY(0));
    const zeroX = paddingLeft + scaleX(0);

    const groupWidth = chartWidth / data.length;
    const seriesCount = Math.max(seriesKeys.length, 1);
    const barWidth = chartType === "bar" ? (groupWidth * 0.7) / seriesCount : 0;

    const renderBars = () => {
        return data.flatMap((group, groupIndex) => {
            const xBase = paddingLeft + groupIndex * groupWidth;
            return seriesKeys.map((seriesKey, seriesIndex) => {
                const value = group.values[seriesKey] || 0;
                const barHeight = Math.abs(scaleY(value) - scaleY(0));
                const x = xBase + (groupWidth - barWidth * seriesCount) / 2 + seriesIndex * barWidth;
                const y = value >= 0 ? zeroY - barHeight : zeroY;
                return (
                    <rect
                        key={`${group.key}-${seriesKey}`}
                        className="chart-item chart-bar"
                        style={{ "--delay": `${(groupIndex * seriesCount + seriesIndex) * 40}ms` } as React.CSSProperties}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill={colors[seriesIndex % colors.length]}
                        rx={2}
                    />
                );
            });
        });
    };

    const renderLines = () => {
        return seriesKeys.map((seriesKey, seriesIndex) => {
            const points = data.map((group, groupIndex) => {
                const value = group.values[seriesKey] || 0;
                const x = paddingLeft + groupIndex * groupWidth + groupWidth / 2;
                const y = paddingTop + (chartHeight - scaleY(value));
                return `${x},${y}`;
            }).join(" ");
            return (
                <g key={seriesKey}>
                    {chartType === "area" && (
                        <polygon
                            className="chart-item chart-area"
                            style={{ "--delay": `${seriesIndex * 80}ms` } as React.CSSProperties}
                            points={`${points} ${paddingLeft + (data.length - 1) * groupWidth + groupWidth / 2},${zeroY} ${paddingLeft},${zeroY}`}
                            fill={colors[seriesIndex % colors.length]}
                            opacity={0.2}
                        />
                    )}
                    <polyline
                        className="chart-item chart-line"
                        style={{ "--delay": `${seriesIndex * 80}ms` } as React.CSSProperties}
                        points={points}
                        fill="none"
                        stroke={colors[seriesIndex % colors.length]}
                        strokeWidth={2}
                    />
                    {data.map((group, groupIndex) => {
                        const value = group.values[seriesKey] || 0;
                        const x = paddingLeft + groupIndex * groupWidth + groupWidth / 2;
                        const y = paddingTop + (chartHeight - scaleY(value));
                        return (
                            <circle
                                key={`${group.key}-${seriesKey}-point`}
                                className="chart-item chart-point"
                                style={{ "--delay": `${(seriesIndex * data.length + groupIndex) * 30}ms` } as React.CSSProperties}
                                cx={x}
                                cy={y}
                                r={3}
                                fill={colors[seriesIndex % colors.length]}
                            />
                        );
                    })}
                </g>
            );
        });
    };

    const renderStackedBars = () => {
        return data.map((group, groupIndex) => {
            const xBase = paddingLeft + groupIndex * groupWidth;
            let yOffsetPositive = 0;
            let yOffsetNegative = 0;
            return seriesKeys.map((seriesKey, seriesIndex) => {
                const value = group.values[seriesKey] || 0;
                const barHeight = Math.abs(scaleY(value) - scaleY(0));
                const x = xBase + groupWidth * 0.15;
                const y = value >= 0 ? zeroY - barHeight - yOffsetPositive : zeroY + yOffsetNegative;
                if (value >= 0) {
                    yOffsetPositive += barHeight;
                } else {
                    yOffsetNegative += barHeight;
                }
                return (
                    <rect
                        key={`${group.key}-${seriesKey}`}
                        className="chart-item chart-bar"
                        style={{ "--delay": `${(groupIndex * seriesCount + seriesIndex) * 40}ms` } as React.CSSProperties}
                        x={x}
                        y={y}
                        width={groupWidth * 0.7}
                        height={barHeight}
                        fill={colors[seriesIndex % colors.length]}
                        rx={2}
                    />
                );
            });
        });
    };

    const renderHorizontalBars = () => {
        const groupHeight = chartHeight / data.length;
        const barHeight = (groupHeight * 0.7) / seriesCount;
        return data.flatMap((group, groupIndex) => {
            const yBase = paddingTop + groupIndex * groupHeight;
            return seriesKeys.map((seriesKey, seriesIndex) => {
                const value = group.values[seriesKey] || 0;
                const barLength = Math.abs(scaleX(value) - scaleX(0));
                const x = value >= 0 ? zeroX : zeroX - barLength;
                const y = yBase + (groupHeight - barHeight * seriesCount) / 2 + seriesIndex * barHeight;
                return (
                    <rect
                        key={`${group.key}-${seriesKey}`}
                        className="chart-item chart-bar"
                        style={{ "--delay": `${(groupIndex * seriesCount + seriesIndex) * 40}ms` } as React.CSSProperties}
                        x={x}
                        y={y}
                        width={barLength}
                        height={barHeight}
                        fill={colors[seriesIndex % colors.length]}
                        rx={2}
                    />
                );
            });
        });
    };

    const renderHorizontalStackedBars = () => {
        const groupHeight = chartHeight / data.length;
        return data.map((group, groupIndex) => {
            const yBase = paddingTop + groupIndex * groupHeight;
            let xOffsetPositive = 0;
            let xOffsetNegative = 0;
            return seriesKeys.map((seriesKey, seriesIndex) => {
                const value = group.values[seriesKey] || 0;
                const barLength = Math.abs(scaleX(value) - scaleX(0));
                const x = value >= 0 ? zeroX + xOffsetPositive : zeroX - xOffsetNegative - barLength;
                const y = yBase + groupHeight * 0.15;
                if (value >= 0) {
                    xOffsetPositive += barLength;
                } else {
                    xOffsetNegative += barLength;
                }
                return (
                    <rect
                        key={`${group.key}-${seriesKey}`}
                        className="chart-item chart-bar"
                        style={{ "--delay": `${(groupIndex * seriesCount + seriesIndex) * 40}ms` } as React.CSSProperties}
                        x={x}
                        y={y}
                        width={barLength}
                        height={groupHeight * 0.7}
                        fill={colors[seriesIndex % colors.length]}
                        rx={2}
                    />
                );
            });
        });
    };

    const renderHorizontalLines = (isArea: boolean) => {
        const groupHeight = chartHeight / data.length;
        return seriesKeys.map((seriesKey, seriesIndex) => {
            const points = data
                .map((group, groupIndex) => {
                    const value = group.values[seriesKey] || 0;
                    const x = paddingLeft + scaleX(value);
                    const y = paddingTop + groupIndex * groupHeight + groupHeight / 2;
                    return `${x},${y}`;
                })
                .join(" ");
            const startY = paddingTop + groupHeight / 2;
            const endY = paddingTop + (data.length - 1) * groupHeight + groupHeight / 2;
            return (
                <g key={seriesKey}>
                    {isArea && (
                        <polygon
                            className="chart-item chart-area"
                            style={{ "--delay": `${seriesIndex * 80}ms` } as React.CSSProperties}
                            points={`${points} ${zeroX},${endY} ${zeroX},${startY}`}
                            fill={colors[seriesIndex % colors.length]}
                            opacity={0.2}
                        />
                    )}
                    <polyline
                        className="chart-item chart-line"
                        style={{ "--delay": `${seriesIndex * 80}ms` } as React.CSSProperties}
                        points={points}
                        fill="none"
                        stroke={colors[seriesIndex % colors.length]}
                        strokeWidth={2}
                    />
                    {data.map((group, groupIndex) => {
                        const value = group.values[seriesKey] || 0;
                        const x = paddingLeft + scaleX(value);
                        const y = paddingTop + groupIndex * groupHeight + groupHeight / 2;
                        return (
                            <circle
                                key={`${group.key}-${seriesKey}-point`}
                                className="chart-item chart-point"
                                style={{ "--delay": `${(seriesIndex * data.length + groupIndex) * 30}ms` } as React.CSSProperties}
                                cx={x}
                                cy={y}
                                r={3}
                                fill={colors[seriesIndex % colors.length]}
                            />
                        );
                    })}
                </g>
            );
        });
    };

    const renderHistogram = () => {
        const field = numericFields[0];
        if (!field) return <Empty description="Histogram needs a numeric field." />;
        const valuesRaw = rawRows
            .map((row) => getNumericValue(row, field.key))
            .filter((value): value is number => value !== null);
        if (valuesRaw.length === 0) return <Empty description="No numeric data for histogram." />;
        const min = Math.min(...valuesRaw);
        const max = Math.max(...valuesRaw);
        const bins = 8;
        const binSize = (max - min) / bins || 1;
        const binCounts = Array.from({ length: bins }, () => 0);
        valuesRaw.forEach((value) => {
            const index = Math.min(bins - 1, Math.floor((value - min) / binSize));
            binCounts[index] += 1;
        });
        const maxCount = Math.max(...binCounts, 1);
        const binWidth = chartWidth / bins;
        return (
            <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                {renderTitle()}
                {renderCaption(`Histogram: ${field.label}`)}
                <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={paddingLeft + chartWidth} y2={paddingTop + chartHeight} stroke={token.colorBorderSecondary} />
                <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke={token.colorBorderSecondary} />
                {[0, 0.5, 1].map((ratio) => {
                    const value = Math.round(maxCount * ratio);
                    const y = paddingTop + chartHeight - chartHeight * ratio;
                    return (
                        <g key={`hist-grid-${ratio}`}>
                            <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke={token.colorBorder} />
                            <text x={paddingLeft - 8} y={y + 4} fontSize="11" textAnchor="end" fill={token.colorTextTertiary}>
                                {value}
                            </text>
                        </g>
                    );
                })}
                {binCounts.map((count, index) => {
                    const barHeight = (count / maxCount) * chartHeight;
                    const x = paddingLeft + index * binWidth + binWidth * 0.1;
                    const y = paddingTop + chartHeight - barHeight;
                    return (
                        <rect
                            key={`hist-${index}`}
                            className="chart-item chart-bar"
                            style={{ "--delay": `${index * 40}ms` } as React.CSSProperties}
                            x={x}
                            y={y}
                            width={binWidth * 0.8}
                            height={barHeight}
                            fill={colors[index % colors.length]}
                            rx={2}
                        />
                    );
                })}
                {[0, 0.5, 1].map((ratio) => {
                    const value = Math.round(min + (max - min) * ratio);
                    const x = paddingLeft + chartWidth * ratio;
                    return (
                        <text
                            key={`hist-label-${ratio}`}
                            x={x}
                            y={paddingTop + chartHeight + 10}
                            fontSize="11"
                            textAnchor="start"
                            dominantBaseline="hanging"
                            fill={token.colorTextTertiary}
                            transform={`rotate(35 ${x} ${paddingTop + chartHeight + 10})`}
                        >
                            {value}
                        </text>
                    );
                })}
            </svg>
        );
    };

    const renderScatter = (isBubble: boolean) => {
        if (numericFields.length === 0) {
            return <Empty description="Scatter needs at least one numeric field." />;
        }
        const xField = resolveNumericField(numericFields, 0);
        const yField = resolveNumericField(numericFields, 1);
        const points = rawRows
            .map((row) => {
                const x = getNumericValue(row, xField.key);
                const y = getNumericValue(row, yField.key);
                if (x === null || y === null) return null;
                return { x, y, size: x, row };
            })
            .filter((point): point is { x: number; y: number; size: number; row: any } => !!point);
        if (points.length === 0) return <Empty description="No numeric data for scatter." />;
        const xMin = Math.min(...points.map((p) => p.x));
        const xMax = Math.max(...points.map((p) => p.x));
        const yMin = Math.min(...points.map((p) => p.y));
        const yMax = Math.max(...points.map((p) => p.y));
        const scaleXPoint = (value: number) => paddingLeft + ((value - xMin) / Math.max(1, xMax - xMin)) * chartWidth;
        const scaleYPoint = (value: number) => paddingTop + chartHeight - ((value - yMin) / Math.max(1, yMax - yMin)) * chartHeight;
        const sizeValues = points.map((p) => Math.abs(p.size));
        const sizeMin = Math.min(...sizeValues);
        const sizeMax = Math.max(...sizeValues);
        const scaleR = (value: number) => {
            if (!isBubble) return 4;
            const normalized = (Math.abs(value) - sizeMin) / Math.max(1, sizeMax - sizeMin);
            return 6 + normalized * 10;
        };
        const categoryField = modelField(categoryField1);
        const categoryLabels = categoryField1
            ? Array.from(new Set(points.map((point) => formatCategoryValue(categoryField, point.row))))
            : [];
        const colorMap = new Map<string, string>(
            categoryLabels.map((label, index) => [label, colors[index % colors.length]])
        );
        return (
            <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                {renderTitle()}
                {renderCaption(`${xField.label} vs ${yField.label}`)}
                {categoryLabels.length > 0 &&
                    renderLegendItems(
                        categoryLabels.map((label, index) => ({
                            label,
                            color: colors[index % colors.length],
                        })),
                        32
                    )}
                <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={paddingLeft + chartWidth} y2={paddingTop + chartHeight} stroke={token.colorBorderSecondary} />
                <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke={token.colorBorderSecondary} />
                {isBubble && (
                    <>
                        <text
                            x={paddingLeft + chartWidth / 2}
                            y={paddingTop + chartHeight + 20}
                            fontSize="12"
                            textAnchor="middle"
                            fill={token.colorTextSecondary}
                        >
                            {xField.label}
                        </text>
                        <text
                            x={paddingLeft + chartWidth / 2}
                            y={paddingTop + chartHeight + 36}
                            fontSize="12"
                            textAnchor="middle"
                            fill={token.colorTextSecondary}
                        >
                            {`● bubble size: ${xField.label}`}
                        </text>
                        <text
                            transform={`rotate(-90, 12, ${paddingTop + chartHeight / 2})`}
                            x={12}
                            y={paddingTop + chartHeight / 2}
                            fontSize="12"
                            textAnchor="middle"
                            fill={token.colorTextSecondary}
                        >
                            {yField.label}
                        </text>
                    </>
                )}
                {[0, 0.5, 1].map((ratio) => {
                    const value = Math.round(yMin + (yMax - yMin) * ratio);
                    const y = paddingTop + chartHeight - chartHeight * ratio;
                    return (
                        <g key={`scatter-grid-y-${ratio}`}>
                            <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke={token.colorBorder} />
                            <text x={paddingLeft - 8} y={y + 4} fontSize="11" textAnchor="end" fill={token.colorTextTertiary}>
                                {value}
                            </text>
                        </g>
                    );
                })}
                {points.map((point, index) => {
                    const x = scaleXPoint(point.x);
                    const y = scaleYPoint(point.y);
                    let color = colors[0];
                    if (categoryField1) {
                        const label = formatCategoryValue(categoryField, point.row);
                        color = colorMap.get(label) || colors[0];
                    }
                    const tooltipLines: string[] = [];
                    if (isBubble) {
                        if (categoryField1) {
                            const f = modelField(categoryField1);
                            tooltipLines.push(`${f?.label || categoryField1}: ${formatCategoryValue(f, point.row)}`);
                        }
                        if (categoryField2) {
                            const f = modelField(categoryField2);
                            tooltipLines.push(`${f?.label || categoryField2}: ${formatCategoryValue(f, point.row)}`);
                        }
                        tooltipLines.push(`${xField.label}: ${point.x}`);
                    }
                    return (
                        <circle
                            key={`scatter-${index}`}
                            className="chart-item chart-point"
                            style={{ "--delay": `${index * 10}ms` } as React.CSSProperties}
                            cx={x}
                            cy={y}
                            r={scaleR(point.size)}
                            fill={color}
                            opacity={isBubble ? 0.65 : 0.9}
                        >
                            {tooltipLines.length > 0 && <title>{tooltipLines.join("\n")}</title>}
                        </circle>
                    );
                })}
            </svg>
        );
    };

    const renderBoxPlot = () => {
        const field = numericFields[0];
        if (!field) return <Empty description="Box plot needs a numeric field." />;
        const groupMap = new Map<string, number[]>();
        rawRows.forEach((row) => {
            const value = getNumericValue(row, field.key);
            if (value === null) return;
            const label = categoryField1 ? formatCategoryValue(modelField(categoryField1), row) : "All";
            if (!groupMap.has(label)) groupMap.set(label, []);
            groupMap.get(label)!.push(value);
        });
        if (groupMap.size === 0) return <Empty description="No numeric data for box plot." />;
        const groups = Array.from(groupMap.entries()).map(([label, values]) => {
            const sorted = values.slice().sort((a, b) => a - b);
            const q1 = sorted[Math.floor(sorted.length * 0.25)];
            const median = sorted[Math.floor(sorted.length * 0.5)];
            const q3 = sorted[Math.floor(sorted.length * 0.75)];
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            return { label, q1, median, q3, min, max };
        });
        const allValues = groups.flatMap((g) => [g.min, g.max]);
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const scaleYBox = (value: number) => paddingTop + chartHeight - ((value - min) / Math.max(1, max - min)) * chartHeight;
        const groupWidth = chartWidth / groups.length;
        return (
            <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                {renderTitle()}
                {renderCaption(`Box plot: ${field.label}`)}
                <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={paddingLeft + chartWidth} y2={paddingTop + chartHeight} stroke={token.colorBorderSecondary} />
                <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke={token.colorBorderSecondary} />
                {[0, 0.5, 1].map((ratio) => {
                    const value = Math.round(min + (max - min) * ratio);
                    const y = paddingTop + chartHeight - chartHeight * ratio;
                    return (
                        <g key={`box-grid-${ratio}`}>
                            <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke={token.colorBorder} />
                            <text x={paddingLeft - 8} y={y + 4} fontSize="11" textAnchor="end" fill={token.colorTextTertiary}>
                                {value}
                            </text>
                        </g>
                    );
                })}
                {groups.map((group, index) => {
                    const x = paddingLeft + index * groupWidth + groupWidth / 2;
                    const boxWidth = groupWidth * 0.4;
                    const yQ1 = scaleYBox(group.q1);
                    const yQ3 = scaleYBox(group.q3);
                    const yMedian = scaleYBox(group.median);
                    const yMin = scaleYBox(group.min);
                    const yMax = scaleYBox(group.max);
                    const color = colors[index % colors.length];
                    return (
                        <g key={`box-${group.label}`}>
                            <line x1={x} y1={yMin} x2={x} y2={yMax} stroke={color} />
                            <rect
                                className="chart-item chart-bar"
                                style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}
                                x={x - boxWidth / 2}
                                y={yQ3}
                                width={boxWidth}
                                height={Math.max(2, yQ1 - yQ3)}
                                fill={color}
                                opacity={0.3}
                                stroke={color}
                            />
                            <line x1={x - boxWidth / 2} y1={yMedian} x2={x + boxWidth / 2} y2={yMedian} stroke={color} />
                            <text
                                x={x}
                                y={paddingTop + chartHeight + 10}
                                fontSize="11"
                                textAnchor="start"
                                dominantBaseline="hanging"
                                transform={`rotate(35 ${x} ${paddingTop + chartHeight + 10})`}
                                fill={token.colorTextTertiary}
                            >
                                {group.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        );
    };

    const renderWaterfall = () => {
        if (!data.length) return renderNoChartDataMessage();
        const steps = data.map((group) => ({
            label: group.label,
            value: group.values[primarySeriesKey] || 0,
        }));
        let cumulative = 0;
        const ranges = steps.map((step) => {
            const start = cumulative;
            cumulative += step.value;
            return { ...step, start, end: cumulative };
        });
        const allValues = ranges.flatMap((range) => [range.start, range.end, 0]);
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const scaleYWaterfall = (value: number) => paddingTop + chartHeight - ((value - min) / Math.max(1, max - min)) * chartHeight;
        const groupWidth = chartWidth / ranges.length;
        return (
            <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                {renderTitle()}
                {renderLegendItems(
                    [
                        { label: _("Increase"), color: "#52c41a" },
                        { label: _("Decrease"), color: "#f5222d" },
                    ],
                    8
                )}
                <line x1={paddingLeft} y1={scaleYWaterfall(0)} x2={paddingLeft + chartWidth} y2={scaleYWaterfall(0)} stroke={token.colorBorderSecondary} />
                <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke={token.colorBorderSecondary} />
                {[0, 0.5, 1].map((ratio) => {
                    const value = Math.round(min + (max - min) * ratio);
                    const y = paddingTop + chartHeight - chartHeight * ratio;
                    return (
                        <g key={`waterfall-grid-${ratio}`}>
                            <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke={token.colorBorder} />
                            <text x={paddingLeft - 8} y={y + 4} fontSize="11" textAnchor="end" fill={token.colorTextTertiary}>
                                {value}
                            </text>
                        </g>
                    );
                })}
                {ranges.map((range, index) => {
                    const x = paddingLeft + index * groupWidth + groupWidth * 0.2;
                    const barWidth = groupWidth * 0.6;
                    const yStart = scaleYWaterfall(range.start);
                    const yEnd = scaleYWaterfall(range.end);
                    const y = Math.min(yStart, yEnd);
                    const heightValue = Math.max(2, Math.abs(yEnd - yStart));
                    const color = range.value >= 0 ? "#52c41a" : "#f5222d";
                    return (
                        <g key={`waterfall-${range.label}`}>
                            <rect
                                className="chart-item chart-bar"
                                style={{ "--delay": `${index * 50}ms` } as React.CSSProperties}
                                x={x}
                                y={y}
                                width={barWidth}
                                height={heightValue}
                                fill={color}
                                rx={2}
                            />
                            <text
                                x={x + barWidth / 2}
                                y={paddingTop + chartHeight + 10}
                                fontSize="11"
                                textAnchor="start"
                                dominantBaseline="hanging"
                                transform={`rotate(35 ${x + barWidth / 2} ${paddingTop + chartHeight + 10})`}
                                fill={token.colorTextTertiary}
                            >
                                {range.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        );
    };

    const renderHeatmap = () => {
        if (!categoryField1) {
            return <Empty description="Heatmap needs a category field." />;
        }
        const effectiveCat2 = resolveCategoryField(categoryField1, categoryField2);
        const cat1Field = modelField(categoryField1);
        const cat2Field = modelField(effectiveCat2);
        const rowLabels: string[] = [];
        const colLabels: string[] = [];
        const grid = new Map<string, number[]>();
        rawRows.forEach((row) => {
            const rowLabel = formatCategoryValue(cat1Field, row);
            const colLabel = formatCategoryValue(cat2Field, row);
            if (!rowLabels.includes(rowLabel)) rowLabels.push(rowLabel);
            if (!colLabels.includes(colLabel)) colLabels.push(colLabel);
            const key = `${rowLabel}::${colLabel}`;
            if (!grid.has(key)) grid.set(key, []);
            const value = getNumericValue(row, primarySeriesKey);
            if (value !== null) {
                grid.get(key)!.push(value);
            } else {
                grid.get(key)!.push(1);
            }
        });
        if (rowLabels.length === 0 || colLabels.length === 0) {
            return renderNoChartDataMessage();
        }
        const cellValues = rowLabels.flatMap((rowLabel) =>
            colLabels.map((colLabel) => summarizeValues(grid.get(`${rowLabel}::${colLabel}`) || []))
        );
        const min = Math.min(...cellValues);
        const max = Math.max(...cellValues);
        const cellWidth = chartWidth / colLabels.length;
        const cellHeight = chartHeight / rowLabels.length;
        const colorForValue = (value: number) => {
            const t = (value - min) / Math.max(1, max - min);
            const shade = 230 - Math.round(130 * t);
            return `rgb(${shade}, ${shade}, 255)`;
        };
        return (
            <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                {renderTitle()}
                {renderCaption(`Heatmap: ${seriesLabels[primarySeriesKey] || primarySeriesKey} (${summaryFn})`)}
                {rowLabels.map((rowLabel, rowIndex) =>
                    colLabels.map((colLabel, colIndex) => {
                        const value = summarizeValues(grid.get(`${rowLabel}::${colLabel}`) || []);
                        const x = paddingLeft + colIndex * cellWidth;
                        const y = paddingTop + rowIndex * cellHeight;
                        return (
                            <rect
                                key={`heat-${rowLabel}-${colLabel}`}
                                className="chart-item chart-bar"
                                style={{ "--delay": `${(rowIndex * colLabels.length + colIndex) * 20}ms` } as React.CSSProperties}
                                x={x}
                                y={y}
                                width={cellWidth}
                                height={cellHeight}
                                fill={colorForValue(value)}
                            />
                        );
                    })
                )}
                {rowLabels.map((label, index) => (
                    <text key={`heat-row-${label}`} x={paddingLeft - 8} y={paddingTop + index * cellHeight + cellHeight / 2 + 4} fontSize="11" textAnchor="end" fill={token.colorTextTertiary}>
                        {label}
                    </text>
                ))}
                {colLabels.map((label, index) => {
                    const x = paddingLeft + index * cellWidth + cellWidth / 2;
                    const y = paddingTop + chartHeight + 10;
                    return (
                        <text
                            key={`heat-col-${label}`}
                            x={x}
                            y={y}
                            fontSize="11"
                            textAnchor="start"
                            dominantBaseline="hanging"
                            fill={token.colorTextTertiary}
                            transform={`rotate(35 ${x} ${y})`}
                        >
                            {label}
                        </text>
                    );
                })}
            </svg>
        );
    };

    const renderCrosstab = () => {
        if (!categoryField1) {
            return <Empty description="Crosstab needs a category field." />;
        }
        const effectiveCat2 = resolveCategoryField(categoryField1, categoryField2);
        const cat1Field = modelField(categoryField1);
        const cat2Field = modelField(effectiveCat2);
        return (
            <CrosstabTable
                rows={rawRows}
                rowField={categoryField1}
                colField={effectiveCat2 ?? categoryField1}
                cellFieldKeys={seriesKeys}
                cellFieldLabels={seriesLabels}
                allFields={allFields}
                summaryFn={summaryFn}
                formatCategoryValue={formatCategoryValue}
                numericBarColor={numericBarColor}
                caption={`${_("Crosstab")}: ${cat1Field?.label || categoryField1} × ${cat2Field?.label || effectiveCat2} (${summaryFn})`}
            />
        );
    };

    const renderRadar = () => {
        if (seriesKeys.length === 0) {
            return <Empty description="Radar needs at least one series." />;
        }
        const effectiveSeriesKeys = seriesKeys.length >= 3
            ? seriesKeys
            : Array.from({ length: 3 }, (_, i) => seriesKeys[i % seriesKeys.length]);
        const centerX = paddingLeft + chartWidth / 2;
        const centerY = paddingTop + chartHeight / 2;
        const radius = Math.min(chartWidth, chartHeight) * 0.35;
        const maxBySeries = effectiveSeriesKeys.reduce<Record<string, number>>((acc, key) => {
            acc[key] = Math.max(...data.map((group) => group.values[key] || 0), 1);
            return acc;
        }, {});
        const angleStep = (Math.PI * 2) / effectiveSeriesKeys.length;
        return (
            <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                {renderTitle()}
                {renderCaption("Radar chart")}
                {effectiveSeriesKeys.map((seriesKey, index) => {
                    const angle = -Math.PI / 2 + index * angleStep;
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    return (
                        <g key={`radar-axis-${seriesKey}`}>
                            <line x1={centerX} y1={centerY} x2={x} y2={y} stroke={token.colorBorder} />
                            <text x={x} y={y} fontSize="11" textAnchor="middle" fill={token.colorTextTertiary}>
                                {seriesLabels[seriesKey] || seriesKey}
                            </text>
                        </g>
                    );
                })}
                {data.map((group, groupIndex) => {
                    const points = effectiveSeriesKeys
                        .map((seriesKey, index) => {
                            const value = group.values[seriesKey] || 0;
                            const ratio = value / Math.max(1, maxBySeries[seriesKey]);
                            const angle = -Math.PI / 2 + index * angleStep;
                            const x = centerX + radius * ratio * Math.cos(angle);
                            const y = centerY + radius * ratio * Math.sin(angle);
                            return `${x},${y}`;
                        })
                        .join(" ");
                    const color = colors[groupIndex % colors.length];
                    return (
                        <polygon
                            key={`radar-${group.key}`}
                            className="chart-item chart-area"
                            style={{ "--delay": `${groupIndex * 80}ms` } as React.CSSProperties}
                            points={points}
                            fill={color}
                            opacity={0.2}
                            stroke={color}
                            strokeWidth={2}
                        />
                    );
                })}
            </svg>
        );
    };

    const render3D = () => {
        if (numericFields.length === 0) {
            return <Empty description="3D scatter needs at least one numeric field." />;
        }
        const xField = resolveNumericField(numericFields, 0);
        const yField = resolveNumericField(numericFields, 1);
        const zField = resolveNumericField(numericFields, 2);
        const points = rawRows
            .map((row) => {
                const x = getNumericValue(row, xField.key);
                const y = getNumericValue(row, yField.key);
                const z = getNumericValue(row, zField.key);
                if (x === null || y === null || z === null) return null;
                return { x, y, z };
            })
            .filter((p): p is { x: number; y: number; z: number } => !!p);
        if (points.length === 0) return renderNoChartDataMessage();
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const zs = points.map((p) => p.z);
        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const yMin = Math.min(...ys), yMax = Math.max(...ys);
        const zMin = Math.min(...zs), zMax = Math.max(...zs);
        const norm = (v: number, lo: number, hi: number) => (hi === lo ? 0.5 : (v - lo) / (hi - lo));
        const isoScale = Math.min(chartWidth, chartHeight) * 0.38;
        const cx = paddingLeft + chartWidth * 0.5;
        const cy = paddingTop + chartHeight * 0.55;
        const cos30 = Math.cos(Math.PI / 6);
        const sin30 = Math.sin(Math.PI / 6);
        const project = (nx: number, ny: number, nz: number) => ({
            sx: cx + (nx - nz) * cos30 * isoScale,
            sy: cy - ny * isoScale + (nx + nz) * sin30 * isoScale,
        });
        const axisEnd = (nx: number, ny: number, nz: number) => project(nx, ny, nz);
        const origin = project(0, 0, 0);
        const xTip = axisEnd(1, 0, 0);
        const yTip = axisEnd(0, 1, 0);
        const zTip = axisEnd(0, 0, 1);
        const projected = points.map((p) =>
            project(norm(p.x, xMin, xMax), norm(p.y, yMin, yMax), norm(p.z, zMin, zMax))
        );
        return (
            <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                {renderTitle()}
                {renderCaption(`3D: ${xField.label} × ${yField.label} × ${zField.label}`)}
                <line x1={origin.sx} y1={origin.sy} x2={xTip.sx} y2={xTip.sy} stroke={colors[0]} strokeWidth={1.5} opacity={0.6} />
                <line x1={origin.sx} y1={origin.sy} x2={yTip.sx} y2={yTip.sy} stroke={colors[1]} strokeWidth={1.5} opacity={0.6} />
                <line x1={origin.sx} y1={origin.sy} x2={zTip.sx} y2={zTip.sy} stroke={colors[2]} strokeWidth={1.5} opacity={0.6} />
                <text x={xTip.sx + 4} y={xTip.sy + 4} fontSize="11" fill={colors[0]}>{xField.label}</text>
                <text x={yTip.sx + 4} y={yTip.sy} fontSize="11" fill={colors[1]}>{yField.label}</text>
                <text x={zTip.sx + 4} y={zTip.sy + 4} fontSize="11" fill={colors[2]}>{zField.label}</text>
                {projected.map((p, i) => (
                    <circle
                        key={`3d-${i}`}
                        className="chart-item chart-point"
                        style={{ "--delay": `${i * 8}ms` } as React.CSSProperties}
                        cx={p.sx}
                        cy={p.sy}
                        r={4}
                        fill={colors[0]}
                        opacity={0.7}
                    />
                ))}
            </svg>
        );
    };

    const renderCombo = () => {
        const effectiveSecondaryKey = secondarySeriesKey ?? primarySeriesKey;
        const valuesCombo = data.flatMap((group) => [
            group.values[primarySeriesKey] || 0,
            group.values[effectiveSecondaryKey] || 0,
        ]);
        const maxCombo = Math.max(...valuesCombo, 1);
        const minCombo = Math.min(...valuesCombo, 0);
        const scaleYCombo = (value: number) => paddingTop + chartHeight - ((value - minCombo) / Math.max(1, maxCombo - minCombo)) * chartHeight;
        const groupWidth = chartWidth / data.length;
        const barWidth = groupWidth * 0.6;
        const points = data
            .map((group, index) => {
                const x = paddingLeft + index * groupWidth + groupWidth / 2;
                const y = scaleYCombo(group.values[effectiveSecondaryKey] || 0);
                return `${x},${y}`;
            })
            .join(" ");
        return (
            <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                {renderTitle()}
                {renderLegendItems(
                    [
                        { label: seriesLabels[primarySeriesKey] || primarySeriesKey, color: colors[0] },
                        { label: seriesLabels[effectiveSecondaryKey] || effectiveSecondaryKey, color: colors[2] },
                    ],
                    8
                )}
                <line x1={paddingLeft} y1={scaleYCombo(0)} x2={paddingLeft + chartWidth} y2={scaleYCombo(0)} stroke={token.colorBorderSecondary} />
                <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke={token.colorBorderSecondary} />
                {[0, 0.5, 1].map((ratio) => {
                    const value = Math.round(minCombo + (maxCombo - minCombo) * ratio);
                    const y = paddingTop + chartHeight - chartHeight * ratio;
                    return (
                        <g key={`combo-grid-${ratio}`}>
                            <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke={token.colorBorder} />
                            <text x={paddingLeft - 8} y={y + 4} fontSize="11" textAnchor="end" fill={token.colorTextTertiary}>
                                {value}
                            </text>
                        </g>
                    );
                })}
                {data.map((group, index) => {
                    const value = group.values[primarySeriesKey] || 0;
                    const barHeight = Math.abs(scaleYCombo(value) - scaleYCombo(0));
                    const x = paddingLeft + index * groupWidth + (groupWidth - barWidth) / 2;
                    const y = value >= 0 ? scaleYCombo(value) : scaleYCombo(0);
                    return (
                        <rect
                            key={`combo-bar-${group.key}`}
                            className="chart-item chart-bar"
                            style={{ "--delay": `${index * 40}ms` } as React.CSSProperties}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={colors[0]}
                            rx={2}
                        />
                    );
                })}
                <polyline
                    className="chart-item chart-line"
                    style={{ "--delay": "120ms" } as React.CSSProperties}
                    points={points}
                    fill="none"
                    stroke={colors[2]}
                    strokeWidth={2}
                />
            </svg>
        );
    };

    return (
        <div className={`chart-motion chart-effect--sweep chart-stage--${animationStage}`} key={animationKey}>
            {chartType === "histogram" && renderHistogram()}
            {chartType === "scatter" && renderScatter(false)}
            {chartType === "bubble" && renderScatter(true)}
            {(chartType === "box" || chartType === "boxplot") && renderBoxPlot()}
            {chartType === "waterfall" && renderWaterfall()}
            {chartType === "heatmap" && renderHeatmap()}
            {chartType === "crosstab" && renderCrosstab()}
            {chartType === "radar" && renderRadar()}
            {chartType === "combo" && renderCombo()}
            {chartType === "3d" && render3D()}
            {(chartType === "bar" || chartType === "line" || chartType === "area" || chartType === "stacked" ||
              chartType === "bar-horizontal" || chartType === "stacked-horizontal" || chartType === "area-horizontal") && (
                <svg ref={svgRef} className="chart-plot" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
                {renderTitle()}
                {renderLegendItems(
                    seriesKeys.map((seriesKey, index) => ({
                        label: seriesLabels[seriesKey] || seriesKey,
                        color: colors[index % colors.length],
                    })),
                    8
                )}
                {isHorizontal ? (
                    <>
                        <line
                            x1={zeroX}
                            y1={paddingTop}
                            x2={zeroX}
                            y2={paddingTop + chartHeight}
                            stroke={token.colorBorderSecondary}
                        />
                        <line
                            x1={paddingLeft}
                            y1={paddingTop + chartHeight}
                            x2={paddingLeft + chartWidth}
                            y2={paddingTop + chartHeight}
                            stroke={token.colorBorderSecondary}
                        />
                        {chartType === "bar-horizontal" && renderHorizontalBars()}
                        {chartType === "stacked-horizontal" && renderHorizontalStackedBars()}
                        {chartType === "area-horizontal" && renderHorizontalLines(true)}
                        {data.map((group, index) => {
                            const groupHeight = chartHeight / data.length;
                            const y = paddingTop + index * groupHeight + groupHeight / 2;
                            const label = group.label;
                            return (
                                <text
                                    key={group.key}
                                    x={paddingLeft - 8}
                                    y={y + 4}
                                    fontSize="11"
                                    textAnchor="end"
                                    fill={token.colorTextSecondary}
                                >
                                    <title>{group.label}</title>
                                    {label}
                                </text>
                            );
                        })}
                        {[0, 0.5, 1].map((ratio) => {
                            const value = Math.round(minValue + (maxValue - minValue) * ratio);
                            const x = paddingLeft + chartWidth * ratio;
                            return (
                                <g key={`grid-x-${ratio}`}>
                                    <line x1={x} y1={paddingTop} x2={x} y2={paddingTop + chartHeight} stroke={token.colorBorder} />
                                    <text x={x} y={paddingTop + chartHeight + 20} fontSize="11" textAnchor="middle" fill={token.colorTextTertiary}>
                                        {value}
                                    </text>
                                </g>
                            );
                        })}
                    </>
                ) : (
                    <>
                        <line
                            x1={paddingLeft}
                            y1={zeroY}
                            x2={paddingLeft + chartWidth}
                            y2={zeroY}
                            stroke={token.colorBorderSecondary}
                        />
                        <line
                            x1={paddingLeft}
                            y1={paddingTop}
                            x2={paddingLeft}
                            y2={paddingTop + chartHeight}
                            stroke={token.colorBorderSecondary}
                        />
                        {chartType === "bar" && renderBars()}
                        {chartType === "stacked" && renderStackedBars()}
                        {(chartType === "line" || chartType === "area") && renderLines()}
                        {data.map((group, index) => {
                            const x = paddingLeft + index * groupWidth + groupWidth / 2;
                            const y = paddingTop + chartHeight + 10;
                            const label = group.label;
                            return (
                                <text
                                    key={group.key}
                                    x={x}
                                    y={y}
                                    fontSize="11"
                                    textAnchor="start"
                                    dominantBaseline="hanging"
                                    fill={token.colorTextSecondary}
                                    transform={`rotate(35 ${x} ${y})`}
                                >
                                    <title>{group.label}</title>
                                    {label}
                                </text>
                            );
                        })}
                        {[0, 0.5, 1].map((ratio) => {
                            const value = Math.round(minValue + (maxValue - minValue) * ratio);
                            const y = paddingTop + chartHeight - chartHeight * ratio;
                            return (
                                <g key={`grid-${ratio}`}>
                                    <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke={token.colorBorder} />
                                    <text x={paddingLeft - 8} y={y + 4} fontSize="11" textAnchor="end" fill={token.colorTextTertiary}>
                                        {value}
                                    </text>
                                </g>
                            );
                        })}
                    </>
                )}
            </svg>
            )}
        </div>
    );
};

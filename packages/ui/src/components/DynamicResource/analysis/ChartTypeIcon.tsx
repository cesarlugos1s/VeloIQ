import React from "react";
import {
    AreaChartOutlined,
    BarChartOutlined,
    BoxPlotOutlined,
    BuildOutlined,
    DeploymentUnitOutlined,
    DotChartOutlined,
    FallOutlined,
    FundOutlined,
    HeatMapOutlined,
    LineChartOutlined,
    PieChartOutlined,
    RadarChartOutlined,
    RiseOutlined,
    StockOutlined,
    TableOutlined,
} from "@ant-design/icons";
import { getChartTypeDef, type ChartTypeId } from "./chartCatalog";

/**
 * Icon components by the names the chart catalogue uses. Imported one by one
 * (not the whole icon set) so the bundle only carries the icons charts need.
 */
const ICONS: Record<string, React.ComponentType<{ rotate?: number }>> = {
    AreaChartOutlined,
    BarChartOutlined,
    BoxPlotOutlined,
    BuildOutlined,
    DeploymentUnitOutlined,
    DotChartOutlined,
    FallOutlined,
    FundOutlined,
    HeatMapOutlined,
    LineChartOutlined,
    PieChartOutlined,
    RadarChartOutlined,
    RiseOutlined,
    StockOutlined,
    TableOutlined,
};

/** The catalogue icon of a chart type (rotated for horizontal variants). */
export const ChartTypeIcon: React.FC<{ chartType: ChartTypeId }> = ({ chartType }) => {
    const def = getChartTypeDef(chartType);
    const Icon = def ? ICONS[def.icon] : undefined;
    if (!Icon) return null;
    return <Icon rotate={def?.iconRotate || undefined} />;
};

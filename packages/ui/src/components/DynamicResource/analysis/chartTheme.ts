/**
 * The look shared by every chart in VeloIQ: palette, light/dark colours,
 * number formatting, legend position and the empty-state message.
 *
 * The backend applies the same values to its Plotly figures
 * (jm_apply_standard_chart_layout in veloiq_framework.utils.views_utils), and
 * test-fixtures/charts.json holds them for both layers' tests.
 */

const _ = (text: string): string => {
    const translate = typeof window !== "undefined" ? ((window as any)._ as ((t: string) => string) | undefined) : undefined;
    return translate ? translate(text) : text;
};

/** Series colours, in order (Ant Design's palette). */
export const CHART_COLORWAY: ReadonlyArray<string> = [
    "#1677ff", "#52c41a", "#faad14", "#eb2f96", "#722ed1",
    "#13c2c2", "#f5222d", "#fa8c16", "#2f54eb", "#a0d911",
];

/** Colour scale of heatmaps. */
export const CHART_HEATMAP_COLORSCALE = "Blues";

/** Reverse the heatmap colour scale, so higher values are darker (Plotly's "Blues" runs dark to light). */
export const CHART_HEATMAP_REVERSESCALE = true;

/**
 * Legend position: one horizontal row (wrapping) along the bottom of the chart,
 * at most 30% of its height and scrolling beyond that, so a chart with many
 * legend entries keeps its full width, even in a narrow card.
 */
export const CHART_LEGEND = {
    orientation: "h",
    x: 0,
    xanchor: "left",
    y: 0,
    yanchor: "bottom",
    yref: "container",
    maxheight: 0.3,
} as const;

/** d3-format of every summarised number: thousands separators and 2 decimals. */
export const CHART_NUMBER_FORMAT = ",.2f";

/** Font family of chart text. */
export const CHART_FONT_FAMILY = "sans-serif";

/** Font size of chart text, in px. */
export const CHART_FONT_SIZE = 12;

/**
 * Text, grid, legend-border and surface colours for the light and the dark theme.
 *
 * `surface` is what the chart is drawn on. Plotly's own backgrounds stay
 * transparent; in the light theme the colour schema paints every card grey, so
 * a frontend chart gets the white of the backend's answer cards (--jm-card-bg),
 * which the backend's charts are shown on.
 */
export const CHART_THEME_COLORS = {
    light: { text: "#4a5568", grid: "rgba(128,128,128,0.22)", legendBorder: "rgba(128,128,128,0.35)", surface: "#ffffff" },
    dark: { text: "#c9d1d9", grid: "rgba(160,160,160,0.25)", legendBorder: "rgba(160,160,160,0.4)", surface: "transparent" },
} as const;

/** Untranslated empty-state message; translate with getChartEmptyMessage(). */
export const CHART_EMPTY_MESSAGE = "No data available for this chart.";

/** Translated message shown instead of a chart that has nothing to draw. */
export const getChartEmptyMessage = (): string => _(CHART_EMPTY_MESSAGE);

/**
 * The standard Plotly layout: transparent backgrounds, theme-aware text and
 * grid colours, the shared palette, the CHART_LEGEND legend and value axes
 * formatted with CHART_NUMBER_FORMAT.
 *
 * @param dark True when the page uses the dark theme.
 * @param title Chart title shown above the plot ("" for none).
 * @param overrides Layout keys merged last, for chart-type-specific settings.
 */
export const buildStandardChartLayout = (dark: boolean, title: string, overrides: Record<string, any> = {}): Record<string, any> => {
    const colors = dark ? CHART_THEME_COLORS.dark : CHART_THEME_COLORS.light;
    const axis = {
        gridcolor: colors.grid,
        zeroline: false,
        automargin: true,
        color: colors.text,
        tickfont: { size: CHART_FONT_SIZE, color: colors.text },
        hoverformat: CHART_NUMBER_FORMAT,
    };
    return {
        title: title ? { text: title, x: 0, xanchor: "left", font: { size: 14, color: colors.text } } : undefined,
        colorway: [...CHART_COLORWAY],
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { family: CHART_FONT_FAMILY, size: CHART_FONT_SIZE, color: colors.text },
        margin: { l: 8, r: 8, t: title ? 44 : 16, b: 8 },
        showlegend: true,
        legend: {
            ...CHART_LEGEND,
            bgcolor: "rgba(0,0,0,0)",
            bordercolor: colors.legendBorder,
            borderwidth: 1,
            font: { size: CHART_FONT_SIZE, color: colors.text },
        },
        hoverlabel: { namelength: -1 },
        // Text that does not fit its slice or bar is hidden rather than drawn outside it.
        uniformtext: { mode: "hide", minsize: 10 },
        xaxis: { ...axis },
        yaxis: { ...axis },
        ...overrides,
    };
};

/**
 * Re-colour an already drawn Plotly graph for the light or dark theme: its text,
 * axes, grid and legend take the CHART_THEME_COLORS of that theme.
 *
 * Backend-built charts are drawn with the light colours (the server cannot know
 * the viewer's theme); InlinePlotlyHtml calls this on them so they follow the
 * page theme like the Analyze charts do.
 *
 * @param graphDiv A Plotly graph div (`.js-plotly-plot`).
 * @param dark True for the dark theme.
 * @param plotly The Plotly.js API.
 */
export const applyChartThemeToGraph = (graphDiv: any, dark: boolean, plotly: any): void => {
    const fullLayout = graphDiv?._fullLayout;
    if (!fullLayout || !plotly?.relayout) return;
    const colors = dark ? CHART_THEME_COLORS.dark : CHART_THEME_COLORS.light;
    const update: Record<string, any> = {
        "font.color": colors.text,
        "legend.font.color": colors.text,
        "legend.bordercolor": colors.legendBorder,
        "title.font.color": colors.text,
    };
    // Every cartesian axis of every subplot (xaxis, xaxis2, yaxis, ...).
    Object.keys(fullLayout)
        .filter((key) => /^[xy]axis\d*$/.test(key))
        .forEach((axis) => {
            update[`${axis}.color`] = colors.text;
            update[`${axis}.tickfont.color`] = colors.text;
            update[`${axis}.gridcolor`] = colors.grid;
        });
    try {
        plotly.relayout(graphDiv, update);
    } catch {
        // A graph mid-(re)render can reject a relayout; the next theme pass retries.
    }
};

/**
 * Loads the Plotly.js runtime once per page.
 *
 * The runtime is the framework's vendored copy
 * (backend/veloiq_framework/static_assets/plotly.min.js, served at
 * /veloiq-assets/plotly.min.js in every host app) rather than the cdn.plot.ly
 * CDN, so charts render without internet access. Every chart in veloiq-ui
 * (the Analyze section and the backend HTML hosted by InlinePlotlyHtml) loads
 * Plotly through here, so the page never carries two <script> tags for it.
 */

/** URL the host app serves the vendored Plotly.js runtime from. */
export const PLOTLY_RUNTIME_URL = "/veloiq-assets/plotly.min.js";

let plotlyLoadPromise: Promise<void> | null = null;

/** Resolves once `window.Plotly` is available (or the script failed to load). */
export const ensurePlotly = (): Promise<void> => {
    if ((window as any).Plotly) return Promise.resolve();
    if (plotlyLoadPromise) return plotlyLoadPromise;
    plotlyLoadPromise = new Promise<void>((resolve) => {
        const existing = document.querySelector('script[data-jm-plotly-loader="1"]');
        if (existing) {
            existing.addEventListener("load", () => resolve());
            return;
        }
        const script = document.createElement("script");
        script.src = PLOTLY_RUNTIME_URL;
        script.async = true;
        script.setAttribute("data-jm-plotly-loader", "1");
        script.onload = () => resolve();
        script.onerror = () => resolve(); // don't block forever on load failure
        document.head.appendChild(script);
    });
    return plotlyLoadPromise;
};

/** The loaded Plotly.js API, or undefined before ensurePlotly() has resolved. */
export const getPlotly = (): any => (window as any).Plotly;

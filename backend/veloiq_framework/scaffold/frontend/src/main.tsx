import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

async function loadLocale(): Promise<void> {
    const lang = navigator.language.split("-")[0];
    const urls = lang !== "en"
        ? [`/i18n/${lang}.json`, "/i18n/en.json"]
        : ["/i18n/en.json"];

    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const catalogue: Record<string, string> = await res.json();
            (window as any)._ = (text: string) => catalogue[text] ?? text;
            return;
        } catch {
            // try next URL
        }
    }
}

loadLocale().then(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
});

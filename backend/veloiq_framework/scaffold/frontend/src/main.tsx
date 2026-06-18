import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

async function loadLocale(): Promise<void> {
    // Explicit override: ?lang=es in the URL (persisted to localStorage) or a
    // previously-saved localStorage "locale" take precedence over the browser's
    // primary language, so users can switch language instead of being locked to
    // their OS/browser setting.
    try {
        const urlLang = new URLSearchParams(window.location.search).get("lang");
        if (urlLang) localStorage.setItem("locale", urlLang.split("-")[0].toLowerCase());
    } catch { /* ignore: storage/URL unavailable */ }

    let lang = "";
    try { lang = (localStorage.getItem("locale") || "").split("-")[0].toLowerCase(); } catch { /* ignore */ }
    if (!lang) lang = navigator.language.split("-")[0].toLowerCase();

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

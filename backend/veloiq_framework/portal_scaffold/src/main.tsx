import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Locale + translation catalogue (the host app's, from /i18n/<locale>.json) are
// loaded synchronously in index.html, before this module ever evaluates.
ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

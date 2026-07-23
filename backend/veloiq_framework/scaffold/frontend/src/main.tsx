import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Locale + translation catalogue are loaded synchronously in index.html,
// before this module (and everything it imports, including App and its
// dependencies) ever evaluates — see the comment there for why that matters.
ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

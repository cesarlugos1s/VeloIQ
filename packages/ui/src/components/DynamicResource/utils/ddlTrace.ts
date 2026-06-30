// Dev-only trace helper for the Data Detail Level feature.
// Buffers trace lines in memory and POSTs them (fire-and-forget) to the
// backend dev sink at /api/debug/ddl-trace, which appends them to
// /tmp/veloiq_ddl_trace.log so they can be read without a browser console.
//
// Safe to leave in place; no-ops if the fetch fails.
//
// ── Usage ──────────────────────────────────────────────────────────────
//   In code:    import { ddlTrace } from ".../utils/ddlTrace";
//               ddlTrace("label", { key: "value" });
//
//   Browser:    ddlTrace("manual trace", { foo: "bar" });
//               ddlTraceClear();    // reset server-side log
//               window.__DDL_TRACE__  // in-memory buffer (before flush)
//
//   Server:     cat /tmp/veloiq_ddl_trace.log
//
//   Cleanup:    Call ddlTraceClear() from browser console, or
//               rm /tmp/veloiq_ddl_trace.log on the server.
// ───────────────────────────────────────────────────────────────────────

import { authenticatedFetch } from "../../../utils/authenticatedFetch";

const BUFFER: string[] = [];
const MAX_BUFFER = 500;
(window as any).__DDL_TRACE__ = BUFFER;

let flushScheduled = false;

const flush = () => {
    flushScheduled = false;
    if (BUFFER.length === 0) return;
    const lines = BUFFER.splice(0, BUFFER.length);
    try {
        const apiUrl = (window as any).VELOIQ_API_URL || "/api";
        void authenticatedFetch(`${apiUrl}/debug/ddl-trace`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lines }),
        }).catch(() => {
            // Re-buffer on failure so nothing is lost during a quick burst.
            BUFFER.unshift(...lines.slice(0, MAX_BUFFER - BUFFER.length));
        });
    } catch {
        /* ignore */
    }
};

const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    setTimeout(flush, 200);
};

/** Append a trace line. Accepts a string or a JSON-serializable object. */
export const ddlTrace = (label: string, payload?: unknown) => {
    let line: string;
    if (payload === undefined) {
        line = label;
    } else {
        try {
            line = `${label} ${JSON.stringify(payload)}`;
        } catch {
            line = `${label} [unserializable payload]`;
        }
    }
    BUFFER.push(line);
    if (BUFFER.length > MAX_BUFFER) BUFFER.splice(0, BUFFER.length - MAX_BUFFER);
    // Uncomment below to see traces in browser console during debugging:
    // console.log(`[DDL:TRACE] ${line}`);
    scheduleFlush();
};

/** Clear the server-side trace log (/tmp/veloiq_ddl_trace.log). */
export const ddlTraceClear = () => {
    BUFFER.length = 0;
    try {
        const apiUrl = (window as any).VELOIQ_API_URL || "/api";
        void authenticatedFetch(`${apiUrl}/debug/ddl-trace`, { method: "DELETE" }).catch(() => {});
    } catch {
        /* ignore */
    }
};

// Expose helpers for manual use from the dev console.
(window as any).ddlTrace = ddlTrace;
(window as any).ddlTraceClear = ddlTraceClear;


/**
 * Keep the app working when the machine has no internet connection.
 *
 * TanStack Query's default `networkMode: "online"` pauses every query and
 * mutation while `navigator.onLine` is false, and only resumes them when the
 * browser reports it is back online.  VeloIQ host apps are served by their own
 * backend (same host), so an offline browser must not stop them: without this,
 * clicking "Login" on a machine with no internet sends no request at all and
 * the UI hangs until the network returns.
 *
 * Treat the app as always online.  Genuine failures still surface as ordinary
 * request errors instead of silently paused requests.
 *
 * Runs once, on import of the package, so every host app gets it regardless of
 * how it builds its QueryClient (Refine builds its own unless given one).
 */
import { onlineManager } from "@tanstack/react-query";

// Stop the default window "online"/"offline" listeners from updating the state...
onlineManager.setEventListener(() => () => {});
// ...and pin it to online.
onlineManager.setOnline(true);

/**
 * The locale the user is running the app in: the saved ``locale`` choice
 * (set from ``?lang=`` or the language switcher), else the browser language.
 *
 * Sent to the backend as ``Accept-Language`` so server-built text (record
 * titles, charts, messages) uses the same ``messages.po`` locale as the UI.
 */
export const getActiveLocale = (): string => {
    try {
        return (localStorage.getItem("locale") || navigator.language || "en").split("-")[0].toLowerCase();
    } catch {
        return "en";
    }
};

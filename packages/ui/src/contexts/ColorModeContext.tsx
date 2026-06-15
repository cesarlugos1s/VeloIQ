import { createContext } from "react";

export const ColorModeContext = createContext<{
    mode: "light" | "dark";
    setMode: (mode: "light" | "dark") => void;
    /** Increments every time the color schema (plain-color / color-coded / hex)
     *  changes via setColorSchemas().  Components that depend on derived tones
     *  use this to re-render when the schema updates. */
    schemaVersion: number;
}>({ mode: "light", setMode: () => {}, schemaVersion: 0 });
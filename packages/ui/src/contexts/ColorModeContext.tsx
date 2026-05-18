import { createContext } from "react";

export const ColorModeContext = createContext<{
    mode: "light" | "dark";
    setMode: (mode: "light" | "dark") => void;
}>({ mode: "light", setMode: () => {} });
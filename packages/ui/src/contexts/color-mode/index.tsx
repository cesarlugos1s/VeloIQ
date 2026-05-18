import { RefineThemes } from "@refinedev/antd";
import { ConfigProvider, theme } from "antd";
import {
  type PropsWithChildren,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { ColorModeContext } from "../ColorModeContext";
import { authenticatedFetch } from "../../utils/authenticatedFetch";

const API_BASE_URL = "/api";

export const ColorModeContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const colorModeFromLocalStorage = localStorage.getItem("colorMode");
  const isSystemPreferenceDark = window?.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  const systemPreference = isSystemPreferenceDark ? "dark" : "light";
  const [mode, setMode] = useState<"light" | "dark">(
    (colorModeFromLocalStorage === "dark" || colorModeFromLocalStorage === "light"
      ? colorModeFromLocalStorage
      : systemPreference) as "light" | "dark"
  );
  const initializedFromServer = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await authenticatedFetch(`${API_BASE_URL}/views/preferences/color-mode`);
        if (!resp.ok) return;
        const data = await resp.json();
        const serverMode = data?.colorMode;
        if (!cancelled && (serverMode === "light" || serverMode === "dark")) {
          setMode(serverMode);
          localStorage.setItem("colorMode", serverMode);
        }
      } catch (_e) { /* keep current */ }
      initializedFromServer.current = true;
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("colorMode", mode);
    document.body.classList.toggle("jm-dark", mode === "dark");
    document.body.classList.toggle("jm-light", mode === "light");
  }, [mode]);

  const saveToServer = useCallback(async (newMode: string) => {
    try {
      await authenticatedFetch(`${API_BASE_URL}/views/preferences/color-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorMode: newMode }),
      });
    } catch (_e) { /* silent */ }
  }, []);

  const setColorMode = useCallback((newMode: "light" | "dark") => {
    setMode(newMode);
    void saveToServer(newMode);
  }, [saveToServer]);

  const { darkAlgorithm, defaultAlgorithm } = theme;

  return (
    <ColorModeContext.Provider value={{ mode, setMode: setColorMode }}>
      <ConfigProvider
        theme={{
          ...RefineThemes.Blue,
          algorithm: mode === "light" ? defaultAlgorithm : darkAlgorithm,
        }}
      >
        {children}
      </ConfigProvider>
    </ColorModeContext.Provider>
  );
};

import { useState, useEffect, useCallback, useRef } from "react";
import { api, AuthError, getToken, clearToken } from "./api";
import { AppInfo, AppSchema, Page } from "./types";
import Layout from "./components/Layout";
import LoginForm from "./components/LoginForm";
import Spinner from "./components/Spinner";
import Summary from "./pages/Summary";
import SchemaBrowser from "./pages/SchemaBrowser";
import DashboardConfig from "./pages/DashboardConfig";
import SearchConfig from "./pages/SearchConfig";
import Extensions from "./pages/Extensions";
import HealthCheck from "./pages/HealthCheck";
import CommandPanel from "./pages/CommandPanel";

export default function App() {
  const [token, setToken] = useState(getToken());
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [schema, setSchema] = useState<AppSchema | null>(null);
  const [page, setPage] = useState<Page>("summary");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  // Deduplicate concurrent loadSchema calls with an in-flight promise ref.
  const inflightRef = useRef<Promise<AppSchema> | null>(null);

  const logout = useCallback(() => {
    clearToken();
    setToken("");
    setInfo(null);
    setSchema(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .info()
      .then(setInfo)
      .catch((e) => { if (e instanceof AuthError) logout(); })
      .finally(() => setLoading(false));
  }, [token, logout]);

  const loadSchema = useCallback(async (): Promise<AppSchema> => {
    if (schema) return schema;
    if (inflightRef.current) return inflightRef.current;
    inflightRef.current = api.schema().then((s) => {
      setSchema(s);
      inflightRef.current = null;
      return s;
    });
    return inflightRef.current;
  }, [schema]);

  /** Called by CommandCard after a successful command + generate chain. */
  const invalidateSchema = useCallback(() => {
    setSchema(null);
    setRefreshToken((n) => n + 1);
  }, []);

  const handleLogin = async (username: string, password: string) => {
    setLoginError("");
    try {
      await api.login(username, password);
      setToken(getToken());
    } catch {
      setLoginError("Invalid username or password");
    }
  };

  if (!token) return <LoginForm onLogin={handleLogin} error={loginError} />;
  if (loading || !info) return <Spinner />;

  const dev = info.dev_mode;

  const pages: Record<Page, React.ReactNode> = {
    summary: <Summary info={info} schema={schema} loadSchema={loadSchema} />,
    schema: (
      <SchemaBrowser
        schema={schema}
        loadSchema={loadSchema}
        devMode={dev}
        onSuccess={invalidateSchema}
      />
    ),
    dashboard: (
      <DashboardConfig
        devMode={dev}
        schema={schema}
        loadSchema={loadSchema}
        refreshToken={refreshToken}
        onSuccess={invalidateSchema}
      />
    ),
    search: (
      <SearchConfig
        devMode={dev}
        schema={schema}
        loadSchema={loadSchema}
        refreshToken={refreshToken}
        onSuccess={invalidateSchema}
      />
    ),
    extensions: <Extensions devMode={dev} onSuccess={invalidateSchema} />,
    health: <HealthCheck />,
    commands: (
      <CommandPanel
        schema={schema}
        loadSchema={loadSchema}
        onSuccess={invalidateSchema}
      />
    ),
  };

  return (
    <Layout info={info} page={page} onNavigate={setPage} onLogout={logout}>
      {pages[page]}
    </Layout>
  );
}

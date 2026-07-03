import { useState } from "react";
import { api } from "../api";
import Terminal from "./Terminal";

type DbType = "postgresql" | "mysql" | "mariadb" | "sqlite" | "mssql" | "oracle" | "snowflake" | "duckdb" | "clickhouse" | "bigquery";

interface ConnFields {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  filepath: string;
}

const DEFAULT_PORTS: Record<DbType, string> = {
  postgresql: "5432",
  mysql: "3306",
  mariadb: "3306",
  sqlite: "",
  mssql: "1433",
  oracle: "1521",
  snowflake: "443",
  duckdb: "",
  clickhouse: "8123",
  bigquery: "",
};

const DRIVERS: Record<DbType, string> = {
  postgresql: "postgresql+psycopg2",
  mysql: "mysql+pymysql",
  mariadb: "mariadb+pymysql",
  sqlite: "sqlite",
  mssql: "mssql+pyodbc",
  oracle: "oracle+oracledb",
  snowflake: "snowflake",
  duckdb: "duckdb",
  clickhouse: "clickhouse",
  bigquery: "bigquery",
};

function buildUrl(dbType: DbType, conn: ConnFields): string {
  if (dbType === "sqlite") {
    const p = conn.filepath.trim();
    return p.startsWith("/") ? `sqlite:///${p}` : `sqlite:///${p}`;
  }
  const driver = DRIVERS[dbType];
  const userPart = conn.username
    ? `${encodeURIComponent(conn.username)}:${encodeURIComponent(conn.password)}@`
    : "";
  const portPart = conn.port ? `:${conn.port}` : "";
  return `${driver}://${userPart}${conn.host}${portPart}/${conn.database}`;
}

async function runAndStream(
  command: string,
  onLine: (l: string) => void,
  onDone: (rc: number) => void,
  onError: (e: string) => void
) {
  try {
    const { run_id } = await api.runCommand(command);
    await api.streamCommand(run_id, onLine, onDone, onError);
  } catch (e) {
    onError(String(e));
  }
}

async function waitForServer(maxWait = 15_000): Promise<boolean> {
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    try { await api.info(); return true; } catch { await new Promise((r) => setTimeout(r, 800)); }
  }
  return false;
}

interface Props {
  modules: string[];
  onSuccess?: () => void;
}

type Step = "connect" | "tables" | "run";

export default function ImportSchemaCard({ modules, onSuccess }: Props) {
  const [dbType, setDbType] = useState<DbType>("postgresql");
  const [conn, setConn] = useState<ConnFields>({
    host: "localhost", port: "5432", database: "", username: "", password: "", filepath: "",
  });
  const [step, setStep] = useState<Step>("connect");
  const [connectError, setConnectError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [availTables, setAvailTables] = useState<string[]>([]);
  const [availJunctions, setAvailJunctions] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [module, setModule] = useState(modules[0] ?? "");
  const [newModule, setNewModule] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [returncode, setReturncode] = useState<number | null>(null);
  const [currentDbUrl, setCurrentDbUrl] = useState<string | null>(null);
  const [envFile, setEnvFile] = useState<string | null>(null);
  const [updatingEnv, setUpdatingEnv] = useState(false);
  const [envUpdated, setEnvUpdated] = useState(false);

  const setField = (k: keyof ConnFields, v: string) => setConn((c) => ({ ...c, [k]: v }));

  const handleDbTypeChange = (t: DbType) => {
    setDbType(t);
    setField("port", DEFAULT_PORTS[t]);
    setStep("connect");
    setConnectError("");
    setAvailTables([]);
    setSelectedTables(new Set());
  };

  const canConnect =
    dbType === "sqlite"
      ? conn.filepath.trim().length > 0
      : conn.host.trim().length > 0 && conn.database.trim().length > 0;

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError("");
    const url = buildUrl(dbType, conn);
    try {
      const { tables, junctions } = await api.importSchemaTables(url);
      setAvailTables(tables);
      setAvailJunctions(junctions);
      setSelectedTables(new Set(tables)); // select all by default
      setStep("tables");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setConnectError(msg.replace(/^400 /, ""));
    } finally {
      setConnecting(false);
    }
  };

  const toggleTable = (t: string) =>
    setSelectedTables((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const toggleAll = () =>
    setSelectedTables(selectedTables.size === availTables.length ? new Set() : new Set(availTables));

  const targetModule = newModule.trim() || module;
  const canRun = selectedTables.size > 0 && targetModule.trim().length > 0 && !running;

  const handleRun = async () => {
    const url = buildUrl(dbType, conn);
    const allSelected = [...selectedTables, ...availJunctions].join(",");
    const cmd = `veloiq import-schema --url "${url}" --module ${targetModule} --tables ${allSelected}`;
    setLines([`$ ${cmd}`]);
    setReturncode(null);
    setRunning(true);
    setStep("run");

    let cmdRc: number | null = null;
    await runAndStream(cmd, (l) => setLines((p) => [...p, l]), (rc) => { cmdRc = rc; }, (err) => { setLines((p) => [...p, `error: ${err}`]); cmdRc = 1; });

    if (cmdRc === null) {
      setLines((p) => [...p, "⚠  Connection lost — waiting for server reload…"]);
      const ok = await waitForServer();
      if (!ok) { setLines((p) => [...p, "✗  Server did not recover"]); setReturncode(1); setRunning(false); return; }
      setLines((p) => [...p, "✓  Server back online"]);
      cmdRc = 0;
    }

    setReturncode(cmdRc);
    setRunning(false);
    if (cmdRc === 0) {
      onSuccess?.();
      // Check if DATABASE_URL needs updating
      try {
        const { database_url, env_file } = await api.getDatabaseUrl();
        const sourceUrl = buildUrl(dbType, conn);
        if (database_url !== sourceUrl) {
          setCurrentDbUrl(database_url);
          setEnvFile(env_file);
        }
      } catch { /* non-critical */ }
    }
  };

  const handleUpdateEnv = async () => {
    setUpdatingEnv(true);
    try {
      await api.setDatabaseUrl(buildUrl(dbType, conn));
      setEnvUpdated(true);
      setCurrentDbUrl(null);
    } catch (e) {
      setLines((p) => [...p, `error updating .env: ${e}`]);
    } finally {
      setUpdatingEnv(false);
    }
  };

  return (
    <div className="vs-cmd-card">
      <div className="vs-cmd-card-hdr">
        <div className="vs-cmd-card-title">Import Schema</div>
        <div className="vs-cmd-card-desc">
          Generate SQLModel classes from an existing database — reads tables, columns, FKs, and M2M relations automatically.
        </div>
      </div>

      <div className="vs-cmd-card-body">
        {/* ── Step 1: Connection ─────────────────────────────────── */}
        <div className="vs-inline-field">
          <label>Database type</label>
          <select value={dbType} onChange={(e) => handleDbTypeChange(e.target.value as DbType)}>
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="mariadb">MariaDB</option>
            <option value="sqlite">SQLite</option>
            <option value="mssql">SQL Server (MSSQL)</option>
            <option value="oracle">Oracle</option>
            <option value="snowflake">Snowflake</option>
            <option value="duckdb">DuckDB</option>
            <option value="clickhouse">ClickHouse</option>
            <option value="bigquery">BigQuery</option>
          </select>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, marginBottom: 6 }}>
          Need a database not listed here? Use the CLI with any{" "}
          <a href="https://docs.sqlalchemy.org/en/20/dialects/" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>
            SQLAlchemy dialect
          </a>{" "}
          (examples below).  Install the matching driver first, then pass the full URL via <code style={{ fontSize: 11 }}>--url</code>:
          <br />
          <code style={{ fontSize: 11 }}>pip install sqlalchemy-cockroachdb</code>
          <br />
          <code style={{ fontSize: 11 }}>veloiq import-schema --url cockroachdb+psycopg2://user:pass@host:26257/mydb</code>
        </div>

        {dbType === "sqlite" ? (
          <div className="vs-inline-field">
            <label>File path</label>
            <input type="text" placeholder="/path/to/database.db" value={conn.filepath} onChange={(e) => setField("filepath", e.target.value)} />
          </div>
        ) : (
          <>
            <div className="vs-inline-field">
              <label>Host</label>
              <input type="text" placeholder="localhost" value={conn.host} onChange={(e) => setField("host", e.target.value)} />
            </div>
            <div className="vs-inline-field">
              <label>Port</label>
              <input type="text" placeholder={DEFAULT_PORTS[dbType]} value={conn.port} onChange={(e) => setField("port", e.target.value)} style={{ maxWidth: 80 }} />
            </div>
            <div className="vs-inline-field">
              <label>Database</label>
              <input type="text" placeholder="database name" value={conn.database} onChange={(e) => setField("database", e.target.value)} />
            </div>
            <div className="vs-inline-field">
              <label>Username</label>
              <input type="text" placeholder="optional" value={conn.username} onChange={(e) => setField("username", e.target.value)} />
            </div>
            <div className="vs-inline-field">
              <label>Password</label>
              <input type="password" placeholder="optional" value={conn.password} onChange={(e) => setField("password", e.target.value)} />
            </div>
          </>
        )}

        {connectError && (
          <div style={{ color: "var(--err, #e55)", fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            ✗ {connectError}
          </div>
        )}

        <button
          className="vs-btn-run"
          style={{ marginTop: 8 }}
          disabled={!canConnect || connecting}
          onClick={handleConnect}
        >
          {connecting ? "Connecting…" : step === "tables" || step === "run" ? "Re-connect" : "Connect & List Tables"}
        </button>

        {/* ── Step 2: Table selection ────────────────────────────── */}
        {step !== "connect" && availTables.length > 0 && (
          <>
            <div style={{ marginTop: 16, marginBottom: 4, fontWeight: 600, fontSize: 13 }}>
              Tables
              <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 8, fontSize: 12 }}>
                ({selectedTables.size}/{availTables.length} selected)
              </span>
              <button
                onClick={toggleAll}
                style={{ marginLeft: 8, fontSize: 11, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0 }}
              >
                {selectedTables.size === availTables.length ? "deselect all" : "select all"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "4px 12px", maxHeight: 240, overflowY: "auto", padding: "6px 0" }}>
              {availTables.map((t) => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={selectedTables.has(t)} onChange={() => toggleTable(t)} style={{ accentColor: "var(--accent)" }} />
                  {t}
                </label>
              ))}
            </div>
            {availJunctions.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Auto-included junction tables: {availJunctions.join(", ")}
              </div>
            )}

            {/* ── Module ──────────────────────────────────────────── */}
            <div style={{ marginTop: 14 }}>
              <div className="vs-inline-field">
                <label>Target module</label>
                {modules.length > 0 ? (
                  <select value={module} onChange={(e) => setModule(e.target.value)}>
                    {modules.map((m) => <option key={m} value={m}>{m}</option>)}
                    <option value="__new__">— create new —</option>
                  </select>
                ) : null}
              </div>
              {(module === "__new__" || modules.length === 0) && (
                <div className="vs-inline-field">
                  <label>New module name</label>
                  <input type="text" placeholder="e.g. legacy" value={newModule} onChange={(e) => setNewModule(e.target.value)} />
                </div>
              )}
            </div>

            {!canRun && !running && selectedTables.size === 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Select at least one table.</div>
            )}

            <button className="vs-btn-run" disabled={!canRun} onClick={handleRun} style={{ marginTop: 10 }}>
              {running ? "Running…" : "Run Import"}
            </button>
          </>
        )}

        {/* ── Terminal output ────────────────────────────────────── */}
        {lines.length > 0 && (
          <Terminal lines={lines} running={running} returncode={returncode} />
        )}

        {/* ── Point DATABASE_URL at the source DB ───────────────── */}
        {currentDbUrl !== null && !envUpdated && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--surface-hover, rgba(255,255,255,0.05))", borderRadius: 6, border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Point this app at the source database?</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
              Current: <code style={{ fontSize: 11 }}>{currentDbUrl ?? "not set"}</code>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              Source: <code style={{ fontSize: 11 }}>{buildUrl(dbType, conn)}</code>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
              Updates <code style={{ fontSize: 11 }}>{envFile ?? ".env"}</code> and restarts the server.
            </div>
            <button className="vs-btn-run" disabled={updatingEnv} onClick={handleUpdateEnv}>
              {updatingEnv ? "Updating…" : "Yes, update DATABASE_URL"}
            </button>
            <button
              onClick={() => setCurrentDbUrl(null)}
              style={{ marginLeft: 8, fontSize: 12, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
            >
              Skip
            </button>
          </div>
        )}
        {envUpdated && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--ok, #4c4)" }}>
            ✓ DATABASE_URL updated — restart the server to connect to the source database.
          </div>
        )}
      </div>
    </div>
  );
}

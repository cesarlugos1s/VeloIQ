const TOKEN_KEY = "jm_access_token";
const BASE = "/veloiq-studio/api";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

export class AuthError extends Error {
  constructor() {
    super("Authentication required");
  }
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (r.status === 401) throw new AuthError();
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (r.status === 401) throw new AuthError();
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (r.status === 401) throw new AuthError();
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (r.status === 401) throw new AuthError();
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export const api = {
  login: async (username: string, password: string): Promise<void> => {
    const r = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error("Invalid credentials");
    const data = await r.json();
    setToken(data.access_token);
  },

  info: () => get<import("./types").AppInfo>("/info"),
  schema: () => get<import("./types").AppSchema>("/schema"),
  dashboard: () =>
    get<{ models: import("./types").DashboardModel[] }>("/config/dashboard"),
  search: () => get<import("./types").SearchConfig>("/config/search"),
  extensions: () =>
    get<{ extensions: import("./types").ExtInfo[] }>("/extensions"),
  health: () =>
    get<{ stdout: string; stderr: string; returncode: number }>("/health"),
  runCommand: (command: string) =>
    post<{ run_id: string }>("/commands/run", { command }),

  namedQueries: () =>
    get<{ named_queries: import("./types").NamedQueryDef[] }>("/named-queries"),
  createNamedQuery: (def: import("./types").NamedQueryDef) =>
    post<{ ok: boolean; name: string }>("/named-queries", def),
  updateNamedQuery: (module: string, name: string, def: import("./types").NamedQueryDef) =>
    put<{ ok: boolean }>(`/named-queries/${module}/${name}`, def),
  deleteNamedQuery: (module: string, name: string) =>
    del<{ ok: boolean }>(`/named-queries/${module}/${name}`),

  streamCommand: async (
    run_id: string,
    onLine: (line: string) => void,
    onDone: (returncode: number) => void,
    onError: (err: string) => void
  ): Promise<void> => {
    let response: Response;
    try {
      response = await fetch(`${BASE}/commands/stream/${run_id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    } catch (e) {
      onError(String(e));
      return;
    }
    if (!response.ok || !response.body) {
      onError(`Stream error: ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const data = JSON.parse(dataLine.slice(6));
          if (data.done) onDone(data.returncode as number);
          else if (data.line !== undefined) onLine(data.line as string);
        } catch {
          // ignore malformed SSE
        }
      }
    }
  },
};

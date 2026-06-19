import { api } from "../api";

/**
 * Commands that must NOT trigger an automatic `veloiq generate` afterward
 * (they either are generate, or don't change schemas).
 */
export const SKIP_AUTO_GENERATE = new Set([
  "veloiq generate",
  "veloiq check",
  "veloiq build",
  "veloiq migrate",
  "veloiq db upgrade",
]);

export async function runAndStream(
  command: string,
  onLine: (l: string) => void,
  onDone: (rc: number) => void,
  onError: (e: string) => void
): Promise<void> {
  try {
    const { run_id } = await api.runCommand(command);
    await api.streamCommand(run_id, onLine, onDone, onError);
  } catch (e) {
    onError(String(e));
  }
}

export async function waitForServer(maxWait = 15_000): Promise<boolean> {
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    try {
      await api.info();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return false;
}

export interface ExecuteCommandOptions {
  command: string;
  append: (line: string) => void;
  setReturncode: (rc: number | null) => void;
  setRunning: (running: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Run a whitelisted CLI command, streaming its output, recovering from a
 * dev-server reload that cuts the stream, then auto-running `veloiq generate`
 * unless the command is one that already regenerates / shouldn't.
 */
export async function executeCommand(opts: ExecuteCommandOptions): Promise<void> {
  const { command, append, setReturncode, setRunning, onSuccess } = opts;

  let cmdRc: number | null = null;
  await runAndStream(
    command,
    append,
    (rc) => { cmdRc = rc; },
    (err) => { append(`error: ${err}`); cmdRc = 1; }
  );

  // cmdRc === null means the stream was cut without a done event (server reloaded).
  // The subprocess survives the reload; wait for the server then continue.
  if (cmdRc === null) {
    append("⚠  Connection lost — waiting for server reload…");
    const recovered = await waitForServer();
    if (!recovered) {
      append("✗  Server did not recover within 15 s");
      setReturncode(1);
      setRunning(false);
      return;
    }
    append("✓  Server back online");
    cmdRc = 0;
  }

  if (cmdRc !== 0) {
    setReturncode(cmdRc);
    setRunning(false);
    return;
  }

  if (!SKIP_AUTO_GENERATE.has(command)) {
    append("");
    append("─── veloiq generate ───");
    let genRc: number | null = null;
    await runAndStream(
      "veloiq generate",
      append,
      (rc) => { genRc = rc; },
      (err) => { append(`error: ${err}`); genRc = 1; }
    );
    if (genRc === null) {
      append("⚠  Generate connection lost — waiting for server…");
      const recovered = await waitForServer();
      genRc = recovered ? 0 : 1;
      if (recovered) append("✓  Schema updated in background");
    }
    setReturncode(genRc);
    setRunning(false);
    if (genRc === 0) onSuccess?.();
  } else {
    setReturncode(cmdRc);
    setRunning(false);
    if (cmdRc === 0) onSuccess?.();
  }
}

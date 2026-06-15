import { useState } from "react";
import { api } from "../api";
import Terminal from "../components/Terminal";

export default function HealthCheck() {
  const [lines, setLines] = useState<string[]>([]);
  const [returncode, setReturncode] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setLines([]);
    setReturncode(null);
    setRunning(true);
    try {
      const { run_id } = await api.runCommand("veloiq check");
      await api.streamCommand(
        run_id,
        (line) => setLines((prev) => [...prev, line]),
        (rc) => { setReturncode(rc); setRunning(false); },
        (err) => { setLines([err]); setRunning(false); }
      );
    } catch (e) {
      setLines([String(e)]);
      setRunning(false);
    }
  };

  return (
    <div className="vs-page">
      <div className="vs-page-title">Health Check</div>
      <div className="vs-page-subtitle">
        Runs <code>veloiq check</code> and streams the report
      </div>

      <button className="vs-btn-run" onClick={run} disabled={running}>
        {running ? "Running…" : "Run veloiq check"}
      </button>

      {(lines.length > 0 || running) && (
        <Terminal lines={lines} running={running} returncode={returncode} />
      )}
    </div>
  );
}

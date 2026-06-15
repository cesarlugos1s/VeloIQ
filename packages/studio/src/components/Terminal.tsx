import { useEffect, useRef } from "react";

interface Props {
  lines: string[];
  running?: boolean;
  returncode?: number | null;
}

export default function Terminal({ lines, running, returncode }: Props) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="vs-terminal">
      <div className="vs-terminal-bar">
        {running && <span className="vs-terminal-running">running</span>}
        {!running && returncode !== null && returncode !== undefined && (
          <span className={returncode === 0 ? "vs-terminal-ok" : "vs-terminal-err"}>
            exit {returncode}
          </span>
        )}
        {!running && returncode === null && lines.length === 0 && (
          <span style={{ color: "var(--text-muted)" }}>ready</span>
        )}
      </div>
      <pre ref={ref} className="vs-terminal-output">
        {lines.length > 0 ? lines.join("\n") : "(no output yet)"}
      </pre>
    </div>
  );
}

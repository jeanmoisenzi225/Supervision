import type { AppStatus } from "../lib/api";
import { STATUS_LABEL } from "../lib/format";

export function StatusBadge({ status }: { status: AppStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="dot" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: "critical" | "warning" | "info" }) {
  const label = severity === "critical" ? "Critique" : severity === "warning" ? "Attention" : "Info";
  return <span className={`sev sev-${severity}`}>{label}</span>;
}

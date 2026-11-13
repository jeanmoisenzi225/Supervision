import { useState } from "react";
import { api, type Alert } from "../lib/api";
import { dateTime, localizeTimes, timeAgo } from "../lib/format";
import { usePolling } from "../lib/usePolling";
import { SeverityBadge } from "./StatusBadge";

const STATUS_LABEL = { open: "Ouverte", acknowledged: "Prise en compte", resolved: "Résolue" };

export function AlertsList({ app, appNames }: { app?: string; appNames?: Record<string, string> }) {
  const [status, setStatus] = useState<"active" | "resolved" | "all">("active");
  const query = new URLSearchParams({ status, ...(app ? { app } : {}) }).toString();
  const { data, error, refresh } = usePolling(() => api<Alert[]>(`/alerts?${query}`), 15_000, [query]);

  async function act(id: string, op: "ack" | "resolve") {
    await api(`/alerts/${id}/${op}`, { method: "POST" });
    await refresh();
  }

  return (
    <div>
      <div className="tabs small-tabs">
        {(["active", "resolved", "all"] as const).map((s) => (
          <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>
            {s === "active" ? "En cours" : s === "resolved" ? "Résolues" : "Toutes"}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="muted">Aucune alerte.</p>}
      <ul className="list">
        {data?.map((a) => (
          <li key={a.id} className={`card alert alert-${a.status}`}>
            <div className="row">
              <SeverityBadge severity={a.severity} />
              {!app && appNames && <span className="pill">{appNames[a.appKey] ?? a.appKey}</span>}
              <span className="muted small grow">{STATUS_LABEL[a.status]}</span>
              {a.count > 1 && <span className="pill">×{a.count}</span>}
            </div>
            <strong>{a.title}</strong>
            {a.detail && <pre className="detail">{localizeTimes(a.detail)}</pre>}
            <div className="row small muted">
              <span className="grow">
                Ouverte le {dateTime(a.openedAt)} · vue {timeAgo(a.lastSeenAt)}
                {a.resolvedAt ? ` · résolue le ${dateTime(a.resolvedAt)}` : ""}
              </span>
              {a.status === "open" && <button onClick={() => act(a.id, "ack")}>Prendre en compte</button>}
              {a.status !== "resolved" && <button onClick={() => act(a.id, "resolve")}>Résoudre</button>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

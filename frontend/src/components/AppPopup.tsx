import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { Alert, AppOverview } from "../lib/api";
import { STATUS_LABEL, timeAgo } from "../lib/format";
import { AppMark } from "./Constellation";
import { ProcediaDetails } from "./ProcediaDetails";

/** Fenêtre à fond transparent des informations clés d'une appli, ouverte depuis la constellation (v0.41.0). */
export function AppPopup({ app, alerts, onClose }: { app: AppOverview; alerts: Alert[]; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const ups = app.checks.map((c) => c.uptime24h).filter((x): x is number => x !== null);
  const lat = app.checks.map((c) => c.last?.latencyMs).filter((x): x is number => typeof x === "number");
  const mine = alerts.filter((a) => a.appKey === app.key);
  const tone = app.status === "ok" ? "ok" : app.status === "degraded" || app.status === "down" ? "warn" : "";
  return (
    <div className="popup-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="popup" role="dialog" aria-label={app.name}>
        <div className="popup-head">
          <AppMark appKey={app.key} size={48} />
          <div className="grow">
            <strong className="popup-title">{app.name}</strong>
            <div className="muted small">{app.description}</div>
          </div>
          <span className={`pill ${tone === "warn" ? "pill-warn" : ""}`}>{STATUS_LABEL[app.status]}</span>
          <button className="link" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="popup-kpis">
          <div><small>Dispo 24 h</small><b className={ups.length && Math.min(...ups) < 99.5 ? "warn-t" : "ok-t"}>{ups.length ? `${String(Math.min(...ups)).replace(".", ",")} %` : "—"}</b></div>
          <div><small>Réponse</small><b>{lat.length ? `${Math.max(...lat)} ms` : "—"}</b></div>
          <div><small>Alertes</small><b className={mine.length ? "warn-t" : ""}>{mine.length}</b></div>
          <div><small>Journaux</small><b className="popup-small">{app.integration.logs ? timeAgo(app.lastLogAt) : "non branchés"}</b></div>
        </div>
        {app.checks.length > 0 && (
          <ul className="popup-checks">
            {app.checks.map((c) => (
              <li key={c.id}>
                <span className={`dot ${c.last ? (c.last.ok ? "ok" : "ko") : ""}`} />
                <span className="grow">{c.label}</span>
                <span className="muted small">{c.last?.latencyMs != null ? `${c.last.latencyMs} ms` : "—"}</span>
                <span className="small">{c.uptime24h != null ? `${c.uptime24h} %` : ""}</span>
              </li>
            ))}
          </ul>
        )}
        {mine.map((a) => (
          <div key={a.id} className="attention">
            <strong>{a.title}</strong>
            {a.detail && <span className="muted small">{a.detail}</span>}
            <span className="muted small">{timeAgo(a.openedAt)}</span>
          </div>
        ))}
        {app.key === "procedia" && <ProcediaDetails />}
        <div className="popup-foot">
          <Link to={`/supervision/applis/${app.key}`}>Ouvrir la fiche →</Link>
          {mine.length > 0 && <Link to="/supervision/alertes">Voir les alertes →</Link>}
        </div>
      </div>
    </div>
  );
}

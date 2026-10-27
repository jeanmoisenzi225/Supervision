import { Link } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { api, type AppOverview } from "../lib/api";
import { timeAgo } from "../lib/format";
import { usePolling } from "../lib/usePolling";

export function Dashboard() {
  const { data, error, updatedAt } = usePolling(() => api<{ apps: AppOverview[] }>("/overview"), 15_000);
  const apps = data?.apps ?? [];
  const watched = apps.filter((a) => a.status !== "not_deployed");
  const down = watched.filter((a) => a.status === "down" || a.status === "degraded");
  const alerts = apps.reduce((n, a) => n + a.openAlerts, 0);

  return (
    <>
      <section className={`banner ${down.length ? "banner-bad" : "banner-good"}`}>
        <div>
          <strong>
            {!data ? "Chargement…" : down.length ? `${down.length} appli(s) en difficulté` : "Tout fonctionne"}
          </strong>
          <span>
            {watched.length} appli(s) surveillée(s) · {alerts} alerte(s) active(s)
          </span>
        </div>
        <small>{updatedAt ? `Mis à jour ${timeAgo(updatedAt.toISOString())}` : ""}</small>
      </section>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {apps.map((app) => (
          <Link key={app.key} to={`/applis/${app.key}`} className={`card app-card status-${app.status}`}>
            <div className="app-card-head">
              <h2>{app.name}</h2>
              <StatusBadge status={app.status} />
            </div>
            <p className="muted small">{app.description}</p>
            {app.checks.length === 0 ? (
              <p className="muted small">Aucune adresse surveillée pour l'instant.</p>
            ) : (
              <ul className="checks">
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
            <div className="app-card-foot">
              <span className={app.openAlerts ? "pill pill-bad" : "pill"}>{app.openAlerts} alerte(s)</span>
              <span className={app.errors24h ? "pill pill-warn" : "pill"}>{app.errors24h} erreur(s) 24 h</span>
              <span className="pill" title="Dernier journal reçu">
                {app.integration.logs ? `Journaux ${timeAgo(app.lastLogAt)}` : "Journaux non branchés"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

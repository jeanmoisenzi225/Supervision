import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { api, type AppOverview } from "../lib/api";
import { usePolling } from "../lib/usePolling";
import { APP_VERSION } from "../version";

/** Menu général de NJMDev : un module par carte (NJM Supervision ouvert, NJM Website à venir). */
export function Home({ onLogout }: { onLogout: () => void }) {
  const { data } = usePolling(() => api<{ apps: AppOverview[] }>("/overview"), 30_000);
  const apps = data?.apps ?? [];
  const watched = apps.filter((a) => a.status !== "not_deployed" && a.status !== "paused");
  const down = watched.filter((a) => a.status === "down" || a.status === "degraded");
  const alerts = apps.reduce((n, a) => n + a.openAlerts, 0);
  const summary = !data ? "Chargement…" : down.length ? `${down.length} appli(s) en difficulté · ${alerts} alerte(s)` : `Tout fonctionne · ${watched.length} appli(s) · ${alerts} alerte(s)`;

  return (
    <div className="shell home">
      <header className="home-head">
        <Brand size={34} />
        <button className="link" onClick={onLogout}>
          Déconnexion
        </button>
      </header>
      <main className="content">
        <p className="muted home-intro">Le poste de pilotage de NJMDev. Choisissez un module.</p>
        <div className="modules">
          <Link to="/supervision" className="card module-card">
            <span className="module-icon">
              <svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true">
                <polyline points="8,36 22,36 28,20 36,46 42,30 56,30" fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="module-body">
              <strong>NJM Supervision</strong>
              <span className="small muted">Disponibilité, alertes, journaux, ressources, clients, backlog et administration de toutes les applis.</span>
              <span className={`small module-status ${down.length ? "bad" : data ? "ok" : ""}`}>{summary}</span>
            </span>
          </Link>
          <div className="card module-card disabled" aria-disabled="true">
            <span className="module-icon">
              <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
              </svg>
            </span>
            <span className="module-body">
              <strong>NJM Website</strong>
              <span className="small muted">Sites internet des clients.</span>
              <span className="pill">Bientôt</span>
            </span>
          </div>
        </div>
      </main>
      <footer className="footer">NJMDev v{APP_VERSION}</footer>
    </div>
  );
}

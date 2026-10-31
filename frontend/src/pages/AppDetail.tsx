import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertsList } from "../components/AlertsList";
import { DiagnosticPanel } from "../components/DiagnosticPanel";
import { PauseControls } from "../components/PauseControls";
import { LogsView } from "../components/LogsView";
import { StatusBadge } from "../components/StatusBadge";
import { api, type AppOverview } from "../lib/api";
import { dateTime, pauseLabel, timeAgo } from "../lib/format";
import { usePolling } from "../lib/usePolling";
import { AdminPanel } from "./AdminPanel";

type Tab = "dispo" | "journaux" | "alertes" | "admin";

interface ChecksData {
  hourly: { checkId: string; hour: string; total: number; ok: number; avgLatencyMs: number }[];
  recent: { id: string; checkId: string; at: string; ok: boolean; statusCode: number | null; latencyMs: number | null; error: string | null }[];
}

export function AppDetail() {
  const { key = "" } = useParams();
  const [tab, setTab] = useState<Tab>("dispo");
  const [checking, setChecking] = useState(false);
  const { data: app, error, setData, refresh } = usePolling(() => api<AppOverview>(`/apps/${key}`), 15_000, [key]);
  const checks = usePolling(() => api<ChecksData>(`/apps/${key}/checks?hours=24`), 60_000, [key]);

  async function checkNow() {
    setChecking(true);
    try {
      setData(await api<AppOverview>(`/apps/${key}/check-now`, { method: "POST" }));
      await checks.refresh();
    } finally {
      setChecking(false);
    }
  }

  if (error && !app) return <p className="error">{error}</p>;
  if (!app) return <p className="muted">Chargement…</p>;

  return (
    <>
      <Link to="/" className="back">
        ← Tableau de bord
      </Link>
      <div className="page-head">
        <div>
          <h1>{app.name}</h1>
          <p className="muted">{app.description}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>
      {app.pause && (
        <p className="small paused-note">
          Supervision coupée {pauseLabel(app.pause.until)}
          {app.pause.reason ? ` · ${app.pause.reason}` : ""} : ni vérifications, ni alertes, ni notifications. Les journaux continuent d'arriver.
        </p>
      )}
      <DiagnosticPanel app={app} onDone={() => void refresh()} />

      <div className="tabs">
        <button className={tab === "dispo" ? "active" : ""} onClick={() => setTab("dispo")}>
          Disponibilité
        </button>
        <button className={tab === "journaux" ? "active" : ""} onClick={() => setTab("journaux")}>
          Journaux
        </button>
        <button className={tab === "alertes" ? "active" : ""} onClick={() => setTab("alertes")}>
          Alertes {app.openAlerts ? `(${app.openAlerts})` : ""}
        </button>
        <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
          Administration
        </button>
      </div>

      {tab === "dispo" && (
        <>
          {app.checks.length === 0 ? (
            <div className="card">
              <p>Aucune adresse surveillée pour cette appli.</p>
              <p className="muted small">
                À renseigner dans la variable <code>{app.key.toUpperCase().replace(/-/g, "_")}_URLS</code> du service de supervision dès que l'appli est en ligne.
              </p>
            </div>
          ) : (
            <>
              <div className="row">
                <span className="muted small grow">
                  Vérification toutes les {app.intervalSec >= 60 ? `${Math.round(app.intervalSec / 60)} min` : `${app.intervalSec} s`}
                  {app.sleepsWhenIdle ? " · service gratuit mis en veille : la première réponse peut prendre une minute" : ""}
                </span>
                <button onClick={checkNow} disabled={checking}>
                  {checking ? "Vérification…" : "Vérifier maintenant"}
                </button>
              </div>
              {app.checks.map((c) => {
                const hours = checks.data?.hourly.filter((h) => h.checkId === c.id) ?? [];
                return (
                  <div key={c.id} className="card">
                    <div className="row">
                      <span className={`dot ${c.last ? (c.last.ok ? "ok" : "ko") : ""}`} />
                      <strong className="grow">{c.label}</strong>
                      <span className="small">{c.uptime24h != null ? `${c.uptime24h} % sur 24 h` : ""}</span>
                    </div>
                    <a className="muted small url" href={c.url} target="_blank" rel="noreferrer">
                      {c.url}
                    </a>
                    <div className="bars" title="Disponibilité heure par heure (24 h)">
                      {hours.map((h) => (
                        <span
                          key={h.hour}
                          className={`bar ${h.ok === h.total ? "ok" : h.ok === 0 ? "ko" : "mid"}`}
                          title={`${new Date(h.hour).getHours()} h : ${h.ok}/${h.total} réussies, ${h.avgLatencyMs} ms en moyenne`}
                        />
                      ))}
                    </div>
                    <p className="small">
                      Dernière vérification {timeAgo(c.last?.at)}
                      {c.last?.latencyMs != null ? ` · ${c.last.latencyMs} ms` : ""}
                      {c.last?.statusCode ? ` · HTTP ${c.last.statusCode}` : ""}
                    </p>
                    {c.last?.error && <p className="error small">{c.last.error}</p>}
                  </div>
                );
              })}
              <h3>Dernières vérifications</h3>
              <table className="table">
                <tbody>
                  {checks.data?.recent.map((r) => (
                    <tr key={r.id}>
                      <td>{dateTime(r.at)}</td>
                      <td>{app.checks.find((c) => c.id === r.checkId)?.label ?? r.checkId}</td>
                      <td>
                        <span className={`dot ${r.ok ? "ok" : "ko"}`} />
                      </td>
                      <td>{r.latencyMs != null ? `${r.latencyMs} ms` : ""}</td>
                      <td className="small">{r.error ?? (r.statusCode ? `HTTP ${r.statusCode}` : "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {tab === "journaux" &&
        (app.integration.logs ? (
          <LogsView app={app.key} />
        ) : (
          <div className="card">
            <p>Les journaux de cette appli ne sont pas encore branchés.</p>
            <p className="muted small">
              Il faut définir <code>{app.key.toUpperCase().replace(/-/g, "_")}_INGEST_TOKEN</code> sur la supervision et ajouter le petit module d'envoi dans l'appli
              (voir <code>docs/integration.md</code>).
            </p>
          </div>
        ))}

      {tab === "alertes" && <AlertsList app={app.key} />}

      {tab === "admin" && (
        <>
          <section className="card">
            <h3>Supervision de cette appli</h3>
            <p className="muted small">Pendant une maintenance : plus de vérifications, d'alertes ni de notifications. Les journaux continuent d'arriver.</p>
            <PauseControls apps={[app]} compact onChange={() => void refresh()} />
          </section>
          <AdminPanel app={app} />
        </>
      )}
    </>
  );
}

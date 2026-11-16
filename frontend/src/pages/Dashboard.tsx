import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppMark, Constellation } from "../components/Constellation";
import { StatusBadge } from "../components/StatusBadge";
import { api, type AppOverview, type ReplayData } from "../lib/api";
import { pauseLabel, timeAgo } from "../lib/format";
import { usePolling } from "../lib/usePolling";

/** Plus bas niveau de disponibilité et temps de réponse le plus haut des vérifications d'une appli. */
const stats = (a: AppOverview) => {
  const up = a.checks.map((c) => c.uptime24h).filter((x): x is number => x !== null);
  const ms = a.checks.map((c) => c.last?.latencyMs).filter((x): x is number => typeof x === "number");
  return { up: up.length ? Math.min(...up) : null, ms: ms.length ? Math.max(...ms) : null };
};

/** Tableau de bord (v0.39.0) : liste ou constellation, et grille de disponibilité des dernières 24 h. */
export function Dashboard() {
  const nav = useNavigate();
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const { data, error, updatedAt } = usePolling(() => api<{ apps: AppOverview[] }>("/overview"), 15_000);
  const { data: grid } = usePolling(() => api<ReplayData>("/replay?hours=24&step=15"), 120_000);
  const apps = data?.apps ?? [];
  const watched = apps.filter((a) => a.status !== "not_deployed" && a.status !== "paused");
  const paused = apps.filter((a) => a.status === "paused");
  const down = watched.filter((a) => a.status === "down" || a.status === "degraded");
  const alerts = apps.reduce((n, a) => n + a.openAlerts, 0);
  const sel = apps.find((a) => a.key === selected) ?? null;

  return (
    <>
      <div className="eyebrow">Supervision</div>
      <h1 className="page-title">{!data ? "Chargement…" : down.length ? `${down.length} application(s) en difficulté.` : "Tout fonctionne."}</h1>
      <p className="muted home-sub">
        {watched.length} appli(s) surveillée(s) · {alerts} alerte(s) active(s)
        {paused.length ? ` · supervision coupée : ${paused.map((a) => a.name).join(", ")}` : ""}
        {updatedAt ? ` · mis à jour ${timeAgo(updatedAt.toISOString())}` : ""}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="dash-kpis">
        <div className="kpi"><small>Applications</small><b>{apps.length}</b></div>
        <div className="kpi"><small>En ligne</small><b className="ok-t">{watched.length - down.length}</b></div>
        <div className="kpi"><small>Dégradées</small><b className={down.length ? "warn-t" : ""}>{down.length}</b></div>
        <div className="kpi"><small>Alertes ouvertes</small><b className={alerts ? "warn-t" : ""}>{alerts}</b></div>
      </div>
      <div className="seg" role="tablist">
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Liste</button>
        <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>Constellation</button>
      </div>

      {view === "list" ? (
        <div className="card dash-table">
          <table className="tb">
            <thead>
              <tr>
                <th></th>
                <th>Application</th>
                <th>État</th>
                <th className="num">Dispo 24 h</th>
                <th className="num">Réponse</th>
                <th>Alertes</th>
                <th>Journaux</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const s = stats(a);
                return (
                  <tr key={a.key} className="trow" onClick={() => nav(`/supervision/applis/${a.key}`)}>
                    <td className="mk"><AppMark appKey={a.key} size={30} /></td>
                    <td>
                      <strong>{a.name}</strong>
                      <div className="muted small">{a.pause ? `Supervision coupée ${pauseLabel(a.pause.until)}` : a.description}</div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="num">{s.up !== null ? `${String(s.up).replace(".", ",")} %` : "—"}</td>
                    <td className="num">{s.ms !== null ? `${s.ms} ms` : "—"}</td>
                    <td>{a.openAlerts ? <span className="pill pill-bad">{a.openAlerts} alerte(s)</span> : <span className="muted">—</span>}</td>
                    <td className="muted small">{a.integration.logs ? timeAgo(a.lastLogAt) : "non branchés"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dash-map">
          <div className="card">{apps.length > 0 && <Constellation apps={apps} selected={selected} focus={focus} onSelect={(k) => setSelected(selected === k ? null : k)} onFocus={setFocus} />}</div>
          <div className="card">
            {sel ? (
              <>
                <div className="home-sel-head">
                  <AppMark appKey={sel.key} size={44} />
                  <div>
                    <strong>{sel.name}</strong>
                    <div className="muted small">{sel.description}</div>
                  </div>
                  <StatusBadge status={sel.status} />
                </div>
                <p className="small">
                  {stats(sel).ms !== null ? `Réponse ${stats(sel).ms} ms · ` : ""}
                  {stats(sel).up !== null ? `Dispo 24 h ${String(stats(sel).up).replace(".", ",")} %` : "Pas encore de mesure"}
                </p>
                <Link to={`/supervision/applis/${sel.key}`} className="small">Ouvrir la fiche →</Link>
              </>
            ) : (
              <span className="muted small">Touchez une application sur la constellation.</span>
            )}
          </div>
        </div>
      )}

      {grid && (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Disponibilité · 24 dernières heures</h3>
          {grid.apps.map((g) => {
            const a = apps.find((x) => x.key === g.key);
            return (
              <div key={g.key} className="dash-heat">
                <span className="dash-heat-name"><AppMark appKey={g.key} size={16} />{a?.name ?? g.key}</span>
                <div className="dash-heat-cells" style={{ gridTemplateColumns: `repeat(${grid.n}, 1fr)` }}>
                  {g.cells.map((c, i) => (
                    <i key={i} className={c.s ?? "none"} title={`${new Date(grid.from + i * grid.stepMin * 60_000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${c.s === "ok" ? "nominal" : c.s === "w" ? "dégradé" : c.s === "b" ? "arrêt" : "pas de relevé"}`} />
                  ))}
                </div>
              </div>
            );
          })}
          <p className="muted small">Une case = {grid.stepMin} minutes.</p>
        </section>
      )}
    </>
  );
}

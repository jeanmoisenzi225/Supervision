import { useState } from "react";
import { LineChart } from "../components/LineChart";
import { api, type AppOverview } from "../lib/api";
import { formatBytes } from "../lib/units";
import { usePolling } from "../lib/usePolling";

interface Sample {
  at: number;
  ok: boolean;
  rssMb: number | null;
  heapMb: number | null;
  externalMb: number | null;
  loopLagMaxMs: number | null;
  imports: number | null;
  jobs: number | null;
  uptimeSec: number | null;
  error: string | null;
}
interface LiveData {
  supported: boolean;
  minutes: number;
  samples: Sample[];
  restarts: { at: number; lastRssMb: number | null; kind: "memory" | "other" }[];
  last: Sample | null;
  current: { at: number; report: { imports?: { running: number; usedMb?: number; budgetMb?: number }; runningImports?: { id: string; sinceSec: number; sizeMb: number | null }[] } } | null;
}

const WINDOWS = [
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1 h" },
  { minutes: 360, label: "6 h" },
  { minutes: 1440, label: "24 h" },
];

const mb = (v: number) => `${Math.round(v)} Mo`;
const duration = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)} j ${Math.floor((s % 86400) / 3600)} h` : s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min ${s % 60} s`);

/** Onglet « En direct » : mémoire réelle du service relevée toutes les 15 secondes, redémarrages repérés à la seconde près. */
export function LivePanel({ app }: { app: AppOverview }) {
  const [minutes, setMinutes] = useState(60);
  const { data, error, updatedAt } = usePolling(() => api<LiveData>(`/apps/${app.key}/runtime?minutes=${minutes}`), 5_000, [app.key, minutes]);

  if (error) return <p className="muted">Mesure en direct indisponible : {error}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  if (!data.supported) {
    return (
      <section className="card">
        <h3>En direct</h3>
        <p className="muted">
          Cette appli ne fournit pas encore son état en direct (rapport signé <code>runtime</code>). Les relevés commencent dès que l'appli est à jour ; sans réponse, la Supervision réessaie toutes les heures.
        </p>
      </section>
    );
  }

  const ok = data.samples.filter((s) => s.ok && s.rssMb !== null);
  const rss: [number, number][] = ok.map((s) => [s.at, s.rssMb! * 1024 * 1024]);
  const lag: [number, number][] = ok.map((s) => [s.at, s.loopLagMaxMs ?? 0]);
  const last = data.last;
  const age = last ? Math.round((Date.now() - last.at) / 1000) : null;
  const stale = age !== null && age > 60;
  const peak = ok.length ? Math.max(...ok.map((s) => s.rssMb!)) : null;

  return (
    <section className="card">
      <h3>
        En direct <span className={`pill ${stale || !last?.ok ? "pill-warn" : "pill-ok"}`}>{stale ? "sans relevé récent" : last?.ok ? "relevé il y a " + age + " s" : "service injoignable"}</span>
      </h3>
      <div className="tabs" style={{ marginBottom: 8 }}>
        {WINDOWS.map((w) => (
          <button key={w.minutes} className={minutes === w.minutes ? "active" : ""} onClick={() => setMinutes(w.minutes)}>
            {w.label}
          </button>
        ))}
      </div>
      <div className="metrics">
        <div className="card metric">
          <span className="muted small">Mémoire réelle</span>
          <span className="metric-value">{last?.rssMb != null ? mb(last.rssMb) : "—"}</span>
          <span className="muted small">{peak !== null ? `pic ${mb(peak)} sur la période · limite 512 Mo` : ""}</span>
        </div>
        <div className="card metric">
          <span className="muted small">En marche depuis</span>
          <span className="metric-value">{last?.uptimeSec != null ? duration(last.uptimeSec) : "—"}</span>
          <span className="muted small">{data.restarts.length ? `${data.restarts.length} redémarrage(s) sur la période` : "aucun redémarrage"}</span>
        </div>
        <div className="card metric">
          <span className="muted small">Retard de la boucle</span>
          <span className="metric-value">{last?.loopLagMaxMs != null ? `${Math.round(last.loopLagMaxMs)} ms` : "—"}</span>
          <span className="muted small">pic depuis le relevé précédent</span>
        </div>
        <div className="card metric">
          <span className="muted small">Imports / tâches d'IA</span>
          <span className="metric-value">{last?.imports ?? "—"} / {last?.jobs ?? "—"}</span>
          <span className="muted small">en cours</span>
        </div>
      </div>
      {data.current?.report.runningImports && (
        <div>
          <h4 style={{ margin: "12px 0 6px" }}>
            Imports en cours ({data.current.report.runningImports.length}
            {data.current.report.imports?.budgetMb ? ` · budget mémoire ${data.current.report.imports.usedMb ?? 0} / ${data.current.report.imports.budgetMb} Mo` : ""})
          </h4>
          {data.current.report.runningImports.length === 0 ? (
            <p className="muted small">Aucun import en cours.</p>
          ) : (
            <table className="table">
              <tbody>
                {data.current.report.runningImports.map((i) => (
                  <tr key={i.id}>
                    <td className="small">n° {i.id}</td>
                    <td>{i.sizeMb !== null ? `${i.sizeMb.toLocaleString("fr-FR")} Mo` : "taille inconnue"}</td>
                    <td className="small muted">depuis {i.sinceSec >= 60 ? `${Math.floor(i.sinceSec / 60)} min ${i.sinceSec % 60} s` : `${i.sinceSec} s`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <LineChart title="Mémoire réelle du service" points={rss} format={formatBytes} rangeHours={minutes / 60} limit={{ value: 512 * 1024 * 1024, label: "limite 512 Mo" }} threshold={{ value: 512 * 1024 * 1024 * 0.8, label: "alerte 80 %" }} marks={data.restarts.map((r) => ({ at: r.at, kind: r.kind }))} />
      {data.restarts.length > 0 && (
        <ul className="small">
          {data.restarts.map((r) => (
            <li key={r.at}>
              ▲ {new Date(r.at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })} : redémarrage
              {r.lastRssMb !== null ? ` (dernière mémoire vue : ${r.lastRssMb} Mo${r.kind === "memory" ? " : probable saturation" : ""})` : ""}
            </li>
          ))}
        </ul>
      )}
      <LineChart title="Retard de la boucle d'événements (pic)" points={lag} format={(v) => `${Math.round(v)} ms`} rangeHours={minutes / 60} marks={data.restarts.map((r) => ({ at: r.at, kind: r.kind }))} />
      <p className="muted small">Relevé toutes les 15 secondes, page actualisée toutes les 5 secondes{updatedAt ? ` (dernière : ${updatedAt.toLocaleTimeString("fr-FR")})` : ""}. Conservé 7 jours.</p>
    </section>
  );
}

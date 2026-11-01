import { useState } from "react";
import { api, type AppOverview } from "../lib/api";
import { cronLabel } from "../lib/cronLabel";
import { dateTime, timeAgo } from "../lib/format";
import { usePolling } from "../lib/usePolling";

interface Job {
  key: string;
  label: string;
  cron: string;
  graceMinutes: number;
  state: "ok" | "late" | "failed" | "waiting";
  expectedAt: string | null;
  nextAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
  runs: { at: string; status: string; message: string | null; durationMs: number | null }[];
}

const STATE: Record<Job["state"], { label: string; cls: string; icon: string }> = {
  ok: { label: "À l'heure", cls: "ok", icon: "✓" },
  late: { label: "Non exécutée", cls: "ko", icon: "🔴" },
  failed: { label: "En échec", cls: "warn", icon: "⚠️" },
  waiting: { label: "En attente", cls: "info", icon: "…" },
};

const duration = (ms: number | null) => (ms === null ? "" : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

/** Onglet Tâches : tâches planifiées de l'appli (rappels, récap, purges…). */
export function JobsPanel({ app }: { app: AppOverview }) {
  const { data, error } = usePolling(() => api<Job[]>(`/apps/${app.key}/jobs`), 60_000, [app.key]);
  const [open, setOpen] = useState<string | null>(null);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  if (data.length === 0) {
    return (
      <div className="card">
        <p>Aucune tâche planifiée signalée par cette appli.</p>
        <p className="muted small">
          Une tâche apparaît ici dès sa première exécution, une fois enveloppée avec <code>supervision.job(…)</code> dans l'appli (voir <code>docs/integration.md</code>).
        </p>
      </div>
    );
  }

  const late = data.filter((j) => j.state === "late").length;
  const failed = data.filter((j) => j.state === "failed").length;

  return (
    <div className="stack">
      <p className="small">
        {late ? `🔴 ${late} tâche(s) non exécutée(s). ` : ""}
        {failed ? `⚠️ ${failed} tâche(s) en échec. ` : ""}
        {!late && !failed ? "✓ Toutes les tâches sont à l'heure. " : ""}
        <span className="muted">Horaires en UTC (= heure d'Abidjan).</span>
      </p>
      {data.map((j) => {
        const st = STATE[j.state];
        return (
          <section key={j.key} className={`card job job-${st.cls}`}>
            <div className="row wrap">
              <span className={`dot ${st.cls}`} />
              <strong className="grow">{j.label}</strong>
              <span className="pill">
                {st.icon} {st.label}
              </span>
            </div>
            <p className="small muted">
              {cronLabel(j.cron)} · marge {j.graceMinutes} min{j.nextAt ? ` · prochaine : ${dateTime(j.nextAt)}` : ""}
            </p>
            <p className="small">
              {j.lastRunAt ? (
                <>
                  Dernière exécution {timeAgo(j.lastRunAt)} ({dateTime(j.lastRunAt)}){j.lastStatus === "error" ? " — échec" : ""}
                  {j.lastMessage ? ` · ${j.lastMessage}` : ""}
                </>
              ) : (
                "Jamais exécutée."
              )}
            </p>
            {j.state === "late" && j.expectedAt && <p className="small error">Prévue le {dateTime(j.expectedAt)}, aucune exécution reçue depuis.</p>}
            {j.runs.length > 0 && (
              <button className="link small" onClick={() => setOpen(open === j.key ? null : j.key)}>
                {open === j.key ? "Masquer l'historique" : `Historique (${j.runs.length})`}
              </button>
            )}
            {open === j.key && (
              <table className="table">
                <tbody>
                  {j.runs.map((r) => (
                    <tr key={r.at}>
                      <td>
                        <span className={`dot ${r.status === "ok" ? "ok" : "ko"}`} />
                      </td>
                      <td>{dateTime(r.at)}</td>
                      <td className="num">{duration(r.durationMs)}</td>
                      <td className="small">{r.message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}

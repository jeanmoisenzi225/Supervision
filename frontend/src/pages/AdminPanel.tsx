import { useState } from "react";
import { api, type AppOverview } from "../lib/api";
import { dateTime } from "../lib/format";
import { usePolling } from "../lib/usePolling";

interface ActionParam {
  name: string;
  label: string;
  type?: "text" | "number" | "boolean";
  required?: boolean;
}

interface AppAction {
  id: string;
  label: string;
  description?: string;
  danger?: boolean;
  params?: ActionParam[];
}

interface RenderService {
  id: string;
  name?: string;
  type?: string;
  suspended?: boolean;
  url?: string | null;
  dashboardUrl?: string | null;
  error?: string;
  deploys?: { id: string; status: string; createdAt: string; commit: string | null }[];
}

interface ActionsData {
  render: { configured: boolean; services: RenderService[]; error?: string | null };
  app: { configured: boolean; actions: AppAction[]; error?: string };
  metrics: { label: string; value: string | number; hint?: string }[];
  history: { id: string; at: string; by: string; action: string; ok: boolean; message: string | null }[];
}

const SERVICE_TYPE: Record<string, string> = {
  web_service: "Service web",
  static_site: "Site statique",
  background_worker: "Tâche de fond",
  cron_job: "Tâche planifiée",
  private_service: "Service privé",
};

const DEPLOY_STATUS: Record<string, string> = {
  live: "En ligne",
  build_in_progress: "Construction…",
  update_in_progress: "Mise à jour…",
  build_failed: "Échec de construction",
  update_failed: "Échec de mise à jour",
  canceled: "Annulé",
  deactivated: "Remplacé",
  created: "En file",
};

export function AdminPanel({ app }: { app: AppOverview }) {
  const { data, error, refresh } = usePolling(() => api<ActionsData>(`/apps/${app.key}/actions`), 30_000, [app.key]);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [forms, setForms] = useState<Record<string, Record<string, string | boolean>>>({});

  async function run(id: string, label: string, path: string, body: unknown, danger: boolean) {
    if (!window.confirm(`${danger ? "⚠️ Action sensible. " : ""}Confirmer : ${label} sur ${app.name} ?`)) return;
    setBusy(id);
    setFeedback(null);
    try {
      const res = await api<{ message?: string }>(path, { method: "POST", body });
      setFeedback({ ok: true, text: res.message ?? "Action effectuée" });
    } catch (err) {
      setFeedback({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  if (error && !data) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Chargement…</p>;

  return (
    <div className="stack">
      {feedback && <p className={feedback.ok ? "success" : "error"}>{feedback.text}</p>}

      {data.metrics.length > 0 && (
        <div className="metrics">
          {data.metrics.map((m) => (
            <div key={m.label} className="card metric" title={m.hint}>
              <span className="metric-value">{m.value}</span>
              <span className="muted small">{m.label}</span>
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <h3>Hébergement (Render)</h3>
        {!data.render.configured && (
          <p className="muted small">
            Non branché : ajouter la clé API Render (<code>RENDER_API_KEY</code>) sur le service supervision. Les services de l'appli sont ensuite reconnus automatiquement.
          </p>
        )}
        {data.render.error && <p className="error small">{data.render.error}</p>}
        {data.render.configured && !data.render.error && data.render.services.length === 0 && (
          <p className="muted small">Aucun service Render reconnu pour cette appli (ni par son nom, ni par son adresse).</p>
        )}
        {data.render.services.map((s) => (
          <div key={s.id} className="service">
            {s.error ? (
              <p className="error small">
                {s.id} : {s.error}
              </p>
            ) : (
              <>
                <div className="row">
                  <strong className="grow">{s.name}</strong>
                  <span className="pill">{SERVICE_TYPE[s.type ?? ""] ?? s.type}</span>
                  {s.suspended && <span className="pill pill-bad">Suspendu</span>}
                </div>
                {s.deploys?.[0] && (
                  <p className="small">
                    Dernier déploiement : {DEPLOY_STATUS[s.deploys[0].status] ?? s.deploys[0].status} · {dateTime(s.deploys[0].createdAt)}
                    {s.deploys[0].commit ? ` · « ${s.deploys[0].commit} »` : ""}
                  </p>
                )}
                <div className="row wrap">
                  {s.type !== "static_site" && (
                    <button disabled={busy !== null} onClick={() => run(`${s.id}:restart`, `redémarrer ${s.name}`, `/apps/${app.key}/render/${s.id}/restart`, {}, true)}>
                      Redémarrer
                    </button>
                  )}
                  <button disabled={busy !== null} onClick={() => run(`${s.id}:deploy`, `redéployer la dernière version de ${s.name}`, `/apps/${app.key}/render/${s.id}/deploy`, {}, true)}>
                    Redéployer
                  </button>
                  {s.dashboardUrl && (
                    <a className="button" href={s.dashboardUrl} target="_blank" rel="noreferrer">
                      Ouvrir dans Render
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Actions de l'appli</h3>
        {!data.app.configured && (
          <p className="muted small">
            Non branché : l'appli doit exposer les routes <code>/supervision/…</code> et la supervision connaître <code>{app.key.toUpperCase().replace(/-/g, "_")}_ADMIN_URL</code> et{" "}
            <code>{app.key.toUpperCase().replace(/-/g, "_")}_ADMIN_TOKEN</code> (voir <code>docs/integration.md</code>).
          </p>
        )}
        {data.app.error && <p className="error small">{data.app.error}</p>}
        {data.app.actions.map((a) => (
          <div key={a.id} className="action">
            <div className="row">
              <strong className="grow">{a.label}</strong>
              {a.danger && <span className="pill pill-bad">Sensible</span>}
            </div>
            {a.description && <p className="muted small">{a.description}</p>}
            {a.params?.map((p) => (
              <label key={p.name} className={p.type === "boolean" ? "toggle" : ""}>
                {p.type === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(forms[a.id]?.[p.name])}
                    onChange={(e) => setForms({ ...forms, [a.id]: { ...forms[a.id], [p.name]: e.target.checked } })}
                  />
                ) : null}
                {p.label}
                {p.type !== "boolean" && (
                  <input
                    type={p.type === "number" ? "number" : "text"}
                    value={String(forms[a.id]?.[p.name] ?? "")}
                    onChange={(e) => setForms({ ...forms, [a.id]: { ...forms[a.id], [p.name]: e.target.value } })}
                  />
                )}
              </label>
            ))}
            <button
              disabled={busy !== null || Boolean(a.params?.some((p) => p.required && !forms[a.id]?.[p.name]))}
              onClick={() => run(a.id, a.label, `/apps/${app.key}/actions/${a.id}`, { params: forms[a.id] ?? {} }, Boolean(a.danger))}
            >
              {busy === a.id ? "En cours…" : "Lancer"}
            </button>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Historique des actions</h3>
        {data.history.length === 0 && <p className="muted small">Aucune action lancée depuis la supervision.</p>}
        <ul className="list compact">
          {data.history.map((h) => (
            <li key={h.id} className="small">
              <span className={`dot ${h.ok ? "ok" : "ko"}`} /> {dateTime(h.at)} · {h.action} · {h.message} <span className="muted">({h.by})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

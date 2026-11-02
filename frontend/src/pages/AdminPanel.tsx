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
  app: { configured: boolean; actions: AppAction[]; error?: string; notReady?: boolean };
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

export function AdminPanel({ app, onChange }: { app: AppOverview; onChange?: () => void }) {
  const { data, error, refresh } = usePolling(() => api<ActionsData>(`/apps/${app.key}/actions`), 30_000, [app.key]);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string; display?: string } | null>(null);
  const [forms, setForms] = useState<Record<string, Record<string, string | boolean>>>({});
  const [cutting, setCutting] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [cutReason, setCutReason] = useState("");

  async function serviceCommand(op: "suspend-all" | "resume-all") {
    if (op === "resume-all" && !window.confirm(`Remettre ${app.name} en service ?`)) return;
    setBusy(op);
    setFeedback(null);
    try {
      const res = await api<{ message?: string }>(`/apps/${app.key}/render/${op}`, {
        method: "POST",
        body: op === "suspend-all" ? { confirm: confirmName, reason: cutReason.trim() || null } : {},
      });
      setFeedback({ ok: true, text: res.message ?? "Fait" });
      setCutting(false);
      setConfirmName("");
      setCutReason("");
    } catch (err) {
      setFeedback({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
      await refresh();
      onChange?.();
    }
  }

  async function run(id: string, label: string, path: string, body: unknown, danger: boolean) {
    if (!window.confirm(`${danger ? "⚠️ Action sensible. " : ""}Confirmer : ${label} sur ${app.name} ?`)) return;
    setBusy(id);
    setFeedback(null);
    try {
      const res = await api<{ message?: string; data?: { display?: string } | null }>(path, { method: "POST", body });
      // `display` : information à montrer une seule fois (ex. code temporaire), jamais tracée dans l'historique.
      setFeedback({ ok: true, text: res.message ?? "Action effectuée", display: res.data?.display });
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
      {feedback && (
        <div className={`card ${feedback.ok ? "" : "diag diag-ko"}`}>
          <p className={feedback.ok ? "success" : "error"}>{feedback.text}</p>
          {feedback.display && (
            <p className="display-once">
              <strong>{feedback.display}</strong>
              <br />
              <span className="muted small">Affiché une seule fois : note-le maintenant, il n'est enregistré nulle part.</span>
            </p>
          )}
        </div>
      )}

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

      {data.render.configured && data.render.services.some((s) => !s.error) && (
        <section className={`card ${data.render.services.some((s) => s.suspended) ? "diag diag-ko" : ""}`}>
          <h3>Coupure du service</h3>
          {data.render.services.some((s) => s.suspended) ? (
            <>
              <p className="small">
                <strong>Service coupé :</strong> {data.render.services.filter((s) => s.suspended).map((s) => s.name).join(", ")} hors ligne. La supervision de l'appli est coupée en attendant.
              </p>
              <button className="primary" disabled={busy !== null} onClick={() => serviceCommand("resume-all")}>
                {busy === "resume-all" ? "Remise en service…" : "Remettre en service"}
              </button>
            </>
          ) : !cutting ? (
            <>
              <p className="muted small">Met toute l'appli hors ligne sur Render (tous ses services), jusqu'à sa remise en service. La supervision de l'appli est coupée en même temps.</p>
              <button className="danger" onClick={() => setCutting(true)} disabled={busy !== null}>
                Couper le service
              </button>
            </>
          ) : (
            <div className="stack-small">
              <p className="small">
                ⚠️ <strong>{app.name}</strong> sera inaccessible pour tous ses utilisateurs : {data.render.services.map((s) => s.name).join(", ")}.
              </p>
              <label>
                Pour confirmer, tape : {app.name}
                <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
              </label>
              <label>
                Motif (facultatif)
                <input value={cutReason} maxLength={200} onChange={(e) => setCutReason(e.target.value)} />
              </label>
              <div className="row wrap">
                <button
                  className="danger"
                  disabled={busy !== null || confirmName.trim().toLowerCase() !== app.name.toLowerCase()}
                  onClick={() => serviceCommand("suspend-all")}
                >
                  {busy === "suspend-all" ? "Coupure…" : "Couper maintenant"}
                </button>
                <button onClick={() => setCutting(false)} disabled={busy !== null}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h3>Actions de l'appli</h3>
        {!data.app.configured && (
          <p className="muted small">
            Non branché : le jeton d'envoi des journaux de cette appli (<code>{app.key.toUpperCase().replace(/-/g, "_")}_INGEST_TOKEN</code>) n'est pas défini sur la supervision.
          </p>
        )}
        {data.app.error && <p className="error small">{data.app.error}</p>}
        {data.app.notReady && <p className="muted small">Pas encore branchées : la version de l'appli qui expose ses actions n'est pas encore en ligne.</p>}
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

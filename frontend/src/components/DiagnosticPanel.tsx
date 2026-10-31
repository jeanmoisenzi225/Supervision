import { useState } from "react";
import { api, type AppOverview } from "../lib/api";

type DiagStatus = "ok" | "warn" | "ko" | "info";

interface Diagnostic {
  at: string;
  durationMs: number;
  overall: DiagStatus;
  items: { id: string; label: string; status: DiagStatus; detail: string }[];
}

const OVERALL: Record<DiagStatus, string> = {
  ok: "Tout est en ordre",
  warn: "Points à surveiller",
  ko: "Problème détecté",
  info: "Rien à signaler",
};

/** Diagnostic complet d'une appli, avec « Tout relancer » si besoin. */
export function DiagnosticPanel({ app, onDone }: { app: AppOverview; onDone: () => void }) {
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [busy, setBusy] = useState<"diag" | "restart" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy("diag");
    setMessage(null);
    try {
      setDiag(await api<Diagnostic>(`/apps/${app.key}/diagnostic`, { method: "POST" }));
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function restartAll() {
    if (!window.confirm(`⚠️ Redémarrer tous les services web de ${app.name} ? Ils seront indisponibles quelques instants.`)) return;
    setBusy("restart");
    setMessage(null);
    try {
      const res = await api<{ message: string }>(`/apps/${app.key}/render/restart-all`, { method: "POST" });
      setMessage({ ok: true, text: `${res.message}. Relance le diagnostic dans 2 à 3 minutes pour vérifier.` });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`card diag ${diag ? `diag-${diag.overall}` : ""}`}>
      <div className="row wrap">
        <h3 className="grow">Diagnostic complet</h3>
        <button className="primary" onClick={run} disabled={busy !== null}>
          {busy === "diag" ? "Vérification en cours…" : diag ? "Relancer le diagnostic" : "Lancer le diagnostic"}
        </button>
      </div>
      {!diag && busy !== "diag" && (
        <p className="muted small">
          Vérifie tout d'un coup : adresses et temps de réponse, disponibilité sur 24 h, services Render et dernier déploiement, erreurs et alertes, réception des journaux.
          {app.sleepsWhenIdle ? " Service en veille : compter jusqu'à une minute." : ""}
        </p>
      )}
      {diag && (
        <>
          <p>
            <strong>{OVERALL[diag.overall]}</strong>{" "}
            <span className="muted small">
              · {new Date(diag.at).toLocaleTimeString("fr-FR")} · {(diag.durationMs / 1000).toFixed(1)} s
            </span>
          </p>
          <ul className="diag-items">
            {diag.items.map((i) => (
              <li key={i.id}>
                <span className={`dot ${i.status === "ko" ? "ko" : i.status}`} />
                <div>
                  <strong className="small">{i.label}</strong>
                  <div className="small muted">{i.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          {app.integration.render && (
            <div className="row wrap">
              <button onClick={restartAll} disabled={busy !== null}>
                {busy === "restart" ? "Relance en cours…" : "Tout relancer"}
              </button>
              <span className="muted small">Redémarre tous les services web de l'appli sur Render.</span>
            </div>
          )}
        </>
      )}
      {message && <p className={`small ${message.ok ? "success" : "error"}`}>{message.text}</p>}
    </section>
  );
}

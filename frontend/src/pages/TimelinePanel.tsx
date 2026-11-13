import { useState } from "react";
import { localizeTimes } from "../lib/format";
import { api, type AppOverview } from "../lib/api";
import { usePolling } from "../lib/usePolling";

interface Item {
  at: number;
  kind: string;
  level: "critical" | "warning" | "ok" | "info";
  title: string;
  detail?: string;
}
interface TimelineData {
  hours: number;
  availability: number | null;
  checks: number;
  items: Item[];
}

const WINDOWS = [
  { hours: 6, label: "6 h" },
  { hours: 24, label: "24 h" },
  { hours: 168, label: "7 jours" },
  { hours: 720, label: "30 jours" },
];

const ICON: Record<Item["level"], string> = { critical: "🔴", warning: "🟠", ok: "🟢", info: "⚪" };
const KIND: Record<string, string> = {
  alert: "Alerte",
  "render-failed": "Arrêt Render",
  "render-recovered": "Reprise",
  deploy: "Déploiement",
  "deploy-failed": "Déploiement",
  restart: "Redémarrage",
  "render-other": "Render",
};

const day = (t: number) => new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
const hour = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Onglet « Chronologie » : alertes, arrêts et déploiements Render et redémarrages sur une seule frise. */
export function TimelinePanel({ app }: { app: AppOverview }) {
  const [hours, setHours] = useState(24);
  const [only, setOnly] = useState<"all" | "problems">("all");
  const { data, error } = usePolling(() => api<TimelineData>(`/apps/${app.key}/timeline?hours=${hours}`), 30_000, [app.key, hours]);

  if (error) return <p className="muted">Chronologie indisponible : {error}</p>;
  if (!data) return <p className="muted">Chargement…</p>;

  const items = data.items.filter((i) => only === "all" || i.level === "critical" || i.level === "warning");
  const critical = data.items.filter((i) => i.level === "critical").length;
  const groups: { label: string; items: Item[] }[] = [];
  for (const i of items) {
    const label = day(i.at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(i);
    else groups.push({ label, items: [i] });
  }

  return (
    <section className="card">
      <h3>Chronologie des incidents</h3>
      <div className="tabs" style={{ marginBottom: 8 }}>
        {WINDOWS.map((w) => (
          <button key={w.hours} className={hours === w.hours ? "active" : ""} onClick={() => setHours(w.hours)}>
            {w.label}
          </button>
        ))}
        <button className={only === "problems" ? "active" : ""} onClick={() => setOnly(only === "all" ? "problems" : "all")}>
          {only === "problems" ? "Problèmes seulement" : "Tout afficher"}
        </button>
      </div>
      <div className="metrics">
        <div className="card metric">
          <span className="muted small">Disponibilité</span>
          <span className="metric-value">{data.availability !== null ? `${data.availability.toLocaleString("fr-FR")} %` : "—"}</span>
          <span className="muted small">{data.checks} vérifications</span>
        </div>
        <div className="card metric">
          <span className="muted small">Incidents graves</span>
          <span className="metric-value">{critical}</span>
          <span className="muted small">sur la période</span>
        </div>
        <div className="card metric">
          <span className="muted small">Événements</span>
          <span className="metric-value">{data.items.length}</span>
          <span className="muted small">alertes, arrêts, déploiements</span>
        </div>
      </div>
      {groups.length === 0 && <p className="muted">Rien à signaler sur cette période.</p>}
      {groups.map((g) => (
        <div key={g.label}>
          <h4 style={{ textTransform: "capitalize", margin: "16px 0 6px" }}>{g.label}</h4>
          <table className="table">
            <tbody>
              {g.items.map((i, n) => (
                <tr key={`${i.at}-${n}`}>
                  <td className="nowrap small">{hour(i.at)}</td>
                  <td>{ICON[i.level]}</td>
                  <td>
                    <strong>{i.title}</strong>
                    {i.detail && <div className="small muted">{localizeTimes(i.detail)}</div>}
                  </td>
                  <td className="small muted">{KIND[i.kind] ?? i.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="muted small">Sources : alertes de la Supervision, événements Render (arrêts, déploiements), redémarrages détectés en direct. Render publie ses événements 15 à 30 minutes après les faits.</p>
    </section>
  );
}

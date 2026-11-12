import { api } from "../lib/api";
import { usePolling } from "../lib/usePolling";

interface Line {
  kind: "service" | "database" | "disk";
  name: string;
  plan: string;
  usd: number | null;
  note?: string;
}
interface BillingApp {
  key: string;
  name: string;
  render: { lines: Line[]; usd: number; unknown: number };
  claude: { workspaces: { workspace: string; usd: number }[]; usd: number };
  totalUsd: number;
}
interface Billing {
  pricesAsOf: string;
  pricesSource: string;
  renderConfigured: boolean;
  claude: { configured: boolean; error?: string; monthToDateUsd: number };
  apps: BillingApp[];
  totals: { renderUsd: number; claudeUsd: number; totalUsd: number; unknown: number };
}

const usd = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const KIND: Record<Line["kind"], string> = { service: "Service", database: "Base de données", disk: "Stockage" };

/** Page « Coûts » : coût mensuel estimé de chaque appli (hébergement Render, offres actuelles) et dépenses Claude du mois. */
export function CostsPage() {
  const { data, error } = usePolling(() => api<Billing>("/hosting-costs"), 10 * 60_000);

  return (
    <>
      <h1>Coûts</h1>
      <p className="muted small">
        Coût d'hébergement et d'IA par appli : l'<strong>hébergement Render</strong> est une estimation mensuelle calculée d'après les offres actuelles de chaque service et base (tarifs publics de Render
        relevés le {data ? new Date(data.pricesAsOf).toLocaleDateString("fr-FR") : "…"}) ; les <strong>dépenses Claude</strong> sont réelles, pour le mois en cours. Render ne
        fournit pas sa facturation à la Supervision : la facture exacte se lit dans Render › Billing (bande passante, minutes de construction et forfait de l'espace de travail ne sont
        pas comptés ici).
      </p>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Chargement…</p>}
      {data && !data.renderConfigured && <p className="error small">Clé API Render non configurée (RENDER_API_KEY) : l'hébergement ne peut pas être estimé.</p>}
      {data && (
        <div className="stack">
          <div className="metrics">
            <div className="card metric">
              <span className="muted small">Total estimé</span>
              <span className="metric-value">{usd(data.totals.totalUsd)}</span>
              <span className="muted small">Render par mois + Claude du mois en cours</span>
            </div>
            <div className="card metric">
              <span className="muted small">Hébergement Render</span>
              <span className="metric-value">{usd(data.totals.renderUsd)}</span>
              <span className="muted small">par mois, estimation</span>
            </div>
            <div className="card metric">
              <span className="muted small">Claude</span>
              <span className="metric-value">{data.claude.configured ? usd(data.totals.claudeUsd) : "—"}</span>
              <span className="muted small">{data.claude.configured ? "ce mois-ci, réel" : "clé Admin Anthropic non configurée"}</span>
            </div>
          </div>
          {data.claude.error && <p className="error small">{data.claude.error}</p>}
          {data.totals.unknown > 0 && (
            <p className="small">⚠️ {data.totals.unknown} ligne(s) d'une offre Render inconnue de la table des tarifs : non comptée(s). À ajouter dans <code>hosting/prices.ts</code>.</p>
          )}
          {data.apps.map((app) => (
            <section key={app.key} className="card">
              <h3>
                {app.name} <span className="muted">· {usd(app.totalUsd)}</span>
              </h3>
              <div className="table-scroll">
                <table className="table">
                  <tbody>
                    {app.render.lines.map((l, i) => (
                      <tr key={`${l.name}-${i}`}>
                        <td>
                          {l.name}
                          <div className="small muted">
                            {KIND[l.kind]} · {l.plan}
                            {l.note ? ` · ${l.note}` : ""}
                          </div>
                        </td>
                        <td className="num nowrap">{l.usd === null ? "offre inconnue" : usd(l.usd)}</td>
                      </tr>
                    ))}
                    {app.claude.workspaces.map((w) => (
                      <tr key={w.workspace}>
                        <td>
                          Claude · {w.workspace}
                          <div className="small muted">dépenses du mois en cours</div>
                        </td>
                        <td className="num nowrap">{usd(w.usd)}</td>
                      </tr>
                    ))}
                    {app.render.lines.length === 0 && app.claude.workspaces.length === 0 && (
                      <tr>
                        <td className="muted">Aucun service ni espace Claude reconnu pour cette appli.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {app.render.lines.length > 0 && (
                <p className="small muted">
                  Hébergement estimé : {usd(app.render.usd)} par mois{app.claude.usd ? ` · Claude : ${usd(app.claude.usd)} ce mois-ci` : ""}.
                </p>
              )}
            </section>
          ))}
          <p className="small muted">
            Un espace de travail Claude est rattaché à une appli quand son nom la contient (par exemple « Procedia ») ; un autre nom se règle avec la variable{" "}
            <code>&lt;APPLI&gt;_CLAUDE_WORKSPACE</code> du service supervision. Les espaces non reconnus apparaissent dans « Non rattaché à une appli ».
          </p>
        </div>
      )}
    </>
  );
}

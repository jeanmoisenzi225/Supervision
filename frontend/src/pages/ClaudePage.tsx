import { LineChart } from "../components/LineChart";
import { api } from "../lib/api";
import { usePolling } from "../lib/usePolling";

interface Costs {
  configured: boolean;
  budgetUsd: number | null;
  monthToDateUsd: number;
  todayUsd: number;
  yesterdayUsd: number;
  daily: [number, number][];
  byModel: { model: string; usd: number }[];
  byWorkspace: { workspace: string; usd: number }[];
  /** Espaces de travail cumulés par appli (v0.25.0). */
  byApp?: { key: string; name: string; usd: number; workspaces: { workspace: string; usd: number }[] }[];
  error?: string;
}

const usd = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

/** Page « Claude » : dépenses de l'organisation Anthropic (rapport de coûts de l'API Admin). */
export function ClaudePage() {
  const { data, error } = usePolling(() => api<Costs>("/claude/costs"), 10 * 60_000);
  const budgetPct = data?.budgetUsd ? Math.round((data.monthToDateUsd / data.budgetUsd) * 1000) / 10 : null;
  const level = budgetPct === null ? "unknown" : budgetPct >= 100 ? "critical" : budgetPct >= 80 ? "warning" : "good";
  const monthTotal = data?.byModel.reduce((s, m) => s + m.usd, 0) ?? 0;

  return (
    <>
      <h1>Claude</h1>
      <p className="muted small">
        Dépenses de ton organisation Anthropic (toutes applis confondues). Le crédit épuisé et la clé refusée sont détectés dans les journaux de chaque appli et remontent
        dans les Alertes.
      </p>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Chargement…</p>}
      {data && !data.configured && (
        <section className="card">
          <h3>Clé Admin Anthropic à ajouter</h3>
          <p className="small">
            Les dépenses viennent du rapport de coûts d'Anthropic, qui demande une clé « Admin » (elle commence par <code>sk-ant-admin</code>), différente des clés utilisées
            par les applis.
          </p>
          <ol className="small">
            <li>console.anthropic.com › Settings › Admin keys › Create admin key.</li>
            <li>
              Render › service supervision › Environment : variable <code>ANTHROPIC_ADMIN_KEY</code>, avec la clé en valeur.
            </li>
            <li>
              Facultatif : <code>CLAUDE_MONTHLY_BUDGET_USD</code> (ex. 50) pour être alerté à 80 % et 100 % du budget du mois.
            </li>
          </ol>
        </section>
      )}
      {data?.configured && data.error && <p className="error">{data.error}</p>}
      {data?.configured && !data.error && (
        <div className="stack">
          <div className="metrics">
            <div className="card metric">
              <span className="muted small">Ce mois-ci</span>
              <span className="metric-value">{usd(data.monthToDateUsd)}</span>
              {budgetPct !== null ? (
                <>
                  <div className="gauge-track" aria-hidden="true">
                    <div className={`gauge-fill gauge-${level}`} style={{ width: `${Math.min(100, budgetPct)}%` }} />
                  </div>
                  <span className="muted small">
                    {level === "warning" ? "⚠️ " : level === "critical" ? "🔴 " : ""}
                    {budgetPct} % du budget ({usd(data.budgetUsd!)})
                  </span>
                </>
              ) : (
                <span className="muted small">pas de budget fixé</span>
              )}
            </div>
            <div className="card metric">
              <span className="muted small">Hier</span>
              <span className="metric-value">{usd(data.yesterdayUsd)}</span>
            </div>
            <div className="card metric">
              <span className="muted small">Aujourd'hui</span>
              <span className="metric-value">{usd(data.todayUsd)}</span>
              <span className="muted small">mis à jour avec ~5 min de retard</span>
            </div>
          </div>
          <section className="card">
            <LineChart title="Dépenses par jour (30 jours)" points={data.daily} format={usd} rangeHours={720} />
          </section>
          <section className="card">
            <h3>Ce mois-ci, par modèle</h3>
            <table className="table">
              <tbody>
                {data.byModel.map((m) => (
                  <tr key={m.model}>
                    <td>{m.model}</td>
                    <td className="num">{usd(m.usd)}</td>
                    <td className="num muted">{monthTotal ? `${Math.round((m.usd / monthTotal) * 100)} %` : ""}</td>
                  </tr>
                ))}
                {data.byModel.length === 0 && (
                  <tr>
                    <td className="muted">Aucune dépense ce mois-ci.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          {data.byApp && data.byApp.some((a) => a.key !== "other") && (
            <section className="card">
              <h3>Ce mois-ci, par appli</h3>
              <table className="table">
                <tbody>
                  {data.byApp.map((a) => (
                    <tr key={a.key}>
                      <td>
                        <strong>{a.name}</strong>
                        {a.workspaces.length > 1 && (
                          <div className="small muted">{a.workspaces.map((w) => `${w.workspace} ${usd(w.usd)}`).join(" + ")}</div>
                        )}
                      </td>
                      <td className="num">
                        <strong>{usd(a.usd)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted">Les espaces de travail d'une même appli sont cumulés (réglage <code>&lt;APPLI&gt;_CLAUDE_WORKSPACE</code> sur le service supervision).</p>
            </section>
          )}
          {data.byWorkspace.length > 1 && (
            <section className="card">
              <h3>Ce mois-ci, par espace de travail</h3>
              <table className="table">
                <tbody>
                  {data.byWorkspace.map((w) => (
                    <tr key={w.workspace}>
                      <td>{w.workspace}</td>
                      <td className="num">{usd(w.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <p className="muted small">
            Pour savoir quelle appli dépense quoi, donne-leur chacune un espace de travail Anthropic (Console › Workspaces) et une clé créée dans cet espace.
          </p>
        </div>
      )}
    </>
  );
}

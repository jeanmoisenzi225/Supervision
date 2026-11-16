import { useState } from "react";
import { LineChart } from "../components/LineChart";
import { api, type AppOverview } from "../lib/api";
import { dateTime } from "../lib/format";
import { usePolling } from "../lib/usePolling";

type Section = "documents" | "cibles" | "incoherences";

interface Base {
  configured: boolean;
  notReady?: boolean;
  error?: string;
}
interface DocumentsData extends Base {
  generatedAt?: string;
  days?: number;
  kept?: { count: number; totalMb: number; oldestAt: string | null; expiringSoon: number; toWatch: number };
  deleted?: { total: number; inPeriod: number; manualInPeriod: number; autoInPeriod: number; byDay: { day: string; manual: number; auto: number }[]; recent: { at: string; kind: "manual" | "auto"; fileName: string; by: string; detail: string }[] };
  byClient?: { clientId: string | null; client: string; kept: number; keptMb: number }[];
}
interface CiblesData extends Base {
  totals?: { current: number; currentValidated: number; targets: number; targetsValidated: number };
  rows?: { client: string; missionId: string; category: string; current: number; currentValidated: number; targets: number; targetsValidated: number }[];
  byAuthor?: { author: string; targetsCreated: number; targetsValidated: number }[];
  authors?: { author: string; client: string; missionId: string; category: string; targetsCreated: number; targetsValidated: number }[];
}
interface IncoherencesData extends Base {
  deferred?: boolean;
  reason?: string;
  stale?: boolean;
  generatedAt?: string;
  processes?: number;
  total?: number;
  types?: { type: string; label: string; severity: "high" | "medium" | "low"; count: number }[];
  byCategory?: { client: string; missionId: string; category: string; counts: Record<string, number> }[];
  items?: { type: string; severity: "high" | "medium" | "low"; client: string; category: string; processName?: string; fileName?: string; detail: string }[];
  truncated?: boolean;
}

const SEVERITY = { high: "Élevée", medium: "Moyenne", low: "Faible" } as const;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
const num = (n: number) => n.toLocaleString("fr-FR");

/** Onglet « Qualité » de Procedia (v0.37.0) : documents supprimés, cibles par personne, incohérences. */
export function QualityPanel({ app }: { app: AppOverview }) {
  const [section, setSection] = useState<Section>("documents");
  return (
    <section className="card">
      <h3>Qualité</h3>
      <div className="tabs" style={{ marginBottom: 8 }}>
        {(
          [
            ["documents", "Documents"],
            ["cibles", "Procédures cibles"],
            ["incoherences", "Incohérences"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>
            {label}
          </button>
        ))}
      </div>
      {section === "documents" && <Documents app={app} />}
      {section === "cibles" && <Cibles app={app} />}
      {section === "incoherences" && <Incoherences app={app} />}
    </section>
  );
}

function Status({ data, error }: { data: Base | null; error: string | null }) {
  if (error) return <p className="muted">Indisponible : {error}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  if (!data.configured) return <p className="muted">Cette appli n'est pas reliée à la Supervision (jeton manquant).</p>;
  if (data.notReady) return <p className="muted">Procedia n'expose pas encore ce rapport (version 0.63.0 ou plus requise) : il apparaîtra dès sa mise en ligne.</p>;
  if (data.error) return <p className="muted">Rapport indisponible : {data.error}</p>;
  return null;
}

function Documents({ app }: { app: AppOverview }) {
  const [days, setDays] = useState(30);
  const { data, error } = usePolling(() => api<DocumentsData>(`/apps/${app.key}/qualite/documents?days=${days}`), 60_000, [app.key, days]);
  const status = <Status data={data} error={error} />;
  if (!data || !data.deleted || !data.kept) return status;
  let cumulative = 0;
  const points: [number, number][] = data.deleted.byDay.map((d) => {
    cumulative += d.manual + d.auto;
    return [new Date(`${d.day}T23:59:00Z`).getTime(), cumulative];
  });
  return (
    <div>
      <div className="tabs" style={{ marginBottom: 8 }}>
        {[7, 30, 90].map((d) => (
          <button key={d} className={days === d ? "active" : ""} onClick={() => setDays(d)}>
            {d} jours
          </button>
        ))}
      </div>
      <div className="metrics">
        <div className="card metric">
          <span className="muted small">Supprimés sur {days} jours</span>
          <span className="metric-value">{num(data.deleted.inPeriod)}</span>
          <span className="muted small">
            {num(data.deleted.manualInPeriod)} à la validation · {num(data.deleted.autoInPeriod)} automatiques · {num(data.deleted.total)} au total
          </span>
        </div>
        <div className="card metric">
          <span className="muted small">Documents conservés</span>
          <span className="metric-value">{num(data.kept.count)}</span>
          <span className="muted small">{data.kept.totalMb.toLocaleString("fr-FR")} Mo{data.kept.oldestAt ? ` · plus ancien du ${new Date(data.kept.oldestAt).toLocaleDateString("fr-FR")}` : ""}</span>
        </div>
        <div className="card metric">
          <span className="muted small">À échéance</span>
          <span className="metric-value">{num(data.kept.expiringSoon)}</span>
          <span className="muted small">à supprimer sous 3 jours ouvrés · {num(data.kept.toWatch)} en alerte</span>
        </div>
      </div>
      <LineChart title={`Documents supprimés (cumul sur ${days} jours)`} points={points} format={(v) => num(Math.round(v))} rangeHours={days * 24} />
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Jour</th>
              <th className="num">À la validation</th>
              <th className="num">Automatiques</th>
            </tr>
          </thead>
          <tbody>
            {[...data.deleted.byDay]
              .reverse()
              .filter((d) => d.manual + d.auto > 0)
              .slice(0, 14)
              .map((d) => (
                <tr key={d.day}>
                  <td className="small">{new Date(`${d.day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                  <td className="num">{d.manual}</td>
                  <td className="num">{d.auto}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <h4 style={{ margin: "12px 0 6px" }}>Conservés par client</h4>
      <table className="table">
        <tbody>
          {(data.byClient ?? []).map((c) => (
            <tr key={c.client}>
              <td>{c.client}</td>
              <td className="num">{num(c.kept)} document(s)</td>
              <td className="num">{c.keptMb.toLocaleString("fr-FR")} Mo</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 style={{ margin: "12px 0 6px" }}>Dernières suppressions</h4>
      {data.deleted.recent.length === 0 ? (
        <p className="muted small">Aucune suppression sur la période.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <tbody>
              {data.deleted.recent.slice(0, 20).map((r, i) => (
                <tr key={`${r.at}-${i}`}>
                  <td className="small">{dateTime(r.at)}</td>
                  <td className="small">{r.kind === "auto" ? "Automatique" : "Validation"}</td>
                  <td className="small">{r.fileName}</td>
                  <td className="small muted">{r.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cibles({ app }: { app: AppOverview }) {
  const { data, error } = usePolling(() => api<CiblesData>(`/apps/${app.key}/qualite/cibles`), 60_000, [app.key]);
  const status = <Status data={data} error={error} />;
  if (!data || !data.totals) return status;
  const t = data.totals;
  return (
    <div>
      <div className="metrics">
        <div className="card metric">
          <span className="muted small">Actuelles validées</span>
          <span className="metric-value">{num(t.currentValidated)}</span>
          <span className="muted small">sur {num(t.current)} procédures actuelles</span>
        </div>
        <div className="card metric">
          <span className="muted small">Cibles créées</span>
          <span className="metric-value">{num(t.targets)}</span>
          <span className="muted small">{pct(t.targets, t.currentValidated)} des actuelles validées</span>
        </div>
        <div className="card metric">
          <span className="muted small">Cibles validées</span>
          <span className="metric-value">{num(t.targetsValidated)}</span>
          <span className="muted small">{pct(t.targetsValidated, t.targets)} des cibles</span>
        </div>
      </div>
      <h4 style={{ margin: "12px 0 6px" }}>Par personne</h4>
      <table className="table">
        <thead>
          <tr>
            <th>Personne</th>
            <th className="num">Cibles créées</th>
            <th className="num">Validées</th>
          </tr>
        </thead>
        <tbody>
          {(data.byAuthor ?? []).length === 0 && (
            <tr>
              <td colSpan={3} className="muted small">
                Aucune procédure cible créée pour l'instant.
              </td>
            </tr>
          )}
          {(data.byAuthor ?? []).map((a) => (
            <tr key={a.author}>
              <td>{a.author}</td>
              <td className="num">{a.targetsCreated}</td>
              <td className="num">{a.targetsValidated}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 style={{ margin: "12px 0 6px" }}>Par client et par catégorie</h4>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Client · catégorie</th>
              <th className="num">Actuelles</th>
              <th className="num">Validées</th>
              <th className="num">Cibles</th>
              <th className="num">Cibles validées</th>
              <th className="num">Avancement</th>
            </tr>
          </thead>
          <tbody>
            {(data.rows ?? []).map((r) => (
              <tr key={r.missionId}>
                <td className="small">
                  {r.client} · {r.category}
                </td>
                <td className="num">{r.current}</td>
                <td className="num">{r.currentValidated}</td>
                <td className="num">{r.targets}</td>
                <td className="num">{r.targetsValidated}</td>
                <td className="num">{pct(r.targets, r.currentValidated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(data.authors ?? []).length > 0 && (
        <>
          <h4 style={{ margin: "12px 0 6px" }}>Personne × client × catégorie</h4>
          <div className="table-scroll">
            <table className="table">
              <tbody>
                {(data.authors ?? []).map((a) => (
                  <tr key={`${a.author}-${a.missionId}`}>
                    <td className="small">{a.author}</td>
                    <td className="small">
                      {a.client} · {a.category}
                    </td>
                    <td className="num">{a.targetsCreated} créée(s)</td>
                    <td className="num">{a.targetsValidated} validée(s)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Incoherences({ app }: { app: AppOverview }) {
  const [severity, setSeverity] = useState<"" | "high" | "medium">("");
  const [type, setType] = useState("");
  const { data, error, refresh } = usePolling(() => api<IncoherencesData>(`/apps/${app.key}/qualite/incoherences`), 5 * 60_000, [app.key]);
  const [busy, setBusy] = useState(false);
  const status = <Status data={data} error={error} />;
  if (!data) return status;
  if (data.deferred) return <p className="muted">{data.reason ?? "Calcul reporté (import en cours)."} Réessayez dans quelques minutes.</p>;
  if (!data.types || !data.items) return status;
  const items = data.items.filter((i) => (!severity || i.severity === severity) && (!type || i.type === type));
  const total = data.total ?? 0;
  async function recompute() {
    setBusy(true);
    try {
      await api(`/apps/${app.key}/qualite/incoherences?refresh=1`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="small muted">
        {data.processes !== undefined ? `${num(data.processes)} procédures contrôlées` : ""}
        {data.generatedAt ? ` · calculé le ${dateTime(data.generatedAt)}` : ""}
        {data.stale ? " (résultat conservé : import en cours)" : ""} ·{" "}
        <button className="link" onClick={() => void recompute()} disabled={busy}>
          {busy ? "Calcul…" : "Recalculer"}
        </button>
      </p>
      <p>
        <strong>{num(total)}</strong> incohérence(s) relevée(s).
      </p>
      <ul className="quality-types">
        {data.types.map((t) => (
          <li key={t.type} className={t.count === 0 ? "zero" : ""} onClick={() => t.count && setType(type === t.type ? "" : t.type)} style={{ cursor: t.count ? "pointer" : "default", outline: type === t.type ? "1px solid var(--accent)" : undefined }}>
            <span>
              <span className={`sev-${t.severity}`}>●</span> {t.label}
            </span>
            <strong>{num(t.count)}</strong>
          </li>
        ))}
      </ul>
      <div className="tabs" style={{ marginBottom: 8 }}>
        {(
          [
            ["", "Toutes"],
            ["high", "Gravité élevée"],
            ["medium", "Moyenne"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={severity === key ? "active" : ""} onClick={() => setSeverity(key)}>
            {label}
          </button>
        ))}
        {type && (
          <button onClick={() => setType("")}>Retirer le filtre ✕</button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="muted small">Rien à signaler pour ce filtre.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Client · catégorie</th>
                <th>Procédure ou fichier</th>
                <th>Constat</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 200).map((i, k) => (
                <tr key={k}>
                  <td className="small">
                    <span className={`sev-${i.severity}`} title={SEVERITY[i.severity]}>
                      ●
                    </span>{" "}
                    {i.client} · {i.category}
                  </td>
                  <td className="small">{i.processName ?? i.fileName ?? "—"}</td>
                  <td className="small">{data.types!.find((t) => t.type === i.type)?.label}{i.detail ? ` : ${i.detail}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.truncated && <p className="muted small">Liste limitée aux 100 premiers cas de chaque type ; les compteurs ci-dessus sont complets.</p>}
    </div>
  );
}

import { useState } from "react";
import { LineChart } from "../components/LineChart";
import { api, type AppOverview } from "../lib/api";
import { formatBytes, formatCount, formatCpu, formatMs, pct } from "../lib/units";
import { usePolling } from "../lib/usePolling";

type Points = [number, number][];
type Range = "24h" | "7d" | "30d";

interface Resources {
  configured: boolean;
  services: {
    id: string;
    name: string;
    memory: Points;
    memoryLimit: number | null;
    cpu: Points;
    cpuLimit: number | null;
    requests: Points;
    errors5xx: Points;
    latencyP95: Points;
    disk: Points;
    diskCapacity: number | null;
    errors: string[];
  }[];
  databases: {
    id: string;
    name: string;
    plan: string;
    diskSizeGB: number | null;
    expiresAt: string | null;
    daysLeft: number | null;
    disk: Points;
    diskFromSamples: boolean;
    tables: { name: string; bytes: number }[];
    connections: Points;
    errors: string[];
  }[];
  checks: { id: string; label: string; points: Points }[];
}

const RANGES: { key: Range; label: string; hours: number }[] = [
  { key: "24h", label: "24 h", hours: 24 },
  { key: "7d", label: "7 jours", hours: 168 },
  { key: "30d", label: "30 jours", hours: 720 },
];

const lastOf = (p: Points) => (p.length ? p[p.length - 1][1] : null);
const maxOf = (p: Points) => (p.length ? Math.max(...p.map((x) => x[1])) : null);
const sumOf = (p: Points) => p.reduce((s, x) => s + x[1], 0);

function Gauge({ label, value, alertAt, detail }: { label: string; value: number | null; alertAt: number; detail: string }) {
  const level = value === null ? "unknown" : value >= 95 ? "critical" : value >= alertAt ? "warning" : "good";
  return (
    <div className="card metric gauge">
      <span className="muted small">{label}</span>
      <span className="metric-value">{value === null ? "—" : `${value} %`}</span>
      <div className="gauge-track" aria-hidden="true">
        <div className={`gauge-fill gauge-${level}`} style={{ width: `${Math.min(100, value ?? 0)}%` }} />
      </div>
      <span className="muted small">
        {level === "warning" && "⚠️ "}
        {level === "critical" && "🔴 "}
        {detail}
      </span>
    </div>
  );
}

/** Onglet Ressources : mémoire, processeur, trafic, bases de données (mesures Render). */
export function ResourcesPanel({ app }: { app: AppOverview }) {
  const [range, setRange] = useState<Range>("24h");
  const hours = RANGES.find((r) => r.key === range)!.hours;
  const { data, error } = usePolling(() => api<Resources>(`/apps/${app.key}/resources?range=${range}`), 120_000, [app.key, range]);

  return (
    <div className="stack">
      <div className="tabs small-tabs" role="group" aria-label="Période">
        {RANGES.map((r) => (
          <button key={r.key} className={range === r.key ? "active" : ""} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Chargement des mesures…</p>}
      {data && !data.configured && <p className="muted small">Clé API Render non configurée : les mesures viennent de Render.</p>}
      {data?.configured && data.services.length === 0 && data.databases.length === 0 && (
        <p className="muted small">Aucun service web ni base reconnus sur Render pour cette appli (un site statique n'a ni mémoire ni processeur à suivre).</p>
      )}

      {data && data.checks.some((c) => c.points.length > 0) && (
        <section className="card">
          <h3>Temps de réponse mesuré par la Supervision</h3>
          <p className="muted small">Mesuré à chaque vérification de disponibilité, depuis l'extérieur, comme un visiteur.</p>
          {data.checks
            .filter((c) => c.points.length > 0)
            .map((c) => (
              <LineChart key={c.id} title={c.label} points={c.points} format={formatMs} rangeHours={hours} />
            ))}
        </section>
      )}

      {data?.services.map((s) => {
        const memNow = pct(lastOf(s.memory), s.memoryLimit);
        const memPeak = pct(maxOf(s.memory), s.memoryLimit);
        const total = sumOf(s.requests);
        const e5 = sumOf(s.errors5xx);
        return (
          <section key={s.id} className="card">
            <h3>{s.name}</h3>
            <div className="metrics">
              <Gauge label="Mémoire" value={memNow} alertAt={85} detail={memPeak !== null ? `pic ${memPeak} %` : "limite inconnue"} />
              <div className="card metric">
                <span className="muted small">Requêtes</span>
                <span className="metric-value">{formatCount(total)}</span>
                <span className="muted small">sur la période</span>
              </div>
              <div className="card metric">
                <span className="muted small">Erreurs serveur (5xx)</span>
                <span className="metric-value">{formatCount(e5)}</span>
                <span className="muted small">{total ? `${((e5 / total) * 100).toFixed(2)} % des requêtes` : "—"}</span>
              </div>
              {s.latencyP95.length > 0 && (
                <div className="card metric">
                  <span className="muted small">Temps de réponse (95 %)</span>
                  <span className="metric-value">{formatMs(lastOf(s.latencyP95)!)}</span>
                  <span className="muted small">dernière mesure</span>
                </div>
              )}
            </div>
            <LineChart
              title="Mémoire utilisée"
              points={s.memory}
              format={formatBytes}
              rangeHours={hours}
              limit={s.memoryLimit ? { value: s.memoryLimit, label: `limite ${formatBytes(s.memoryLimit)}` } : null}
              threshold={s.memoryLimit ? { value: s.memoryLimit * 0.85, label: "alerte 85 %" } : null}
            />
            {s.diskCapacity && s.disk.length > 0 && (
              <>
                <div className="metrics">
                  <Gauge
                    label="Disque persistant"
                    value={pct(lastOf(s.disk), s.diskCapacity)}
                    alertAt={80}
                    detail={`${formatBytes(lastOf(s.disk) ?? 0)} sur ${formatBytes(s.diskCapacity)}`}
                  />
                </div>
                <LineChart
                  title="Disque persistant utilisé"
                  points={s.disk}
                  format={formatBytes}
                  rangeHours={hours}
                  limit={{ value: s.diskCapacity, label: `taille ${formatBytes(s.diskCapacity)}` }}
                  threshold={{ value: s.diskCapacity * 0.8, label: "alerte 80 %" }}
                />
              </>
            )}
            <LineChart title="Processeur" points={s.cpu} format={formatCpu} rangeHours={hours} limit={s.cpuLimit ? { value: s.cpuLimit, label: `limite ${formatCpu(s.cpuLimit)}` } : null} />
            {s.requests.length > 0 && <LineChart title="Requêtes par intervalle" points={s.requests} format={formatCount} rangeHours={hours} />}
            {s.latencyP95.length > 0 && <LineChart title="Temps de réponse (95 % des requêtes)" points={s.latencyP95} format={formatMs} rangeHours={hours} />}
            {s.errors.length > 0 && <p className="muted small">Non disponible : {s.errors.join(" ; ")}.</p>}
          </section>
        );
      })}

      {data?.databases.map((db) => {
        const size = db.diskSizeGB ? db.diskSizeGB * 1024 ** 3 : null;
        const used = lastOf(db.disk);
        return (
          <section key={db.id} className="card">
            <h3>Base {db.name}</h3>
            <p className="muted small">Offre : {planLabel(db.plan)} (le disque se règle à part, dans Render).</p>
            <div className="metrics">
              {size ? (
                <Gauge label="Disque" value={pct(used, size)} alertAt={80} detail={used !== null ? `${formatBytes(used)} sur ${db.diskSizeGB} Go` : `taille du disque : ${db.diskSizeGB} Go`} />
              ) : (
                <div className="card metric">
                  <span className="muted small">Taille de la base</span>
                  <span className="metric-value">{used !== null ? formatBytes(used) : "—"}</span>
                  <span className="muted small">{planLabel(db.plan)}</span>
                </div>
              )}
              {db.connections.length > 0 && (
                <div className="card metric">
                  <span className="muted small">Connexions actives</span>
                  <span className="metric-value">{lastOf(db.connections)}</span>
                  <span className="muted small">pic {maxOf(db.connections)}</span>
                </div>
              )}
              {db.daysLeft !== null && (
                <div className={`card metric ${db.daysLeft <= 7 ? "metric-alert" : ""}`}>
                  <span className="muted small">Base gratuite</span>
                  <span className="metric-value">{db.daysLeft <= 0 ? "Expirée" : `${db.daysLeft} j`}</span>
                  <span className="muted small">
                    {db.daysLeft <= 7 ? "⚠️ " : ""}expire le {new Date(db.expiresAt!).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              )}
            </div>
            {db.disk.length > 1 && (
            <LineChart
              title={db.diskFromSamples ? "Taille de la base (relevée par la Supervision)" : "Espace disque utilisé"}
              points={db.disk}
              format={formatBytes}
              rangeHours={hours}
              limit={size ? { value: size, label: `taille ${db.diskSizeGB} Go` } : null}
              threshold={size ? { value: size * 0.8, label: "alerte 80 %" } : null}
            />
            )}
            {db.diskFromSamples && db.disk.length <= 1 && (
              <p className="muted small">L'historique de la taille se construit : la Supervision la relève toutes les heures, la courbe apparaîtra au fil des jours.</p>
            )}
            {db.connections.length > 0 && (
              <LineChart title="Connexions actives" points={db.connections} format={(v) => `${Math.round(v)}`} rangeHours={hours} />
            )}
            {db.tables.length > 0 && (
              <>
                <h4 className="small">Plus grosses tables</h4>
                <table className="table">
                  <tbody>
                    {db.tables.map((t) => (
                      <tr key={t.name}>
                        <td>{t.name}</td>
                        <td className="num">{formatBytes(t.bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {db.errors.filter((e) => !(db.diskFromSamples && e.startsWith("historique du disque"))).length > 0 && (
              <p className="muted small">Non disponible : {db.errors.filter((e) => !(db.diskFromSamples && e.startsWith("historique du disque"))).join(" ; ")}.</p>
            )}
          </section>
        );
      })}
      {data?.configured && <p className="muted small">Mesures fournies par Render, rafraîchies toutes les 2 minutes.</p>}
    </div>
  );
}

/** Offre Render d'une base, lisible : « 0.1c-256mb » → « 0,1 processeur · 256 Mo de mémoire ». */
function planLabel(plan: string): string {
  const m = /^([\d.]+)c-(\d+)(mb|gb)$/i.exec(plan);
  if (!m) return plan;
  return `${m[1].replace(".", ",")} processeur · ${m[2]} ${m[3].toLowerCase() === "gb" ? "Go" : "Mo"} de mémoire`;
}

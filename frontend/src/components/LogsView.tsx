import { useEffect, useRef, useState } from "react";
import { api, type LogEntry } from "../lib/api";
import { dateTime } from "../lib/format";

const LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;

/** « [news] planificateur… » avec la source « news » : le préfixe, déjà affiché à part, est retiré. */
export function withoutSourcePrefix(message: string, source: string | null): string {
  if (!source) return message;
  const prefix = `[${source}]`;
  return message.startsWith(prefix) ? message.slice(prefix.length).trimStart() : message;
}

export function LogsView({ app, apps }: { app?: string; apps?: { key: string; name: string }[] }) {
  const [appFilter, setAppFilter] = useState(app ?? "");
  const [minLevel, setMinLevel] = useState<string>("info");
  const [q, setQ] = useState("");
  const [live, setLive] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const newest = useRef<string | null>(null);

  const params = (extra: Record<string, string>) =>
    new URLSearchParams({
      ...(appFilter ? { app: appFilter } : {}),
      ...(minLevel ? { minLevel } : {}),
      ...(q ? { q } : {}),
      ...extra,
    }).toString();

  async function loadFirst() {
    try {
      const rows = await api<LogEntry[]>(`/logs?${params({ limit: "200" })}`);
      setEntries(rows);
      newest.current = rows[0]?.id ?? null;
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void loadFirst(), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appFilter, minLevel, q]);

  // Mode direct : récupère toutes les 5 s les journaux arrivés depuis le dernier affiché.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const rows = await api<LogEntry[]>(`/logs?${params(newest.current ? { after: newest.current, limit: "500" } : { limit: "200" })}`);
        if (rows.length) {
          newest.current = rows[0].id;
          setEntries((prev) => [...rows, ...prev].slice(0, 2000));
        }
      } catch {
        // Le prochain passage réessaiera.
      }
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, appFilter, minLevel, q]);

  async function loadMore() {
    const oldest = entries[entries.length - 1]?.id;
    if (!oldest) return;
    const rows = await api<LogEntry[]>(`/logs?${params({ before: oldest, limit: "200" })}`);
    setEntries((prev) => [...prev, ...rows]);
  }

  const appName = (key: string) => apps?.find((a) => a.key === key)?.name ?? key;

  return (
    <div>
      <div className="filters">
        {!app && (
          <select value={appFilter} onChange={(e) => setAppFilter(e.target.value)}>
            <option value="">Toutes les applis</option>
            {apps?.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <select value={minLevel} onChange={(e) => setMinLevel(e.target.value)}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l === "debug" ? "Tous les niveaux" : `${l} et plus`}
            </option>
          ))}
        </select>
        <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="toggle">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> En direct
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {entries.length === 0 && !error && <p className="muted">Aucun journal pour ces critères.</p>}
      <div className="logs">
        {entries.map((e) => (
          <div key={e.id} className={`log log-${e.level}`} onClick={() => setOpen(open === e.id ? null : e.id)}>
            <span className="log-time">{dateTime(e.at)}</span>
            <span className={`log-level lvl-${e.level}`}>{e.level}</span>
            {!app && <span className="log-app">{appName(e.appKey)}</span>}
            {e.source && <span className="log-src">{e.source}</span>}
            <span className="log-msg">{withoutSourcePrefix(e.message, e.source)}</span>
            {open === e.id && (e.context || e.requestId) && (
              <pre className="log-ctx">{JSON.stringify({ requestId: e.requestId ?? undefined, ...e.context }, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
      {entries.length >= 200 && (
        <button className="more" onClick={loadMore}>
          Charger plus ancien
        </button>
      )}
    </div>
  );
}

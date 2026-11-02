import { useState } from "react";
import { api } from "../lib/api";
import { dateTime, timeAgo } from "../lib/format";
import { usePolling } from "../lib/usePolling";

type Status = "done" | "in_progress" | "waiting" | "todo" | "dropped" | "info";

const STATUS: Record<Status, { label: string; cls: string }> = {
  in_progress: { label: "En cours", cls: "warn" },
  waiting: { label: "En attente", cls: "info" },
  todo: { label: "À faire", cls: "" },
  done: { label: "Terminé", cls: "ok" },
  dropped: { label: "Abandonné", cls: "ko" },
  info: { label: "Information", cls: "" },
};
const ORDER: Status[] = ["in_progress", "waiting", "todo", "done", "dropped", "info"];

interface SourceSummary {
  key: string;
  label: string;
  repo: string;
  path: string;
  counts: Partial<Record<Status, number>>;
  lastSync: { at: string; error: string | null; count: number } | null;
}

interface BacklogEvent {
  id: string;
  source: string;
  key: string;
  title: string;
  from: Status | null;
  to: Status;
  at: string;
}

interface Item {
  key: string;
  number: string | null;
  title: string;
  status: Status;
  versions: string[];
  grp: string | null;
  priority: string | null;
  subtasks: { text: string; done: boolean }[];
  statusChangedAt: string;
  firstSeenAt: string;
}

interface SourceBacklog {
  source: { key: string; label: string; repo: string; branch: string; path: string } | null;
  lastSync: { at: string; error: string | null; count: number } | null;
  items: Item[];
  events: BacklogEvent[];
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span className="pill status-pill">
      <span className={`dot ${STATUS[status].cls}`} /> {STATUS[status].label}
    </span>
  );
}

/** Corps Markdown simplifié : titres, listes et gras rendus lisiblement, sans HTML injecté. */
function MarkdownLite({ text }: { text: string }) {
  return (
    <div className="md-lite">
      {text.split("\n").map((line, i) => {
        const clean = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
        if (/^#{3,}\s/.test(line)) return <h4 key={i}>{clean.replace(/^#+\s*/, "")}</h4>;
        if (/^\s*[-*]\s+\[[ xX]\]/.test(line)) return null;
        if (/^\s*[-*]\s+/.test(line)) return <p key={i} className="md-li">• {clean.replace(/^\s*[-*]\s+/, "")}</p>;
        if (!clean.trim()) return <div key={i} className="md-gap" />;
        return <p key={i}>{clean}</p>;
      })}
    </div>
  );
}

function ItemDetail({ source, item, onBack }: { source: string; item: Item; onBack: () => void }) {
  const { data, error } = usePolling(() => api<Item & { body: string; events: BacklogEvent[] }>(`/backlog/${source}/${encodeURIComponent(item.key)}`), 10 * 60_000, [source, item.key]);
  const done = item.subtasks.filter((s) => s.done).length;
  return (
    <div className="stack">
      <button className="link" onClick={onBack}>
        ← Retour à la liste
      </button>
      <div>
        <p className="muted small">{[item.number ? `n° ${item.number}` : null, item.grp, item.priority].filter(Boolean).join(" · ")}</p>
        <h2>{item.title}</h2>
        <div className="row wrap">
          <StatusPill status={item.status} />
          {item.versions.map((v) => (
            <span key={v} className="pill">
              {v}
            </span>
          ))}
          <span className="muted small">statut depuis {timeAgo(item.statusChangedAt)}</span>
        </div>
      </div>
      {item.subtasks.length > 0 && (
        <section className="card">
          <h3>
            Sous-tâches ({done}/{item.subtasks.length})
          </h3>
          <div className="gauge-track" aria-hidden="true">
            <div className="gauge-fill gauge-good" style={{ width: `${(done / item.subtasks.length) * 100}%` }} />
          </div>
          <ul className="list compact">
            {item.subtasks.map((s, i) => (
              <li key={i} className="small">
                {s.done ? "☑" : "☐"} {s.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {error && <p className="error">{error}</p>}
      {data?.events && data.events.length > 0 && (
        <section className="card">
          <h3>Historique du statut</h3>
          <ul className="list compact">
            {data.events.map((e) => (
              <li key={e.id} className="small">
                {dateTime(e.at)} · {e.from ? STATUS[e.from].label : "Apparu"} → <strong>{STATUS[e.to].label}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data?.body && (
        <section className="card">
          <h3>Détail</h3>
          <MarkdownLite text={data.body} />
        </section>
      )}
    </div>
  );
}

function SourcePanel({ source, onSynced }: { source: SourceSummary; onSynced: () => void }) {
  const { data, error, refresh } = usePolling(() => api<SourceBacklog>(`/backlog/${source.key}`), 5 * 60_000, [source.key]);
  const [filter, setFilter] = useState<Status | "open" | "all">("open");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function sync() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ changes: number }>(`/backlog/${source.key}/sync`, { method: "POST" });
      setMessage({ ok: true, text: r.changes ? `${r.changes} changement(s) de statut` : "Backlog à jour, aucun changement" });
      await refresh();
      onSynced();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (open) return <ItemDetail source={source.key} item={open} onBack={() => setOpen(null)} />;
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Chargement…</p>;

  const needle = q.trim().toLowerCase();
  const items = data.items.filter(
    (i) =>
      (filter === "all" || (filter === "open" ? ["in_progress", "waiting", "todo"].includes(i.status) : i.status === filter)) &&
      (!needle || `${i.number ?? ""} ${i.title} ${i.grp ?? ""}`.toLowerCase().includes(needle))
  );
  const openCount = (["in_progress", "waiting", "todo"] as Status[]).reduce((n, s) => n + (source.counts[s] ?? 0), 0);

  return (
    <div className="stack">
      <div className="row wrap">
        <span className="muted small grow">
          {data.source?.repo} › {data.source?.path}
          {data.lastSync ? ` · lu ${timeAgo(data.lastSync.at)}` : ""}
        </span>
        <button onClick={sync} disabled={busy}>
          {busy ? "Lecture…" : "Actualiser"}
        </button>
      </div>
      {data.lastSync?.error && <p className="error small">Dernière lecture en échec : {data.lastSync.error}</p>}
      {message && <p className={`small ${message.ok ? "success" : "error"}`}>{message.text}</p>}
      <div className="tabs small-tabs">
        <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>
          À traiter ({openCount})
        </button>
        {ORDER.filter((s) => source.counts[s]).map((s) => (
          <button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>
            {STATUS[s].label} ({source.counts[s]})
          </button>
        ))}
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          Tout
        </button>
      </div>
      <input placeholder="Rechercher un chantier…" value={q} onChange={(e) => setQ(e.target.value)} />
      {items.length === 0 && <p className="muted small">Aucun chantier.</p>}
      {items.map((i) => {
        const done = i.subtasks.filter((s) => s.done).length;
        return (
          <button key={i.key} className="card tenant" onClick={() => setOpen(i)}>
            <div className="row wrap">
              <span className="muted small">{i.number ? `n° ${i.number}` : ""}</span>
              <strong className="grow">{i.title}</strong>
              <StatusPill status={i.status} />
            </div>
            <span className="muted small">
              {[i.grp, i.priority, i.versions.join(", ") || null, i.subtasks.length ? `${done}/${i.subtasks.length} sous-tâches` : null, `statut depuis ${timeAgo(i.statusChangedAt)}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
        );
      })}
      {data.events.length > 0 && (
        <section className="card">
          <h3>Derniers changements</h3>
          <ul className="list compact">
            {data.events.slice(0, 10).map((e) => (
              <li key={e.id} className="small">
                {dateTime(e.at)} · {e.title} : {e.from ? STATUS[e.from].label : "nouveau"} → <strong>{STATUS[e.to].label}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Page Backlog : une rubrique par application, lue dans son dépôt GitHub. */
export function BacklogPage() {
  const { data, error, refresh } = usePolling(() => api<{ sources: SourceSummary[]; events: BacklogEvent[]; githubConfigured: boolean }>("/backlog"), 5 * 60_000);
  const [active, setActive] = useState("mga");

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  const source = data.sources.find((s) => s.key === active) ?? data.sources[0];

  return (
    <>
      <h1>Backlog</h1>
      <p className="muted small">
        Lu dans le backlog de chaque dépôt toutes les 15 minutes : le statut d'un chantier change dès que son évolution est livrée et notée dans le backlog.
      </p>
      {!data.githubConfigured && (
        <p className="card small">
          ⚠️ Jeton GitHub manquant : les dépôts privés ne peuvent pas être lus. Ajouter <code>GITHUB_TOKEN</code> sur le service supervision (voir Réglages ou{" "}
          <code>docs/deploiement.md</code>).
        </p>
      )}
      <div className="tabs">
        {data.sources.map((s) => {
          const open = (s.counts.in_progress ?? 0) + (s.counts.waiting ?? 0) + (s.counts.todo ?? 0);
          return (
            <button key={s.key} className={s.key === source.key ? "active" : ""} onClick={() => setActive(s.key)}>
              {s.label} {s.lastSync ? <span className="muted">({open})</span> : null}
            </button>
          );
        })}
      </div>
      <SourcePanel key={source.key} source={source} onSynced={() => void refresh()} />
    </>
  );
}

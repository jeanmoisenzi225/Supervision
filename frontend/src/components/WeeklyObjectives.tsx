import { useState } from "react";
import { api } from "../lib/api";
import { usePolling } from "../lib/usePolling";

type Objective = { id: string; title: string; done: boolean; doneAt: string | null; carried: number };
type WeekData = {
  week: string;
  weekEnd: string;
  current: boolean;
  previous: string;
  next: string | null;
  items: Objective[];
  progress: { done: number; total: number };
};

/** « 2026-11-16 » → date locale (sans décalage de fuseau). */
const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function rangeLabel(from: string, to: string) {
  const a = day(from);
  const b = day(to);
  const month = (x: Date) => x.toLocaleDateString("fr-FR", { month: "long" });
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${month(b)}` : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

/** Objectifs de la semaine (page d'accueil) : on en ajoute autant qu'on veut, on les valide au fur et à mesure ; ce qui n'est pas validé passe à la semaine suivante. */
export function WeeklyObjectives() {
  const [week, setWeek] = useState<string | null>(null); // null = semaine en cours
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, refresh } = usePolling(() => api<WeekData>(`/objectives${week ? `?week=${week}` : ""}`), 60_000, [week]);
  const view = data;

  async function act(request: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await request();
      // Les actions ne se font que sur la semaine en cours : on recharge cette semaine.
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    void act(() => api<WeekData>("/objectives", { method: "POST", body: { title } })).then(() => setDraft(""));
  };
  const toggle = (o: Objective) => act(() => api<WeekData>(`/objectives/${o.id}`, { method: "PATCH", body: { done: !o.done } }));
  const saveEdit = () => {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) return;
    void act(() => api<WeekData>(`/objectives/${editing.id}`, { method: "PATCH", body: { title } })).then(() => setEditing(null));
  };
  const remove = (o: Objective) => {
    if (window.confirm(`Supprimer l'objectif « ${o.title} » ?`)) void act(() => api<WeekData>(`/objectives/${o.id}`, { method: "DELETE" }));
  };
  const go = (target: string | null) => setWeek(target);

  const progress = view?.progress ?? { done: 0, total: 0 };
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const readOnly = view ? !view.current : false;

  return (
    <section className="card objectives" aria-label="Objectifs de la semaine">
      <div className="objectives-head">
        <div>
          <h2>Objectifs de la semaine</h2>
          <span className="small muted">{view ? rangeLabel(view.week, view.weekEnd) : "Chargement…"}{readOnly ? " · semaine passée" : ""}</span>
        </div>
        <div className="objectives-nav">
          <button className="link" aria-label="Semaine précédente" disabled={!view} onClick={() => view && go(view.previous)}>
            ‹
          </button>
          <button className="link" aria-label="Semaine suivante" disabled={!view?.next} onClick={() => view?.next && go(view.next)}>
            ›
          </button>
          {readOnly && (
            <button className="link" onClick={() => go(null)}>
              Cette semaine
            </button>
          )}
        </div>
      </div>

      <div className="objectives-progress" aria-label={`${progress.done} objectif(s) sur ${progress.total} validé(s)`}>
        <div className="objectives-bar">
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="small muted">
          {progress.done} / {progress.total} validé(s)
        </span>
      </div>

      {view && view.items.length === 0 && <p className="muted small">{readOnly ? "Aucun objectif cette semaine-là." : "Aucun objectif pour l'instant. Ajoutez le premier ci-dessous."}</p>}
      <ul className="objectives-list">
        {view?.items.map((o) => (
          <li key={o.id} className={o.done ? "done" : ""}>
            <button className="objective-check" role="checkbox" aria-checked={o.done} aria-label={o.done ? "Rouvrir l'objectif" : "Valider l'objectif"} disabled={busy || readOnly} onClick={() => void toggle(o)}>
              {o.done ? "✓" : ""}
            </button>
            {editing?.id === o.id ? (
              <input
                className="objective-edit"
                autoFocus
                value={editing.title}
                maxLength={300}
                onChange={(e) => setEditing({ id: o.id, title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditing(null);
                }}
                onBlur={saveEdit}
              />
            ) : (
              <span className="objective-title" onClick={() => !readOnly && !o.done && setEditing({ id: o.id, title: o.title })}>
                {o.title}
                {o.carried > 0 && <span className="pill pill-warn">reporté{o.carried > 1 ? ` ×${o.carried}` : ""}</span>}
              </span>
            )}
            {!readOnly && (
              <button className="link" aria-label="Supprimer l'objectif" disabled={busy} onClick={() => remove(o)}>
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <form
          className="objectives-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input value={draft} maxLength={300} placeholder="Ajouter un objectif…" aria-label="Nouvel objectif" onChange={(e) => setDraft(e.target.value)} />
          <button className="primary" type="submit" disabled={busy || !draft.trim()}>
            Ajouter
          </button>
        </form>
      )}
      {error && <p className="small" style={{ color: "var(--bad)" }}>{error}</p>}
    </section>
  );
}

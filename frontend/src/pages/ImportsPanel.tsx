import { useState } from "react";
import { api, type AppOverview } from "../lib/api";
import { dateTime, timeAgo } from "../lib/format";
import { usePolling } from "../lib/usePolling";

interface ImportItem {
  id: string;
  at: string;
  ok: boolean;
  author: string;
  file: string;
  detail: string;
  cause: string | null;
}

interface ImportsResponse {
  configured: boolean;
  notReady?: boolean;
  error?: string;
  totals?: { reussis: number; echecs: number };
  running?: { since: string; author: string; mission: string }[];
  items?: ImportItem[];
  next?: string | null;
}

const CAUSE: Record<string, string> = {
  redemarrage: "Redémarrage du service (mise en ligne)",
  delai: "Délai dépassé",
  connexion: "Connexion interrompue",
  document: "Document non exploitable",
  ia: "Échec de l'IA",
  autre: "Autre",
};

/** Onglet Imports : historique des imports de documents (réussis, en échec avec la cause, en cours). */
export function ImportsPanel({ app }: { app: AppOverview }) {
  const [filter, setFilter] = useState<"" | "OK" | "ECHEC">("");
  const [older, setOlder] = useState<ImportItem[]>([]);
  const [next, setNext] = useState<string | null | undefined>(undefined);
  const { data, error } = usePolling(() => api<ImportsResponse>(`/apps/${app.key}/imports?limit=100${filter ? `&status=${filter}` : ""}`), 30_000, [app.key, filter]);

  async function loadMore() {
    const before = next === undefined ? data?.next : next;
    if (!before) return;
    const r = await api<ImportsResponse>(`/apps/${app.key}/imports?limit=100&before=${encodeURIComponent(before)}${filter ? `&status=${filter}` : ""}`);
    setOlder((o) => [...o, ...(r.items ?? [])]);
    setNext(r.next ?? null);
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  if (!data.configured) return <p className="muted small">Non branché : les actions d'administration de cette appli ne sont pas configurées sur la supervision.</p>;
  if (data.notReady) return <p className="muted small">Pas encore branché : la version de l'appli qui expose l'historique des imports n'est pas encore en ligne.</p>;
  if (data.error) return <p className="error small">{data.error}</p>;

  const items = [...(data.items ?? []), ...older];
  const more = next === undefined ? data.next : next;
  const total = (data.totals?.reussis ?? 0) + (data.totals?.echecs ?? 0);
  const rate = total ? Math.round(((data.totals?.reussis ?? 0) / total) * 100) : null;

  return (
    <div className="stack">
      <section className="card">
        <p>
          <strong>{data.totals?.reussis ?? 0}</strong> réussi(s) · <strong>{data.totals?.echecs ?? 0}</strong> en échec
          {rate !== null ? ` · ${rate} % de réussite` : ""}
        </p>
        {data.running && data.running.length > 0 && (
          <p className="small">
            ⏳ {data.running.length} import(s) en cours : {data.running.map((r) => `${r.author}${r.mission ? ` (« ${r.mission} »)` : ""} depuis ${timeAgo(r.since).replace("il y a ", "")}`).join(" · ")}. Ne pas mettre en ligne tant qu'il y en a.
          </p>
        )}
        <div className="tabs">
          {([["", "Tous"], ["OK", "Réussis"], ["ECHEC", "En échec"]] as const).map(([v, l]) => (
            <button key={v} className={filter === v ? "active" : ""} onClick={() => { setFilter(v); setOlder([]); setNext(undefined); }}>
              {l}
            </button>
          ))}
        </div>
      </section>
      {items.length === 0 ? (
        <p className="muted small">Aucun import dans l'historique.</p>
      ) : (
        <table className="table">
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="nowrap">{dateTime(i.at)}</td>
                <td>
                  <span className={`dot ${i.ok ? "ok" : "ko"}`} />
                </td>
                <td>
                  <strong>{i.file}</strong>
                  <div className="small muted">{i.author}</div>
                </td>
                <td className="small">
                  {i.ok ? i.detail : (
                    <>
                      <span className="pill pill-warn">{CAUSE[i.cause ?? "autre"] ?? CAUSE.autre}</span>
                      <div className="muted">{i.detail}</div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {more && (
        <button className="btn" onClick={() => void loadMore()}>
          Afficher les imports plus anciens
        </button>
      )}
    </div>
  );
}

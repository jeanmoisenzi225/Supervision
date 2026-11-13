import { useState } from "react";
import { api, type AppOverview } from "../lib/api";
import { dateTime, timeAgo } from "../lib/format";
import { usePolling } from "../lib/usePolling";

const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);

interface ImportItem {
  id: string;
  at: string;
  ok: boolean;
  author: string;
  file: string;
  detail: string;
  procedures?: number;
  /** Taille du document en octets (imports depuis Procedia v0.60.0). */
  size?: number | null;
  cause: string | null;
}

interface ClientImports {
  id: string;
  name: string;
  procedures: number;
  imported: number;
  others: number;
  tracked: { reussis: number; echecs: number; procedures: number };
}

interface ImportsResponse {
  configured: boolean;
  notReady?: boolean;
  error?: string;
  since?: string | null;
  totals?: { reussis: number; echecs: number; procedures?: number };
  clients?: ClientImports[];
  unassigned?: number;
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
  const [client, setClient] = useState("");
  const [older, setOlder] = useState<ImportItem[]>([]);
  const [next, setNext] = useState<string | null | undefined>(undefined);
  const params = `${filter ? `&status=${filter}` : ""}${client ? `&client=${encodeURIComponent(client)}` : ""}`;
  const { data, error } = usePolling(() => api<ImportsResponse>(`/apps/${app.key}/imports?limit=100${params}`), 30_000, [app.key, params]);

  async function loadMore() {
    const before = next === undefined ? data?.next : next;
    if (!before) return;
    const r = await api<ImportsResponse>(`/apps/${app.key}/imports?limit=100&before=${encodeURIComponent(before)}${params}`);
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
          <strong>{data.totals?.reussis ?? 0}</strong> fichier(s) importé(s)
          {data.totals?.procedures !== undefined ? <> → <strong>{data.totals.procedures}</strong> procédure(s) créée(s)</> : null} · <strong>{data.totals?.echecs ?? 0}</strong> en échec
          {rate !== null ? ` · ${rate} % de réussite` : ""}
        </p>
        {data.since !== undefined && (
          <p className="small muted">
            {data.since ? `Suivi depuis le ${dateTime(data.since)}` : "Aucun import consigné pour l'instant"} : les imports plus anciens, les procédures saisies à la main ou dupliquées n'apparaissent pas dans l'historique. Tous clients confondus.
          </p>
        )}
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
      {data.clients && data.clients.length > 0 && (
        <section className="card">
          <h3>Par client</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th title="Procédures présentes dans l'outil">Procédures</th>
                  <th title="Issues d'un import (origine conservée)">dont importées</th>
                  <th title="Saisies, dupliquées, ou importées avant la conservation de l'origine">autres</th>
                  <th title="Imports consignés dans l'historique">Imports suivis</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((c) => (
                  <tr key={c.id} className={client === c.id ? "selected" : ""}>
                    <td>
                      <button className="client-link" onClick={() => { setClient(client === c.id ? "" : c.id); setOlder([]); setNext(undefined); }}>
                        {c.name}
                      </button>
                    </td>
                    <td><strong>{c.procedures}</strong></td>
                    <td>{c.imported}</td>
                    <td>{c.others}</td>
                    <td className="small">
                      {c.tracked.reussis} fichier(s) → {c.tracked.procedures} procédure(s)
                      {c.tracked.echecs ? <span className="muted"> · {c.tracked.echecs} échec(s)</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.unassigned ? (
            <p className="small muted">{data.unassigned} import(s) de l'historique sans client (catégorie supprimée depuis l'import).</p>
          ) : null}
          <p className="small muted">Touchez un client pour ne voir que ses imports{client ? " ; touchez-le à nouveau pour revenir à tous les clients" : ""}.</p>
        </section>
      )}
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
                  <div className="small muted">{i.author}{i.size ? ` · ${sizeLabel(i.size)}` : ""}</div>
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

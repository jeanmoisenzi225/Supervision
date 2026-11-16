import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppMark, Constellation, type StateOverride } from "../components/Constellation";
import { PaletteButton } from "../components/CommandPalette";
import { Replay } from "../components/Replay";
import { Brand } from "../components/Brand";
import { WeeklyObjectives } from "../components/WeeklyObjectives";
import { api, type Alert, type AppOverview, type ReplayData } from "../lib/api";
import { STATUS_LABEL, timeAgo } from "../lib/format";
import { toggleTheme } from "../lib/theme";
import { useStagedHide } from "../lib/useStagedHide";
import { usePolling } from "../lib/usePolling";
import { APP_VERSION } from "../version";

/** Titre du brief, écrit d'après l'état réel des applications. */
function headline(apps: AppOverview[]): string {
  const watched = apps.filter((a) => a.status !== "not_deployed" && a.status !== "paused");
  const bad = watched.filter((a) => a.status === "down" || a.status === "degraded");
  if (!watched.length) return "Aucune application n'est encore surveillée.";
  if (!bad.length) return "Tout fonctionne.";
  const names = bad.map((a) => a.name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
  return bad.length === watched.length ? "Toutes les applications sont en difficulté." : `Tout fonctionne, sauf ${list}.`;
}

/** Texte qui s'écrit lettre par lettre au chargement, puis change en fondu. */
function useTypewriter(text: string): string {
  const [shown, setShown] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (!first.current || !text) {
      setShown(text);
      return;
    }
    first.current = false;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(t);
    }, 26);
    return () => clearInterval(t);
  }, [text]);
  return shown;
}

/** Titre du brief au moment rejoué : l'événement le plus proche, sinon l'état des applis à cet instant. */
function replayHeadline(r: ReplayData, t: number, apps: AppOverview[]): string {
  const at = r.from + t * r.stepMin * 60_000;
  const near = r.events.filter((e) => Math.abs(e.at - at) <= 2 * r.stepMin * 60_000 && e.level !== "info")[0] ?? r.events.filter((e) => Math.abs(e.at - at) <= 2 * r.stepMin * 60_000)[0];
  if (near) return `${apps.find((a) => a.key === near.appKey)?.name ?? near.appKey} : ${near.title.charAt(0).toLowerCase()}${near.title.slice(1)}.`;
  const bad = r.apps.filter((a) => a.cells[t]?.s === "w" || a.cells[t]?.s === "b").map((a) => apps.find((x) => x.key === a.key)?.name ?? a.key);
  return bad.length ? `${bad.join(" et ")} ${bad.length > 1 ? "sont" : "est"} en difficulté à ce moment-là.` : "Tout est nominal. Rien à signaler.";
}

interface DocsReport { configured?: boolean; notReady?: boolean; error?: string; kept?: { count: number; expiringSoon: number }; deleted?: { manualInPeriod: number; autoInPeriod: number } }
interface RuntimeReport { supported?: boolean; episodes?: { endAt: number | null; peakMb: number | null; restAfterSec: number | null; interrupted: boolean; lastMb: number | null; baselineMb: number | null }[] }
interface IncoReport { configured?: boolean; notReady?: boolean; deferred?: boolean; total?: number }

/** Paragraphes du brief sur Procedia (imports, mémoire, documents, incohérences), d'après ses rapports signés. */
function procediaBrief(docs: DocsReport | null, rt: RuntimeReport | null, inco: IncoReport | null): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  if (docs?.deleted && docs.kept) {
    out.push(
      <p key="docs" className="home-nar">
        Cette semaine, les consultants ont supprimé <span className="chipnum ok">{docs.deleted.manualInPeriod} document(s)</span> en validant leurs procédures, et <span className="chipnum">{docs.deleted.autoInPeriod}</span> ont été purgés automatiquement. Il en reste <span className="chipnum">{docs.kept.count}</span> en attente
        {docs.kept.expiringSoon ? (
          <>
            , dont <span className="chipnum warn">{docs.kept.expiringSoon} à supprimer sous 3 jours ouvrés</span>
          </>
        ) : null}
        .
      </p>
    );
  }
  const last = rt?.episodes?.[rt.episodes.length - 1];
  if (last && last.peakMb !== null) {
    out.push(
      <p key="mem" className="home-nar">
        Dernier import de Procedia : pic de mémoire à <span className="chipnum warn">{Math.round(last.peakMb)} Mo</span>
        {last.endAt === null ? ", import en cours." : last.restAfterSec !== null ? <>, retour au repos en <span className="chipnum ok">{Math.max(1, Math.round(last.restAfterSec / 60))} min</span>.</> : last.interrupted ? ", interrompu par un nouvel import." : <>, mémoire pas encore redescendue ({Math.round(last.lastMb ?? 0)} Mo).</>}
      </p>
    );
  }
  if (inco && !inco.deferred && typeof inco.total === "number") {
    out.push(
      <p key="inco" className="home-nar">
        <span className={`chipnum ${inco.total ? "warn" : "ok"}`}>{inco.total} incohérence(s)</span> relevée(s) dans les procédures de Procedia. <Link to="/supervision/applis/procedia" className="small">Voir la fiche →</Link>
      </p>
    );
  }
  return out;
}

const sev = (s: Alert["severity"]) => (s === "critical" ? "bad" : s === "warning" ? "warn" : "");

/** Accueil NJMDev (v0.38.0) : le brief du jour à gauche, la constellation des applications à droite. */
export function Home({ onLogout }: { onLogout: () => void }) {
  const head = useRef<HTMLDivElement>(null);
  useStagedHide(head);
  const { data } = usePolling(() => api<{ apps: AppOverview[] }>("/overview"), 30_000);
  const { data: alerts } = usePolling(() => api<Alert[]>("/alerts?status=open"), 30_000);
  const { data: billing } = usePolling(() => Promise.all([api<unknown[]>("/billing/clients"), api<unknown[]>("/billing/invoices")]).then(([c, i]) => ({ clients: c.length, invoices: i.length })), 60_000);
  const { data: replay } = usePolling(() => api<ReplayData>("/replay?hours=6&step=5"), 60_000);
  const { data: docs } = usePolling(() => api<DocsReport>("/apps/procedia/qualite/documents?days=7"), 5 * 60_000);
  const { data: rt } = usePolling(() => api<RuntimeReport>("/apps/procedia/runtime?minutes=360"), 5 * 60_000);
  const { data: inco } = usePolling(() => api<IncoReport>("/apps/procedia/qualite/incoherences"), 10 * 60_000);
  const [t, setT] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const apps = data?.apps ?? [];
  const watched = apps.filter((a) => a.status !== "not_deployed" && a.status !== "paused");
  const down = watched.filter((a) => a.status === "down" || a.status === "degraded");
  const ok = watched.length - down.length;
  const open = alerts ?? [];
  const full = data ? (t !== null && replay ? replayHeadline(replay, t, apps) : headline(apps)) : "";
  const title = useTypewriter(full);
  const overrides: StateOverride | null =
    t !== null && replay
      ? Object.fromEntries(replay.apps.map((g) => [g.key, { status: (g.cells[t]?.s === "ok" ? "ok" : g.cells[t]?.s === "w" ? "degraded" : g.cells[t]?.s === "b" ? "down" : "unknown") as AppOverview["status"], ms: g.cells[t]?.ms ?? null }]))
      : null;
  const sel = apps.find((a) => a.key === selected) ?? null;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="shell home">
      <div className="hstack" id="hstack" ref={head}>
        <header className="lvl home-head">
        <Brand size={34} />
        <span className="topbar-actions">
          <PaletteButton />
          <button className="link" onClick={() => toggleTheme()}>
            Clair / sombre
          </button>
          <button className="link" onClick={onLogout}>
            Déconnexion
          </button>
        </span>
      </header>
      </div>
      <main className="home-grid">
        <div className="home-left">
          <div className="eyebrow">{today}</div>
          <h1 className="home-title">
            {title}
            {data && title.length < full.length && <span className="cursor" />}
          </h1>
          <p className="muted home-sub">
            {data ? `${watched.length} application(s) surveillée(s) · ${open.length} alerte(s) active(s)` : "Chargement…"}
          </p>

          {open.slice(0, 3).map((a) => (
            <div key={a.id} className={`attention ${sev(a.severity)}`}>
              <strong>{a.title}</strong>
              {a.detail && <span className="muted small">{a.detail}</span>}
              <span className="attention-foot">
                <span className="muted small">{timeAgo(a.openedAt)}</span>
                <Link to="/supervision/alertes" className="small">
                  Voir les alertes →
                </Link>
              </span>
            </div>
          ))}

          {watched.length > 0 && (
            <p className="home-nar">
              Disponibilité sur 24 h :{" "}
              {watched.map((a) => {
                const up = a.checks.map((c) => c.uptime24h).filter((x): x is number => x !== null);
                const v = up.length ? Math.min(...up) : null;
                return (
                  <button key={a.key} className={`chipapp ${a.status !== "ok" ? "warn" : ""}`} onPointerEnter={() => setFocus(a.key)} onPointerLeave={() => setFocus(null)} onClick={() => setSelected(selected === a.key ? null : a.key)}>
                    <AppMark appKey={a.key} size={16} />
                    {a.name}
                    <b>{v !== null ? `${String(v).replace(".", ",")} %` : "—"}</b>
                  </button>
                );
              })}
            </p>
          )}

          {procediaBrief(docs, rt, inco)}

          <section className="home-block">
            <WeeklyObjectives />
          </section>

          {replay && replay.apps.length > 0 && (
            <section className="home-block">
              <div className="eyebrow">Rejouer les 6 dernières heures</div>
              <Replay data={replay} apps={apps} t={t} onT={setT} hours={6} />
            </section>
          )}

          <section className="home-block">
            <div className="eyebrow">Modules</div>
            <div className="home-modules">
              <Link to="/supervision" className="home-module">
                <strong>NJM Supervision</strong>
                <span className="muted small">Disponibilité, alertes, journaux, coûts et administration.</span>
                <span className="small">{data ? (down.length ? `${down.length} appli(s) en difficulté` : "Tout fonctionne") : "Chargement…"}</span>
              </Link>
              <Link to="/facturation" className="home-module">
                <strong>NJM Facturation</strong>
                <span className="muted small">Clients, factures prévisionnelles, lignes libres, aperçu et PDF.</span>
                <span className="small">{billing ? `${billing.clients} client(s) · ${billing.invoices} facture(s)` : "Chargement…"}</span>
              </Link>
              <div className="home-module disabled" aria-disabled="true">
                <strong>NJM Website</strong>
                <span className="muted small">Sites internet des clients.</span>
                <span className="pill">Bientôt</span>
              </div>
            </div>
          </section>
        </div>

        <aside className="home-right">
          <div className="home-kpis">
            <div><small>Applications</small><b>{apps.length}</b></div>
            <div><small>Nominal</small><b className="ok-t">{ok}</b></div>
            <div><small>Surveillance</small><b className="warn-t">{down.length}</b></div>
            <div><small>Alertes</small><b className="warn-t">{open.length}</b></div>
          </div>
          {t !== null && replay && (
            <div className="home-replaybar">
              <span>Rejeu · {new Date(replay.from + t * replay.stepMin * 60_000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              <button className="link" onClick={() => setT(null)}>Revenir à maintenant</button>
            </div>
          )}
          {apps.length > 0 && <Constellation apps={apps} selected={selected} focus={focus} onSelect={(k) => setSelected(selected === k ? null : k)} onFocus={setFocus} overrides={overrides} />}
          <div className="home-sel">
            {sel ? (
              <>
                <div className="home-sel-head">
                  <AppMark appKey={sel.key} size={30} />
                  <div>
                    <strong>{sel.name}</strong>
                    <div className="muted small">{sel.description}</div>
                  </div>
                  <span className={`pill ${sel.status === "ok" ? "" : "pill-warn"}`}>{STATUS_LABEL[sel.status]}</span>
                </div>
                <Link to={`/supervision/applis/${sel.key}`} className="small">
                  Ouvrir la fiche →
                </Link>
              </>
            ) : (
              <span className="muted small">Touchez une application pour la détailler.</span>
            )}
          </div>
        </aside>
      </main>
      <footer className="footer">NJMDev v{APP_VERSION}</footer>
    </div>
  );
}

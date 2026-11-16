import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppPopup } from "../components/AppPopup";
import { Constellation, type StateOverride } from "../components/Constellation";
import { PaletteButton } from "../components/CommandPalette";
import { SettingsMenu } from "../components/SettingsMenu";
import { Replay } from "../components/Replay";
import { Brand } from "../components/Brand";
import { WeeklyObjectives } from "../components/WeeklyObjectives";
import { api, type Alert, type AppOverview, type ReplayData } from "../lib/api";
import { timeAgo } from "../lib/format";
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

const sev = (s: Alert["severity"]) => (s === "critical" ? "bad" : s === "warning" ? "warn" : "");

/** Accueil NJMDev (v0.38.0) : le brief du jour à gauche, la constellation des applications à droite. */
export function Home({ onLogout }: { onLogout: () => void }) {
  const head = useRef<HTMLDivElement>(null);
  useStagedHide(head);
  const { data } = usePolling(() => api<{ apps: AppOverview[] }>("/overview"), 30_000);
  const { data: alerts } = usePolling(() => api<Alert[]>("/alerts?status=open"), 30_000);
  const { data: replay } = usePolling(() => api<ReplayData>("/replay?hours=6&step=5"), 60_000);
  const [t, setT] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const apps = data?.apps ?? [];
  const watched = apps.filter((a) => a.status !== "not_deployed" && a.status !== "paused");
  const down = watched.filter((a) => a.status === "down" || a.status === "degraded");
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
          <Link to="/supervision" className="head-link">Supervision</Link>
          <Link to="/facturation" className="head-link">Facturation</Link>
          <SettingsMenu onLogout={onLogout} />
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

          <section className="home-block">
            <WeeklyObjectives />
          </section>

          {replay && replay.apps.length > 0 && (
            <section className="home-block">
              <div className="eyebrow">Rejouer les 6 dernières heures</div>
              <Replay data={replay} apps={apps} t={t} onT={setT} hours={6} />
            </section>
          )}
        </div>

        <aside className="home-right">
          {t !== null && replay && (
            <div className="home-replaybar">
              <span>Rejeu · {new Date(replay.from + t * replay.stepMin * 60_000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              <button className="link" onClick={() => setT(null)}>Revenir à maintenant</button>
            </div>
          )}
          {apps.length > 0 && <Constellation apps={apps} selected={selected} focus={focus} onSelect={(k) => setSelected(k)} onFocus={setFocus} overrides={overrides} />}
          <p className="muted small home-hint">Touchez un logo pour voir ses informations.</p>
        </aside>
      </main>
      {sel && <AppPopup app={sel} alerts={open} onClose={() => setSelected(null)} />}
      <footer className="footer">NJMDev v{APP_VERSION}</footer>
    </div>
  );
}

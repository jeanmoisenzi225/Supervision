import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppMark, Constellation } from "../components/Constellation";
import { Brand } from "../components/Brand";
import { WeeklyObjectives } from "../components/WeeklyObjectives";
import { api, type Alert, type AppOverview } from "../lib/api";
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

const sev = (s: Alert["severity"]) => (s === "critical" ? "bad" : s === "warning" ? "warn" : "");

/** Accueil NJMDev (v0.38.0) : le brief du jour à gauche, la constellation des applications à droite. */
export function Home({ onLogout }: { onLogout: () => void }) {
  const head = useRef<HTMLDivElement>(null);
  useStagedHide(head);
  const { data } = usePolling(() => api<{ apps: AppOverview[] }>("/overview"), 30_000);
  const { data: alerts } = usePolling(() => api<Alert[]>("/alerts?status=open"), 30_000);
  const { data: billing } = usePolling(() => Promise.all([api<unknown[]>("/billing/clients"), api<unknown[]>("/billing/invoices")]).then(([c, i]) => ({ clients: c.length, invoices: i.length })), 60_000);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const apps = data?.apps ?? [];
  const watched = apps.filter((a) => a.status !== "not_deployed" && a.status !== "paused");
  const down = watched.filter((a) => a.status === "down" || a.status === "degraded");
  const ok = watched.length - down.length;
  const open = alerts ?? [];
  const title = useTypewriter(data ? headline(apps) : "");
  const sel = apps.find((a) => a.key === selected) ?? null;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="shell home">
      <div className="hstack" id="hstack" ref={head}>
        <header className="lvl home-head">
        <Brand size={34} />
        <span className="topbar-actions">
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
            {data && title.length < headline(apps).length && <span className="cursor" />}
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

          <section className="home-block">
            <WeeklyObjectives />
          </section>

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
          {apps.length > 0 && <Constellation apps={apps} selected={selected} focus={focus} onSelect={(k) => setSelected(selected === k ? null : k)} onFocus={setFocus} />}
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

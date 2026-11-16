import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AppOverview } from "../lib/api";
import { toggleTheme } from "../lib/theme";

interface Item {
  label: string;
  kind: string;
  run: () => void;
}

export const openPalette = () => window.dispatchEvent(new Event("palette:open"));

/** Bouton de recherche des en-têtes. */
export function PaletteButton() {
  return (
    <button className="palette-btn" onClick={openPalette} aria-label="Rechercher">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <span className="palette-label">Rechercher…</span>
      <kbd>⌘K</kbd>
    </button>
  );
}

/** Palette de commandes (Ctrl ou ⌘ + K) : aller à une page, à une appli, changer de thème (v0.39.0). */
export function CommandPalette({ onLogout }: { onLogout: () => void }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [apps, setApps] = useState<AppOverview[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => {
      setOpen(true);
      setQ("");
      setSel(0);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        on();
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("palette:open", on);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("palette:open", on);
      window.removeEventListener("keydown", key);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => input.current?.focus(), 20);
    api<{ apps: AppOverview[] }>("/overview").then((r) => setApps(r.apps), () => undefined);
  }, [open]);

  const go = (path: string) => () => {
    setOpen(false);
    nav(path);
  };
  const items: Item[] = useMemo(
    () => [
      { label: "Accueil · brief du jour", kind: "Page", run: go("/") },
      { label: "Tableau de bord", kind: "Supervision", run: go("/supervision") },
      { label: "Alertes", kind: "Supervision", run: go("/supervision/alertes") },
      { label: "Journaux", kind: "Supervision", run: go("/supervision/journaux") },
      { label: "Backlog", kind: "Supervision", run: go("/supervision/backlog") },
      { label: "Claude · dépenses", kind: "Supervision", run: go("/supervision/claude") },
      { label: "Coûts", kind: "Supervision", run: go("/supervision/couts") },
      { label: "Réglages", kind: "Supervision", run: go("/supervision/reglages") },
      { label: "Facturation", kind: "Module", run: go("/facturation") },
      ...apps.map((a) => ({ label: a.name, kind: "Application", run: go(`/supervision/applis/${a.key}`) })),
      { label: "Changer de thème (clair / sombre)", kind: "Action", run: () => (setOpen(false), toggleTheme()) },
      { label: "Se déconnecter", kind: "Action", run: () => (setOpen(false), onLogout()) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apps, onLogout]
  );
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = items.filter((i) => norm(i.label).includes(norm(q)));
  if (!open) return null;
  return (
    <div className="palette" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="palette-box" role="dialog" aria-label="Recherche">
        <input
          ref={input}
          value={q}
          placeholder="Rechercher une page, une appli, une action…"
          onChange={(e) => (setQ(e.target.value), setSel(0))}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(list.length - 1, s + 1)));
            else if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
            else if (e.key === "Enter") list[sel]?.run();
          }}
        />
        <ul>
          {list.length === 0 && <li className="muted">Aucun résultat.</li>}
          {list.map((i, k) => (
            <li key={i.label} className={k === sel ? "sel" : ""} onClick={i.run} onPointerEnter={() => setSel(k)}>
              {i.label}
              <small>{i.kind}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

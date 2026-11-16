import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getTheme, setTheme, type Theme } from "../lib/theme";

/** Bouton « Paramètres » des en-têtes (v0.41.0) : thème clair ou sombre, réglages, mesure de l'écran, déconnexion. */
export function SettingsMenu({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [theme, set] = useState<Theme>(getTheme());
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span className="settings-menu" ref={box}>
      <button className="link settings-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
        Paramètres
      </button>
      {open && (
        <div className="settings-pop" role="menu">
          <div className="settings-row">
            <span className="muted small">Thème</span>
            <div className="seg">
              {(["dark", "light"] as const).map((t) => (
                <button key={t} className={theme === t ? "active" : ""} onClick={() => (setTheme(t), set(t))}>
                  {t === "dark" ? "Sombre" : "Clair"}
                </button>
              ))}
            </div>
          </div>
          <Link to="/supervision/reglages" onClick={() => setOpen(false)}>Réglages</Link>
          <a href="/ecran">Mesurer l'écran</a>
          <button className="link" onClick={() => (setOpen(false), onLogout())}>Se déconnecter</button>
        </div>
      )}
    </span>
  );
}

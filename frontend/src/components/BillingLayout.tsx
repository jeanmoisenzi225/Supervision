import { useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { toggleTheme } from "../lib/theme";
import { PaletteButton } from "./CommandPalette";
import { useStagedHide } from "../lib/useStagedHide";
import { APP_VERSION } from "../version";
import { Brand } from "./Brand";

/** Cadre du module NJM Facturation : marque NJMDev (retour au menu général) et corps de page. */
export function BillingLayout({ onLogout }: { onLogout: () => void }) {
  const head = useRef<HTMLDivElement>(null);
  useStagedHide(head);
  return (
    <div className="shell">
      <div className="hstack" id="hstack" ref={head}>
        <header className="lvl topbar">
          <NavLink to="/" className="brand" title="Menu NJMDev">
            <Brand module="Facturation" />
          </NavLink>
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
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">NJMDev · NJM Facturation · v{APP_VERSION}</footer>
    </div>
  );
}

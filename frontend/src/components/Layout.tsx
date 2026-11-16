import { useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { toggleTheme } from "../lib/theme";
import { useStagedHide } from "../lib/useStagedHide";
import { APP_VERSION } from "../version";
import { Brand } from "./Brand";

/** Cadre du module NJM Supervision : marque NJMDev (retour au menu général) et navigation du module. */
export function Layout({ onLogout }: { onLogout: () => void }) {
  const head = useRef<HTMLDivElement>(null);
  useStagedHide(head);
  return (
    <div className="shell">
      <div className="hstack" id="hstack" ref={head}>
        <header className="lvl topbar">
          <NavLink to="/" className="brand" title="Menu NJMDev">
            <Brand module="Supervision" />
          </NavLink>
          <span className="topbar-actions">
            <button className="link" onClick={() => toggleTheme()}>
              Clair / sombre
            </button>
            <button className="link" onClick={onLogout}>
              Déconnexion
            </button>
          </span>
        </header>
        <nav className="lvl subbar nav">
          <NavLink to="/supervision" end>
            Tableau de bord
          </NavLink>
          <NavLink to="/supervision/alertes">Alertes</NavLink>
          <NavLink to="/supervision/journaux">Journaux</NavLink>
          <NavLink to="/supervision/backlog">Backlog</NavLink>
          <NavLink to="/supervision/claude">Claude</NavLink>
          <NavLink to="/supervision/couts">Coûts</NavLink>
          <NavLink to="/supervision/reglages">Réglages</NavLink>
        </nav>
      </div>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">NJMDev · NJM Supervision · v{APP_VERSION}</footer>
    </div>
  );
}

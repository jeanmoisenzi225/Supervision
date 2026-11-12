import { NavLink, Outlet } from "react-router-dom";
import { APP_VERSION } from "../version";
import { Brand } from "./Brand";

/** Cadre du module NJM Supervision : marque NJMDev (retour au menu général) et navigation du module. */
export function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand" title="Menu NJMDev">
          <Brand module="Supervision" />
        </NavLink>
        <nav className="nav">
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
        <button className="link" onClick={onLogout}>
          Déconnexion
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">NJMDev · NJM Supervision · v{APP_VERSION}</footer>
    </div>
  );
}

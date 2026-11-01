import { NavLink, Outlet } from "react-router-dom";
import { APP_VERSION } from "../version";

export function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          Supervision
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            Tableau de bord
          </NavLink>
          <NavLink to="/alertes">Alertes</NavLink>
          <NavLink to="/journaux">Journaux</NavLink>
          <NavLink to="/claude">Claude</NavLink>
          <NavLink to="/reglages">Réglages</NavLink>
        </nav>
        <button className="link" onClick={onLogout}>
          Déconnexion
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">Supervision v{APP_VERSION}</footer>
    </div>
  );
}

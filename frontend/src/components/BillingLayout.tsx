import { NavLink, Outlet } from "react-router-dom";
import { APP_VERSION } from "../version";
import { Brand } from "./Brand";

/** Cadre du module NJM Facturation : marque NJMDev (retour au menu général) et corps de page. */
export function BillingLayout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand" title="Menu NJMDev">
          <Brand module="Facturation" />
        </NavLink>
        <nav className="nav" />
        <button className="link" onClick={onLogout}>
          Déconnexion
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">NJMDev · NJM Facturation · v{APP_VERSION}</footer>
    </div>
  );
}

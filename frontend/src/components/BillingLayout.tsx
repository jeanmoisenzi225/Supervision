import { useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { toggleTheme } from "../lib/theme";
import { useAutoHide } from "../lib/useAutoHide";
import { APP_VERSION } from "../version";
import { Brand } from "./Brand";

/** Cadre du module NJM Facturation : marque NJMDev (retour au menu général) et corps de page. */
export function BillingLayout({ onLogout }: { onLogout: () => void }) {
  const head = useRef<HTMLElement>(null);
  useAutoHide(head);
  return (
    <div className="shell">
      <header className="topbar" ref={head}>
        <NavLink to="/" className="brand" title="Menu NJMDev">
          <Brand module="Facturation" />
        </NavLink>
        <nav className="nav" />
        <button className="link" onClick={() => toggleTheme()}>
          Clair / sombre
        </button>
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

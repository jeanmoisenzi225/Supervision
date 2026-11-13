import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { PullToRefresh } from "./components/PullToRefresh";
import { getToken, setToken } from "./lib/api";
import { AlertsPage } from "./pages/AlertsPage";
import { AppDetail } from "./pages/AppDetail";
import { BacklogPage } from "./pages/BacklogPage";
import { BillingLayout } from "./components/BillingLayout";
import { BillingPage } from "./pages/BillingPage";
import { CostsPage } from "./pages/CostsPage";
import { ClaudePage } from "./pages/ClaudePage";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { LogsPage } from "./pages/LogsPage";
import { Settings } from "./pages/Settings";
import { Splash } from "./components/Splash";

export function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()));

  useEffect(() => {
    const onLogout = () => setLoggedIn(false);
    window.addEventListener("supervision:logout", onLogout);
    return () => window.removeEventListener("supervision:logout", onLogout);
  }, []);

  const logout = () => {
    setToken(null);
    setLoggedIn(false);
  };

  // La page de démarrage reste montée à la connexion : elle ne se rejoue pas.
  if (!loggedIn) {
    return (
      <>
        <Splash />
        <Login onLogin={() => setLoggedIn(true)} />
      </>
    );
  }

  return (
    <BrowserRouter>
      <Splash />
      <PullToRefresh />
      <Routes>
        <Route index element={<Home onLogout={logout} />} />
        <Route
          path="supervision"
          element={
            <Layout onLogout={logout} />
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="applis/:key" element={<AppDetail />} />
          <Route path="alertes" element={<AlertsPage />} />
          <Route path="journaux" element={<LogsPage />} />
          <Route path="claude" element={<ClaudePage />} />
          <Route path="couts" element={<CostsPage />} />
          <Route path="facturation" element={<Navigate to="/facturation" replace />} />
          <Route path="backlog" element={<BacklogPage />} />
          <Route path="reglages" element={<Settings />} />
          <Route path="*" element={<Navigate to="/supervision" replace />} />
        </Route>
        <Route path="facturation" element={<BillingLayout onLogout={logout} />}>
          <Route index element={<BillingPage />} />
          <Route path="*" element={<Navigate to="/facturation" replace />} />
        </Route>
        {/* Anciennes adresses (avant NJMDev, v0.15.0) : notifications déjà reçues, favoris. */}
        {["applis/*", "alertes", "journaux", "claude", "backlog", "reglages"].map((p) => (
          <Route key={p} path={p} element={<LegacyRedirect />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/** Redirige une ancienne adresse (/alertes?id=…) vers le module Supervision (/supervision/alertes?id=…). */
function LegacyRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={`/supervision${pathname}${search}`} replace />;
}

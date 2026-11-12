import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { PullToRefresh } from "./components/PullToRefresh";
import { getToken, setToken } from "./lib/api";
import { AlertsPage } from "./pages/AlertsPage";
import { AppDetail } from "./pages/AppDetail";
import { BacklogPage } from "./pages/BacklogPage";
import { ClaudePage } from "./pages/ClaudePage";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { LogsPage } from "./pages/LogsPage";
import { Settings } from "./pages/Settings";

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

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;

  return (
    <BrowserRouter>
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
          <Route path="backlog" element={<BacklogPage />} />
          <Route path="reglages" element={<Settings />} />
          <Route path="*" element={<Navigate to="/supervision" replace />} />
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

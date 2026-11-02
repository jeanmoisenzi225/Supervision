import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { getToken, setToken } from "./lib/api";
import { AlertsPage } from "./pages/AlertsPage";
import { AppDetail } from "./pages/AppDetail";
import { BacklogPage } from "./pages/BacklogPage";
import { ClaudePage } from "./pages/ClaudePage";
import { Dashboard } from "./pages/Dashboard";
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

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <Layout
              onLogout={() => {
                setToken(null);
                setLoggedIn(false);
              }}
            />
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="applis/:key" element={<AppDetail />} />
          <Route path="alertes" element={<AlertsPage />} />
          <Route path="journaux" element={<LogsPage />} />
          <Route path="claude" element={<ClaudePage />} />
          <Route path="backlog" element={<BacklogPage />} />
          <Route path="reglages" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

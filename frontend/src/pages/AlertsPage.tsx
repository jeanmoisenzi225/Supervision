import { AlertsList } from "../components/AlertsList";
import { api, type AppOverview } from "../lib/api";
import { usePolling } from "../lib/usePolling";

export function AlertsPage() {
  const { data } = usePolling(() => api<{ apps: AppOverview[] }>("/overview"), 60_000);
  const names = Object.fromEntries((data?.apps ?? []).map((a) => [a.key, a.name]));
  return (
    <>
      <h1>Alertes</h1>
      <AlertsList appNames={names} />
    </>
  );
}

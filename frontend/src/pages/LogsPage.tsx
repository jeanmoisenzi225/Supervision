import { LogsView } from "../components/LogsView";
import { api, type AppOverview } from "../lib/api";
import { usePolling } from "../lib/usePolling";

export function LogsPage() {
  const { data } = usePolling(() => api<{ apps: AppOverview[] }>("/overview"), 60_000);
  return (
    <>
      <h1>Journaux</h1>
      <LogsView apps={data?.apps.map((a) => ({ key: a.key, name: a.name }))} />
    </>
  );
}

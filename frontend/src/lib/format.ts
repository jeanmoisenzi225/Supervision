import type { AppStatus } from "./api";

export const STATUS_LABEL: Record<AppStatus, string> = {
  ok: "Opérationnel",
  degraded: "Dégradé",
  down: "En panne",
  unknown: "En attente",
  not_deployed: "Non surveillé",
};

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "jamais";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `il y a ${Math.max(s, 0)} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

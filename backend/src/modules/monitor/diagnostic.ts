import type { AppTarget } from "../../config/apps";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { describeService, resolveServiceIds } from "../actions/render";
import { getPause } from "../pause/pause.service";
import { DISK_ALERT, EXPIRY_WARN_DAYS, getAppResources, MEMORY_ALERT } from "../resources/resources.service";
import { last, percent } from "../resources/units";
import { checkNow } from "./monitor";

export type DiagStatus = "ok" | "warn" | "ko" | "info";

export interface DiagItem {
  id: string;
  label: string;
  status: DiagStatus;
  detail: string;
}

const RANK: Record<DiagStatus, number> = { info: 0, ok: 1, warn: 2, ko: 3 };

/** État d'ensemble : le pire des points vérifiés (fonction pure, testée). */
export function overallStatus(items: DiagItem[]): DiagStatus {
  return items.reduce<DiagStatus>((worst, i) => (RANK[i.status] > RANK[worst] ? i.status : worst), "ok");
}

export function uptimeStatus(pct: number | null): DiagStatus {
  if (pct === null) return "info";
  return pct >= 99 ? "ok" : pct >= 90 ? "warn" : "ko";
}

export function latencyStatus(ms: number, sleepsWhenIdle: boolean): DiagStatus {
  const slow = sleepsWhenIdle ? 60_000 : 5_000;
  return ms <= slow ? "ok" : "warn";
}

const DEPLOY_LABEL: Record<string, string> = {
  live: "en ligne",
  build_in_progress: "construction en cours",
  update_in_progress: "mise à jour en cours",
  build_failed: "échec de construction",
  update_failed: "échec de mise à jour",
  canceled: "annulé",
  pre_deploy_failed: "échec avant déploiement",
};

export function deployStatus(service: { suspended?: boolean; deploys?: { status: string }[] }): DiagStatus {
  if (service.suspended) return "ko";
  const last = service.deploys?.[0]?.status;
  if (!last) return "info";
  if (last.endsWith("failed")) return "ko";
  if (last.endsWith("in_progress") || last === "created") return "info";
  return "ok";
}

function ago(date: Date): string {
  const min = Math.round((Date.now() - date.getTime()) / 60_000);
  if (min < 60) return `il y a ${min} min`;
  if (min < 48 * 60) return `il y a ${Math.round(min / 60)} h`;
  return `il y a ${Math.round(min / 1440)} j`;
}

/** Diagnostic complet d'une appli : tout est vérifié d'un coup, compte-rendu point par point. */
export async function runDiagnostic(app: AppTarget) {
  const started = Date.now();
  const items: DiagItem[] = [];
  const since = new Date(Date.now() - 24 * 3600_000);

  const pause = await getPause(app.key);
  if (pause) {
    items.push({
      id: "pause",
      label: "Supervision",
      status: "info",
      detail: `Coupée ${pause.until ? `jusqu'au ${pause.until.toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}` : "jusqu'à réactivation"} : ni alertes ni notifications.`,
    });
  }

  // 1. Adresses : vérifiées à l'instant.
  if (app.checks.length === 0) {
    items.push({ id: "checks", label: "Adresses", status: "info", detail: "Aucune adresse surveillée (appli pas encore en ligne)." });
  } else {
    await checkNow(app);
    for (const c of app.checks) {
      const [last, total, ok] = await Promise.all([
        prisma.checkResult.findFirst({ where: { appKey: app.key, checkId: c.id }, orderBy: { at: "desc" } }),
        prisma.checkResult.count({ where: { appKey: app.key, checkId: c.id, at: { gte: since } } }),
        prisma.checkResult.count({ where: { appKey: app.key, checkId: c.id, at: { gte: since }, ok: true } }),
      ]);
      if (!last) continue;
      items.push({
        id: `check-${c.id}`,
        label: c.label,
        status: last.ok ? latencyStatus(last.latencyMs ?? 0, app.sleepsWhenIdle) : "ko",
        detail: last.ok ? `Répond en ${last.latencyMs} ms.` : `Ne répond pas : ${last.error ?? "erreur"}.`,
      });
      const pct = total ? Math.round((ok / total) * 1000) / 10 : null;
      items.push({
        id: `uptime-${c.id}`,
        label: `${c.label} · disponibilité 24 h`,
        status: uptimeStatus(pct),
        detail: pct === null ? "Pas encore de mesure." : `${pct} % (${ok}/${total} vérifications réussies).`,
      });
    }
  }

  // 2. Hébergement Render.
  if (!env.renderApiKey) {
    items.push({ id: "render", label: "Hébergement Render", status: "info", detail: "Clé API Render non configurée." });
  } else {
    try {
      const ids = await resolveServiceIds(app);
      if (ids.length === 0) items.push({ id: "render", label: "Hébergement Render", status: "info", detail: "Aucun service Render reconnu." });
      for (const id of ids) {
        try {
          const s = await describeService(id);
          const last = s.deploys[0];
          items.push({
            id: `render-${id}`,
            label: `Render · ${s.name}`,
            status: deployStatus(s),
            detail: s.suspended
              ? "Service suspendu."
              : last
                ? `Dernier déploiement ${DEPLOY_LABEL[last.status] ?? last.status} (${ago(new Date(last.createdAt))})${last.commit ? ` : « ${last.commit} »` : ""}.`
                : "Aucun déploiement.",
          });
        } catch (err) {
          items.push({ id: `render-${id}`, label: `Render · ${id}`, status: "ko", detail: (err as Error).message });
        }
      }
    } catch (err) {
      items.push({ id: "render", label: "Hébergement Render", status: "ko", detail: (err as Error).message });
    }
  }

  // 2 bis. Ressources : mémoire des services, disque et expiration des bases.
  if (env.renderApiKey) {
    try {
      const r = await getAppResources(app, "24h");
      for (const s of r.services) {
        const pct = percent(last(s.memory), s.memoryLimit);
        const peak = s.memoryLimit ? percent(Math.max(0, ...s.memory.map((p) => p[1])), s.memoryLimit) : null;
        items.push({
          id: `mem-${s.id}`,
          label: `Mémoire · ${s.name}`,
          status: pct === null ? "info" : pct >= MEMORY_ALERT ? "warn" : "ok",
          detail: pct === null ? "Mesure indisponible." : `${pct} % de la limite du plan en ce moment${peak !== null ? `, pic sur 24 h : ${peak} %` : ""}.`,
        });
      }
      for (const db of r.databases) {
        const pct = db.diskSizeGB ? percent(last(db.disk), db.diskSizeGB * 1024 ** 3) : null;
        items.push({
          id: `disk-${db.id}`,
          label: `Base · ${db.name}`,
          status: pct === null ? "info" : pct >= DISK_ALERT ? "warn" : "ok",
          detail: pct === null ? `Offre ${db.plan}.` : `Disque rempli à ${pct} % (${db.diskSizeGB} Go, offre ${db.plan}).`,
        });
        if (db.daysLeft !== null) {
          items.push({
            id: `expiry-${db.id}`,
            label: `Base gratuite · ${db.name}`,
            status: db.daysLeft <= 2 ? "ko" : db.daysLeft <= EXPIRY_WARN_DAYS ? "warn" : "ok",
            detail: `Expire dans ${db.daysLeft} jour(s) (${new Date(db.expiresAt!).toLocaleDateString("fr-FR")}) : passer à une offre payante avant pour garder les données.`,
          });
        }
      }
    } catch (err) {
      items.push({ id: "resources", label: "Ressources", status: "info", detail: `Mesures indisponibles : ${(err as Error).message}` });
    }
  }

  // 3. Erreurs des dernières 24 h, regroupées par message.
  const errors = await prisma.logEntry.findMany({
    where: { appKey: app.key, at: { gte: since }, level: { in: ["error", "fatal"] } },
    select: { message: true },
    orderBy: { id: "desc" },
    take: 500,
  });
  if (errors.length === 0) {
    items.push({ id: "errors", label: "Erreurs 24 h", status: app.ingestToken ? "ok" : "info", detail: app.ingestToken ? "Aucune erreur." : "Journaux non branchés." });
  } else {
    const groups = new Map<string, number>();
    for (const e of errors) {
      const line = e.message.split("\n")[0].slice(0, 120);
      groups.set(line, (groups.get(line) ?? 0) + 1);
    }
    const top = [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    items.push({
      id: "errors",
      label: "Erreurs 24 h",
      status: "warn",
      detail: `${errors.length} erreur(s)${errors.length === 500 ? " ou plus" : ""}. Les plus fréquentes : ${top.map(([m, n]) => `« ${m} » ×${n}`).join(" ; ")}.`,
    });
  }

  // 4. Alertes en cours.
  const alerts = await prisma.alert.findMany({ where: { appKey: app.key, status: { in: ["open", "acknowledged"] } }, select: { severity: true, title: true } });
  items.push({
    id: "alerts",
    label: "Alertes en cours",
    status: alerts.length === 0 ? "ok" : alerts.some((a) => a.severity === "critical") ? "ko" : "warn",
    detail: alerts.length === 0 ? "Aucune." : alerts.slice(0, 3).map((a) => a.title).join(" ; ") + (alerts.length > 3 ? ` (+${alerts.length - 3})` : ""),
  });

  // 5. Journaux reçus.
  if (!app.ingestToken) {
    items.push({ id: "logs", label: "Journaux", status: "info", detail: "Non branchés." });
  } else {
    const last = await prisma.logEntry.findFirst({ where: { appKey: app.key }, orderBy: { id: "desc" }, select: { receivedAt: true } });
    items.push({
      id: "logs",
      label: "Journaux",
      status: !last ? "warn" : Date.now() - last.receivedAt.getTime() < 24 * 3600_000 ? "ok" : "warn",
      detail: last ? `Dernier journal reçu ${ago(last.receivedAt)}.` : "Aucun journal reçu : vérifier SUPERVISION_URL et SUPERVISION_INGEST_TOKEN dans l'appli.",
    });
  }

  // 6. Actions d'administration de l'appli.
  if (app.adminUrl && app.adminToken) {
    try {
      const res = await fetch(`${app.adminUrl}/supervision/actions`, {
        headers: { Authorization: `Bearer ${app.adminToken}` },
        signal: AbortSignal.timeout(15_000),
      });
      items.push({ id: "admin", label: "Actions de l'appli", status: res.ok ? "ok" : "ko", detail: res.ok ? "Joignables." : `L'appli a répondu ${res.status}.` });
    } catch (err) {
      items.push({ id: "admin", label: "Actions de l'appli", status: "ko", detail: `Injoignables : ${(err as Error).message}` });
    }
  }

  return { appKey: app.key, at: new Date(), durationMs: Date.now() - started, overall: overallStatus(items), items };
}

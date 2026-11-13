import { apps } from "../../config/apps";
import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { getTimeline } from "./timeline.service";

export const timelineRouter = asyncRouter();
timelineRouter.use(requireAdmin);

/** Chronologie des incidents d'une appli (`hours` : 1 à 720). */
timelineRouter.get("/:key/timeline", async (req, res) => {
  const app = apps.find((a) => a.key === req.params.key);
  if (!app) throw new HttpError(404, "Appli inconnue");
  const hours = Math.min(720, Math.max(1, Number(req.query.hours ?? 24) || 24));
  res.json(await getTimeline(app, hours));
});

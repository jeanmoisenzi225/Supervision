import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { getReplay } from "./replay.service";

export const replayRouter = asyncRouter();
replayRouter.use(requireAdmin);

/** `GET /api/replay?hours=6&step=5` : cases d'état de toutes les applis et événements, pour le rejeu. */
replayRouter.get("/", async (req, res) => {
  const hours = Math.min(48, Math.max(1, Number(req.query.hours ?? 6) || 6));
  const step = [5, 15, 30, 60].includes(Number(req.query.step)) ? Number(req.query.step) : hours <= 6 ? 5 : 15;
  res.json(await getReplay(hours, step));
});

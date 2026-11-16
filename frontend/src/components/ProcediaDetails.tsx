import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { usePolling } from "../lib/usePolling";

interface DocsReport { kept?: { count: number; expiringSoon: number }; deleted?: { manualInPeriod: number; autoInPeriod: number } }
interface RuntimeReport { episodes?: { endAt: number | null; peakMb: number | null; restAfterSec: number | null; interrupted: boolean; lastMb: number | null }[] }
interface IncoReport { deferred?: boolean; total?: number }

/** Informations propres à Procedia (documents, dernier import, incohérences), affichées dans sa fenêtre seulement. */
export function ProcediaDetails() {
  const { data: docs } = usePolling(() => api<DocsReport>("/apps/procedia/qualite/documents?days=7"), 5 * 60_000);
  const { data: rt } = usePolling(() => api<RuntimeReport>("/apps/procedia/runtime?minutes=360"), 5 * 60_000);
  const { data: inco } = usePolling(() => api<IncoReport>("/apps/procedia/qualite/incoherences"), 10 * 60_000);
  const last = rt?.episodes?.[rt.episodes.length - 1];
  const lines: React.ReactNode[] = [];
  if (docs?.deleted && docs.kept)
    lines.push(
      <p key="d">
        Cette semaine, les consultants ont supprimé <span className="chipnum ok">{docs.deleted.manualInPeriod} document(s)</span> en validant leurs procédures, et <span className="chipnum">{docs.deleted.autoInPeriod}</span> ont été purgés automatiquement. Il en reste <span className="chipnum">{docs.kept.count}</span> en attente
        {docs.kept.expiringSoon ? <>, dont <span className="chipnum warn">{docs.kept.expiringSoon} à supprimer sous 3 jours ouvrés</span></> : null}.
      </p>
    );
  if (last && last.peakMb !== null)
    lines.push(
      <p key="m">
        Dernier import : pic de mémoire à <span className="chipnum warn">{Math.round(last.peakMb)} Mo</span>
        {last.endAt === null ? ", import en cours." : last.restAfterSec !== null ? <>, retour au repos en <span className="chipnum ok">{Math.max(1, Math.round(last.restAfterSec / 60))} min</span>.</> : last.interrupted ? ", interrompu par un nouvel import." : <>, mémoire pas encore redescendue ({Math.round(last.lastMb ?? 0)} Mo).</>}
      </p>
    );
  if (inco && !inco.deferred && typeof inco.total === "number")
    lines.push(
      <p key="i">
        <span className={`chipnum ${inco.total ? "warn" : "ok"}`}>{inco.total} incohérence(s)</span> relevée(s) dans les procédures. <Link to="/supervision/applis/procedia">Voir le détail →</Link>
      </p>
    );
  if (!lines.length) return null;
  return (
    <div className="popup-sec">
      <div className="eyebrow">Procedia</div>
      <div className="popup-nar">{lines}</div>
    </div>
  );
}

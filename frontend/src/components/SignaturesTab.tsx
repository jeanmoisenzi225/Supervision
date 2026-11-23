import { useEffect, useState } from "react";
import { api, apiBlob } from "../lib/api";
import { onRefreshRequested } from "../lib/refresh";
import { CheckMark, Circle, Hourglass } from "./Icon";

type Signer = { id: string; role: string; name: string; status: string; signedAt: string | null; viewedAt: string | null; locked: boolean; linkIssued: boolean };
export type SignReq = { id: string; kind: string; title: string; status: string; createdAt: string; expiresAt: string; completedAt: string | null; appName: string; clientName: string; signers: Signer[] };
export type FreshLinks = { requestId: string; links: { signerId: string; role: string; name: string; token: string; code: string }[] };
const ROLE: Record<string, string> = { prestataire: "Vous (prestataire)", client: "Client" };
const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const linkOf = (token: string) => `${window.location.origin}/signer/${token}`;

function state(r: SignReq): { icon: "wait" | "done" | null; label: string; color: string } {
  if (r.status === "completed") return { icon: "done", label: "Signé par tous", color: "var(--ok)" };
  if (r.status === "cancelled") return { icon: null, label: "Annulé", color: "var(--muted)" };
  const done = r.signers.filter((s) => s.status === "signed").length;
  const waiting = r.signers.filter((s) => s.status !== "signed").map((s) => ROLE[s.role] ?? s.role).join(", ");
  const toIssue = r.signers.some((s) => s.status === "pending" && !s.linkIssued);
  return { icon: "wait", label: `${done}/${r.signers.length} signé · attend : ${waiting}${toIssue ? " (lien à générer)" : ""}`, color: "var(--warn)" };
}

/** Suivi des signatures : une liste claire, le détail seulement quand on ouvre une ligne. */
export function SignaturesTab({ fresh, onDismissFresh, onError, onNotice, onCount }: { fresh: FreshLinks | null; onDismissFresh: () => void; onError: (m: string) => void; onNotice: (m: string) => void; onCount: (pending: number) => void }) {
  const [reqs, setReqs] = useState<SignReq[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [extra, setExtra] = useState<FreshLinks["links"]>([]);
  const load = () => api<SignReq[]>("/billing/signature-requests").then((r) => { setReqs(r); onCount(r.filter((x) => x.status === "pending").length); }).catch((e) => onError(e.message));
  // Rafraîchi toutes les 15 s, au retour sur l'appli (après avoir signé dans un autre onglet) et au geste « glisser pour actualiser ».
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    const stop = onRefreshRequested(() => void load());
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); stop(); };
  }, []);

  const copy = (text: string, label: string) => navigator.clipboard?.writeText(text).then(() => onNotice(`${label} copié.`), () => onError("Copie impossible : sélectionne le texte à la main."));
  const save = async (path: string, filename: string) => {
    try { const blob = await apiBlob(path); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url); } catch (err) { onError((err as Error).message); }
  };
  /** Ouvre le PDF dans un nouvel onglet (la fenêtre est ouverte tout de suite pour ne pas être bloquée sur téléphone). */
  async function view(path: string) {
    const w = window.open("", "_blank");
    try { const blob = await apiBlob(path); const url = window.URL.createObjectURL(blob); if (w) w.location.href = url; else window.location.href = url; } catch (err) { w?.close(); onError((err as Error).message); }
  }
  async function cancel(id: string) {
    if (!window.confirm("Annuler cette demande ? Les liens ne fonctionneront plus.")) return;
    try { await api(`/billing/signature-requests/${id}/cancel`, { method: "POST" }); await load(); } catch (err) { onError((err as Error).message); }
  }
  async function reset(r: SignReq, s: Signer) {
    try { const l = await api<FreshLinks["links"][number]>(`/billing/signature-requests/${r.id}/signers/${s.id}/reset`, { method: "POST" }); setExtra((e) => [...e.filter((x) => x.signerId !== s.id), l]); await load(); } catch (err) { onError((err as Error).message); }
  }
  async function remove(r: SignReq) {
    if (!window.confirm(`Supprimer définitivement cette demande et ses preuves (signatures, journal) ?\n\n${r.kind === "convention" ? "Convention" : "Demande de règlement"} · ${r.appName}\n\nCette action est irréversible.`)) return;
    try { await api(`/billing/signature-requests/${r.id}`, { method: "DELETE" }); setOpenId(null); await load(); onNotice("Demande supprimée."); } catch (err) { onError((err as Error).message); }
  }
  const linksFor = (r: SignReq) => [...(fresh && fresh.requestId === r.id ? fresh.links : []), ...extra].filter((l, i, all) => all.findIndex((x) => x.signerId === l.signerId) === i);

  return <div className="stack">
    {fresh && <section className="card" style={{ borderColor: "var(--ok)" }}>
      <h3>À transmettre maintenant</h3>
      <p className="small">Envoyez à chaque signataire son <strong>lien</strong> et son <strong>code</strong> dans deux messages séparés. Ils ne seront plus affichés ensuite (vous pourrez en recréer).</p>
      {fresh.links.map((l) => <div key={l.signerId} className="service">
        <strong>{ROLE[l.role] ?? l.role} : {l.name}</strong>
        <span className="small mono" style={{ overflowWrap: "anywhere" }}>{linkOf(l.token)}</span>
        <span className="small">Code : <strong className="mono">{l.code}</strong></span>
        <div className="row wrap"><button type="button" onClick={() => void copy(linkOf(l.token), "Lien")}>Copier le lien</button><button type="button" onClick={() => void copy(l.code, "Code")}>Copier le code</button></div>
      </div>)}
      <button type="button" className="primary" onClick={onDismissFresh}>J’ai tout transmis</button>
    </section>}

    <section className="card">
      <h3>Signatures ({reqs.length})</h3>
      {reqs.length === 0 ? <p className="muted small">Aucune demande pour le moment. Depuis l’onglet Prestations, ouvrez un dossier et choisissez « Faire signer ».</p> : <div className="stack-small">
        {reqs.map((r) => {
          const st = state(r); const open = openId === r.id; const l = linksFor(r);
          return <div className="service" key={r.id}>
            <button type="button" onClick={() => setOpenId(open ? null : r.id)} style={{ textAlign: "left", width: "100%" }}>
              <strong>{r.kind === "convention" ? "Convention" : "Demande de règlement"} · {r.appName}</strong>
              <span className="small" style={{ display: "block", color: st.color }}>{st.icon === "wait" ? <Hourglass /> : st.icon === "done" ? <CheckMark /> : null}{st.label}</span>
              <span className="muted small" style={{ display: "block" }}>{r.clientName} · créée le {when(r.createdAt)}</span>
            </button>
            {open && <div className="stack-small" style={{ paddingTop: 6 }}>
              {r.signers.map((s) => {
                const lk = l.find((x) => x.signerId === s.id);
                return <div key={s.id} className="stack-small">
                  <span className="small">{s.status === "signed" ? <CheckMark /> : <Circle />}{ROLE[s.role] ?? s.role} : {s.name} — {s.status === "signed" ? `signé le ${when(s.signedAt!)}` : s.status === "waiting" ? "son lien sera disponible après votre signature" : !s.linkIssued ? "lien à générer" : s.locked ? "code bloqué" : s.viewedAt ? "document ouvert, pas encore signé" : "pas encore ouvert"}</span>
                  {lk && s.status !== "signed" && !(fresh && fresh.requestId === r.id) && <span className="small">Lien : <span className="mono" style={{ overflowWrap: "anywhere" }}>{linkOf(lk.token)}</span> · Code : <strong className="mono">{lk.code}</strong></span>}
                  {r.status === "pending" && s.status !== "signed" && <div className="row wrap">
                    {lk && !(fresh && fresh.requestId === r.id) && <><button type="button" onClick={() => void copy(linkOf(lk.token), "Lien")}>Copier le lien</button><button type="button" onClick={() => void copy(lk.code, "Code")}>Copier le code</button></>}
                    {s.status !== "waiting" && <button type="button" className={!s.linkIssued ? "primary" : undefined} onClick={() => void reset(r, s)}>{!s.linkIssued ? `Générer le lien et le code de ${ROLE[s.role] ?? s.role}` : "Nouveau lien et code"}</button>}
                  </div>}
                </div>;
              })}
              <div className="row wrap">
                {r.signers.some((s) => s.status === "signed") && <>
                  <button type="button" className="primary" onClick={() => void view(`/billing/signature-requests/${r.id}/signed.pdf`)}>{r.status === "completed" ? "Voir le PDF signé" : "Voir le document signé à ce jour"}</button>
                  <button type="button" onClick={() => void save(`/billing/signature-requests/${r.id}/signed.pdf`, `${r.kind === "demande" ? "demande_reglement" : "convention_prestation"}${r.status === "completed" ? "_signe" : "_en_cours_de_signature"}.pdf`)}>{r.status === "completed" ? "Télécharger le PDF signé" : "Télécharger (signatures à ce jour)"}</button>
                </>}
                <button type="button" onClick={() => void save(`/billing/signature-requests/${r.id}/original.pdf`, `${r.kind === "demande" ? "demande_reglement" : "convention_prestation"}.pdf`)}>PDF d’origine</button>
                <button type="button" onClick={() => void save(`/billing/signature-requests/${r.id}/proof`, "journal_de_preuve.json")}>Journal de preuve</button>
                {r.status === "pending" && <button type="button" onClick={() => void cancel(r.id)}>Annuler</button>}
                <button type="button" className="danger" onClick={() => void remove(r)}>Supprimer</button>
              </div>
            </div>}
          </div>;
        })}
      </div>}
      <p className="muted small">Signature électronique « simple » : identifie le signataire par un lien et un code, et conserve date, nom, tracé et traces techniques comme preuves (non affichées sur les documents). En cas de litige, c’est le juge qui apprécie.</p>
    </section>
  </div>;
}

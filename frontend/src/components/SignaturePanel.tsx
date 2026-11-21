import { useEffect, useState } from "react";
import { api, apiBlob } from "../lib/api";

type Signer = { id: string; role: string; name: string; status: string; signedAt: string | null; viewedAt: string | null; locked: boolean };
type Req = { id: string; kind: string; title: string; status: string; createdAt: string; expiresAt: string; completedAt: string | null; signers: Signer[] };
type Link = { signerId: string; role: string; name: string; token: string; code: string };
const ROLE: Record<string, string> = { prestataire: "Prestataire", client: "Client" };
const STATUS: Record<string, string> = { pending: "en cours", completed: "signé par tous", cancelled: "annulé" };
const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const linkOf = (token: string) => `${window.location.origin}/signer/${token}`;

/** Signature électronique d'un dossier : liens et codes à transmettre soi-même (aucun e-mail n'est envoyé). */
export function SignaturePanel({ docId, onError, onNotice }: { docId: string; onError: (m: string) => void; onNotice: (m: string) => void }) {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [links, setLinks] = useState<Record<string, Link[]>>({});
  const [open, setOpen] = useState(false);
  const load = () => api<Req[]>(`/billing/service-docs/${docId}/signature-requests`).then(setReqs).catch((e) => onError(e.message));
  useEffect(() => { if (open) void load(); }, [open, docId]);

  async function create(kind: "demande" | "convention") {
    onError("");
    try {
      const r = await api<Req & { links: Link[] }>(`/billing/service-docs/${docId}/signature-requests`, { method: "POST", body: { kind } });
      setLinks((l) => ({ ...l, [r.id]: r.links }));
      await load();
      onNotice("Demande créée. Copie chaque lien et chaque code ci-dessous : ils ne seront plus affichés ensuite.");
    } catch (err) { onError((err as Error).message); }
  }
  async function cancel(id: string) {
    if (!window.confirm("Annuler cette demande de signature ? Les liens ne fonctionneront plus.")) return;
    try { await api(`/billing/signature-requests/${id}/cancel`, { method: "POST" }); await load(); } catch (err) { onError((err as Error).message); }
  }
  async function reset(r: Req, s: Signer) {
    try {
      const l = await api<Link>(`/billing/signature-requests/${r.id}/signers/${s.id}/reset`, { method: "POST" });
      setLinks((all) => ({ ...all, [r.id]: [...(all[r.id] ?? []).filter((x) => x.signerId !== s.id), l] }));
      await load();
    } catch (err) { onError((err as Error).message); }
  }
  async function download(r: Req, which: "signed" | "original") {
    try {
      const blob = await apiBlob(`/billing/signature-requests/${r.id}/${which}.pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${r.kind === "demande" ? "demande_reglement" : "convention_prestation"}${which === "signed" ? "_signe" : ""}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (err) { onError((err as Error).message); }
  }
  const copy = (text: string, label: string) => navigator.clipboard?.writeText(text).then(() => onNotice(`${label} copié.`), () => onError("Copie impossible : sélectionne le texte à la main."));

  return <div className="stack-small" style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
    <button type="button" onClick={() => setOpen(!open)}>{open ? "Masquer la signature électronique" : "Signature électronique"}</button>
    {open && <>
      <p className="muted small">Le document est figé au moment de l’envoi. Chaque signataire reçoit un <strong>lien</strong> et un <strong>code</strong> : transmets-les par deux messages distincts (par exemple le lien par WhatsApp et le code par SMS). Aucun e-mail n’est envoyé par l’application.</p>
      <div className="row wrap"><button type="button" onClick={() => void create("convention")}>Faire signer la convention (vous et le client)</button><button type="button" onClick={() => void create("demande")}>Faire signer la demande (vous)</button></div>
      {reqs.map((r) => <div className="service" key={r.id}>
        <strong>{r.title}</strong>
        <span className="small">{STATUS[r.status] ?? r.status} · créée le {when(r.createdAt)}{r.status === "pending" ? ` · valable jusqu’au ${when(r.expiresAt)}` : ""}{r.completedAt ? ` · terminée le ${when(r.completedAt)}` : ""}</span>
        {r.signers.map((s) => {
          const l = (links[r.id] ?? []).find((x) => x.signerId === s.id);
          return <div key={s.id} className="stack-small" style={{ paddingLeft: 8 }}>
            <span className="small">{s.status === "signed" ? "✓" : "○"} {ROLE[s.role] ?? s.role} : {s.name} — {s.status === "signed" ? `signé le ${when(s.signedAt!)}` : s.locked ? "code bloqué" : s.viewedAt ? "document ouvert" : "pas encore ouvert"}</span>
            {l && s.status !== "signed" && <div className="stack-small" style={{ paddingLeft: 8 }}>
              <span className="small mono" style={{ overflowWrap: "anywhere" }}>{linkOf(l.token)}</span>
              <span className="small">Code : <strong className="mono">{l.code}</strong></span>
              <div className="row wrap"><button type="button" onClick={() => void copy(linkOf(l.token), "Lien")}>Copier le lien</button><button type="button" onClick={() => void copy(l.code, "Code")}>Copier le code</button></div>
            </div>}
            {r.status === "pending" && s.status !== "signed" && <div className="row"><button type="button" onClick={() => void reset(r, s)}>{l ? "Nouveau lien et code" : "Nouveau lien et code (perdu ou bloqué)"}</button></div>}
          </div>;
        })}
        <div className="row wrap">
          {r.status === "completed" && <button type="button" className="primary" onClick={() => void download(r, "signed")}>Télécharger le PDF signé</button>}
          <button type="button" onClick={() => void download(r, "original")}>PDF d’origine</button>
          {r.status === "pending" && <button type="button" className="danger" onClick={() => void cancel(r.id)}>Annuler</button>}
        </div>
      </div>)}
      <p className="muted small">Signature électronique « simple » : elle identifie le signataire par un lien et un code, et conserve date, adresse IP et navigateur comme preuves. Sa force probante est moindre que celle d’une signature qualifiée ; en cas de litige, c’est le juge qui apprécie.</p>
    </>}
  </div>;
}

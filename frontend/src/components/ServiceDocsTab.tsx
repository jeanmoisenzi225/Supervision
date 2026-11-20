import { useEffect, useState, type FormEvent } from "react";
import { api, apiBlob } from "../lib/api";

type ClientRef = { id: string; name: string };
type Doc = {
  id: string; clientId: string; client: ClientRef; reference: string; appName: string; description: string; features: string[]; technologies: string; workNature: string;
  period: string; deliveryState: string; location: string; amount: string | null; currency: string; paymentTerms: string; paymentDue: string; paymentCoordinates: string;
  clientLegalForm: string; clientRepresentative: string; clientRole: string; place: string; emissionDate: string | null; updatedAt: string;
};
const blank = () => ({ clientId: "", reference: "", appName: "", description: "", features: "", technologies: "", workNature: "", period: "", deliveryState: "", location: "", amount: "", currency: "EUR", paymentTerms: "", paymentDue: "", paymentCoordinates: "", clientLegalForm: "", clientRepresentative: "", clientRole: "", place: "", emissionDate: "" });
const money = (v: string | null, c: string) => (v == null ? "montant à compléter" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: c === "XOF" ? "XOF" : "EUR", maximumFractionDigits: c === "XOF" ? 0 : 2 }).format(Number(v)));

/** Dossiers de prestation : une saisie → demande de règlement + convention de constatation des travaux (PDF et Word). */
export function ServiceDocsTab({ clients, profileReady, onNotice, onError }: { clients: ClientRef[]; profileReady: boolean; onNotice: (m: string) => void; onError: (m: string) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const load = () => api<Doc[]>("/billing/service-docs").then(setDocs).catch((e) => onError(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!form.clientId && clients.length) setForm((f) => ({ ...f, clientId: clients[0].id })); }, [clients]);
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault(); onError(""); onNotice("");
    try {
      const body = { ...form, features: form.features.split("\n").map((x) => x.trim()).filter(Boolean), amount: form.amount === "" ? null : Number(form.amount), emissionDate: form.emissionDate || null };
      await api(editing ? `/billing/service-docs/${editing}` : "/billing/service-docs", { method: editing ? "PUT" : "POST", body });
      setForm({ ...blank(), clientId: form.clientId }); setEditing(null); await load();
      onNotice("Dossier enregistré. Télécharge la demande de règlement et la convention depuis la liste.");
    } catch (err) { onError((err as Error).message); }
  }
  function edit(d: Doc) {
    setEditing(d.id);
    setForm({ clientId: d.clientId, reference: d.reference, appName: d.appName, description: d.description, features: d.features.join("\n"), technologies: d.technologies, workNature: d.workNature, period: d.period, deliveryState: d.deliveryState, location: d.location, amount: d.amount == null ? "" : String(Number(d.amount)), currency: d.currency, paymentTerms: d.paymentTerms, paymentDue: d.paymentDue, paymentCoordinates: d.paymentCoordinates, clientLegalForm: d.clientLegalForm, clientRepresentative: d.clientRepresentative, clientRole: d.clientRole, place: d.place, emissionDate: d.emissionDate ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function remove(id: string) {
    if (!window.confirm("Supprimer ce dossier de prestation ?")) return;
    try { await api(`/billing/service-docs/${id}`, { method: "DELETE" }); await load(); } catch (err) { onError((err as Error).message); }
  }
  async function download(d: Doc, kind: "demande" | "convention", format: "pdf" | "docx") {
    onError("");
    try {
      const blob = await apiBlob(`/billing/service-docs/${d.id}/${kind}.${format}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${kind === "demande" ? "demande_reglement" : "convention_prestation"}.${format}`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (err) { onError((err as Error).message); }
  }

  return <div className="grid">
    <section className="card">
      <h3>{editing ? "Modifier le dossier" : "Nouveau dossier de prestation"}</h3>
      <p className="muted small">Une seule saisie produit la <strong>demande de règlement</strong> (ce n’est pas une facture) et la <strong>convention de constatation des travaux</strong>. Ce qui reste vide apparaît en jaune « à compléter » dans les documents : rien n’est inventé.</p>
      {!profileReady && <p className="small" style={{ color: "var(--warn)" }}>Ton identité de prestataire (nom, adresse) n’est pas renseignée : complète-la dans l’onglet Paramètres, rubrique « Prestataire ».</p>}
      <form className="stack-small" onSubmit={save}>
        <label>Client<select required value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="row wrap"><label>Forme juridique du client<input value={form.clientLegalForm} onChange={(e) => set("clientLegalForm", e.target.value)} placeholder="ex. société à responsabilité limitée"/></label><label>Représentant<input value={form.clientRepresentative} onChange={(e) => set("clientRepresentative", e.target.value)}/></label><label>Qualité<input value={form.clientRole} onChange={(e) => set("clientRole", e.target.value)} placeholder="gérant…"/></label></div>
        <label>Nom de l’application<input required value={form.appName} onChange={(e) => set("appName", e.target.value)}/></label>
        <label>Description (finalité, utilisateurs, périmètre)<textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)}/></label>
        <label>Fonctionnalités principales (une par ligne)<textarea rows={4} value={form.features} onChange={(e) => set("features", e.target.value)}/></label>
        <label>Technologies<input value={form.technologies} onChange={(e) => set("technologies", e.target.value)}/></label>
        <label>Nature des travaux<textarea rows={2} value={form.workNature} onChange={(e) => set("workNature", e.target.value)}/></label>
        <div className="row wrap"><label>Période<input value={form.period} onChange={(e) => set("period", e.target.value)} placeholder="de … à …"/></label><label>État de livraison<input value={form.deliveryState} onChange={(e) => set("deliveryState", e.target.value)}/></label></div>
        <label>Adresse de l’application ou du dépôt<input value={form.location} onChange={(e) => set("location", e.target.value)}/></label>
        <div className="row wrap"><label>Montant convenu<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)}/></label><label>Devise<select value={form.currency} onChange={(e) => set("currency", e.target.value)}><option value="EUR">Euro (EUR)</option><option value="XOF">Franc CFA (FCFA)</option></select></label></div>
        <div className="row wrap"><label>Mode de paiement<input value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} placeholder="virement…"/></label><label>Échéance<input value={form.paymentDue} onChange={(e) => set("paymentDue", e.target.value)}/></label></div>
        <label>Coordonnées de paiement (vide = informations de paiement du profil)<textarea rows={2} value={form.paymentCoordinates} onChange={(e) => set("paymentCoordinates", e.target.value)}/></label>
        <div className="row wrap"><label>Référence<input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="DR-2026-001"/></label><label>Lieu<input value={form.place} onChange={(e) => set("place", e.target.value)}/></label><label>Date d’émission (vide = jour du téléchargement)<input type="date" value={form.emissionDate} onChange={(e) => set("emissionDate", e.target.value)}/></label></div>
        <div className="row"><button className="primary" type="submit" disabled={!form.clientId || !form.appName.trim()}>Enregistrer</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm({ ...blank(), clientId: form.clientId }); }}>Annuler</button>}</div>
      </form>
    </section>
    <section className="card">
      <h3>Dossiers ({docs.length})</h3>
      {clients.length === 0 && <p className="muted small">Crée d’abord un client dans l’onglet Clients.</p>}
      {docs.length === 0 ? <p className="muted small">Aucun dossier pour le moment.</p> : docs.map((d) => <div className="service" key={d.id}>
        <strong>{d.appName}</strong>
        <span className="muted small">{d.client.name} · {money(d.amount, d.currency)}{d.reference ? ` · ${d.reference}` : ""}</span>
        <div className="row wrap"><span className="small">Demande de règlement</span><button onClick={() => void download(d, "demande", "pdf")}>PDF</button><button onClick={() => void download(d, "demande", "docx")}>Word</button></div>
        <div className="row wrap"><span className="small">Convention</span><button onClick={() => void download(d, "convention", "pdf")}>PDF</button><button onClick={() => void download(d, "convention", "docx")}>Word</button></div>
        <div className="row"><button onClick={() => edit(d)}>Modifier</button><button className="danger" onClick={() => void remove(d.id)}>Supprimer</button></div>
      </div>)}
      <p className="small" style={{ color: "var(--warn)" }}><strong>À valider avant signature ou paiement.</strong> La convention comporte des points « ⚠ Validation » (fiscalité France et Côte d’Ivoire, droits d’auteur, loi applicable) : un regard professionnel est recommandé sur ces points.</p>
    </section>
  </div>;
}

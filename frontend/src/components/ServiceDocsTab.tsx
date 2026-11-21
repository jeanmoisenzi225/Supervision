import { useEffect, useState, type FormEvent } from "react";
import { api, apiBlob } from "../lib/api";

type ClientRef = { id: string; name: string };
type Doc = {
  id: string; clientId: string; client: ClientRef; reference: string; appName: string; description: string; features: string[]; technologies: string; workNature: string;
  period: string; deliveryState: string; location: string; amount: string | null; currency: string; paymentTerms: string; paymentDue: string; paymentCoordinates: string;
  clientLegalForm: string; clientRepresentative: string; clientRole: string; place: string; emissionDate: string | null; updatedAt: string;
  lines?: DocLine[];
  terms?: Partial<Terms>;
};
type Terms = { law: string; jurisdiction: string; rights: string; exclusivity: string; territory: string; duration: string; cessionFee: string; penaltyRate: string; bankFees: string; sourceCode: string };
const blankTerms = (): Terms => ({ law: "", jurisdiction: "", rights: "licence", exclusivity: "non exclusive", territory: "", duration: "", cessionFee: "", penaltyRate: "", bankFees: "", sourceCode: "" });
type DocLine = { description: string; quantity: number; unitPrice: number };
type ForecastResponse = { lines: Array<DocLine & { source?: string }>; skippedFree: number; warnings: string[]; apps: string[]; missingApps: string[]; pricesAsOf: string; rate?: number; rateInfo?: string };
const blank = () => ({ clientId: "", reference: "", appName: "", description: "", features: "", technologies: "", workNature: "", period: "", deliveryState: "", location: "", amount: "", currency: "EUR", paymentTerms: "", paymentDue: "", paymentCoordinates: "", clientLegalForm: "", clientRepresentative: "", clientRole: "", place: "", emissionDate: "" });
const money = (v: string | null, c: string) => (v == null ? "montant à compléter" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: c === "XOF" ? "XOF" : "EUR", maximumFractionDigits: c === "XOF" ? 0 : 2 }).format(Number(v)));

/** Dossiers de prestation : une saisie → demande de règlement + convention de constatation des travaux (PDF et Word). */
export function ServiceDocsTab({ clients, profileReady, onNotice, onError, onSignCreated }: { clients: ClientRef[]; profileReady: boolean; onNotice: (m: string) => void; onError: (m: string) => void; onSignCreated: (fresh: { requestId: string; links: { signerId: string; role: string; name: string; token: string; code: string }[] }) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [lines, setLines] = useState<DocLine[]>([]);
  const [terms, setTerms] = useState<Terms>(blankTerms());
  const setTerm = (k: keyof Terms, v: string) => setTerms((t) => ({ ...t, [k]: v }));
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const prec = form.currency === "XOF" ? 0 : 2;
  const total = Math.round(lines.reduce((t, l) => t + Math.round(l.quantity * l.unitPrice * 10 ** prec) / 10 ** prec, 0) * 10 ** prec) / 10 ** prec;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: form.currency === "XOF" ? "XOF" : "EUR", maximumFractionDigits: form.currency === "XOF" ? 0 : 2 }).format(n);
  const load = () => api<Doc[]>("/billing/service-docs").then(setDocs).catch((e) => onError(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!form.clientId && clients.length) setForm((f) => ({ ...f, clientId: clients[0].id })); }, [clients]);
  /** Nouveau dossier : les coûts du client sont repris tout de suite, et suivent la devise choisie. */
  useEffect(() => { if (!editing && form.clientId) void importCosts(form.currency, form.clientId); }, [form.clientId, form.currency, editing]);
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault(); onError(""); onNotice("");
    try {
      const body = { ...form, features: form.features.split("\n").map((x) => x.trim()).filter(Boolean), amount: form.amount === "" ? null : Number(form.amount), emissionDate: form.emissionDate || null, lines: lines.filter((l) => l.description.trim()), terms };
      await api(editing ? `/billing/service-docs/${editing}` : "/billing/service-docs", { method: editing ? "PUT" : "POST", body });
      setForm({ ...blank(), clientId: form.clientId }); setLines([]); setTerms(blankTerms()); setImportMsg(null); setEditing(null); await load();
      onNotice("Dossier enregistré. Télécharge la demande de règlement et la convention depuis la liste.");
    } catch (err) { onError((err as Error).message); }
  }
  function edit(d: Doc) {
    setEditing(d.id); setTerms({ ...blankTerms(), ...(d.terms ?? {}) }); setLines((d.lines ?? []).map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }))); setImportMsg(null);
    setForm({ clientId: d.clientId, reference: d.reference, appName: d.appName, description: d.description, features: d.features.join("\n"), technologies: d.technologies, workNature: d.workNature, period: d.period, deliveryState: d.deliveryState, location: d.location, amount: d.amount == null ? "" : String(Number(d.amount)), currency: d.currency, paymentTerms: d.paymentTerms, paymentDue: d.paymentDue, paymentCoordinates: d.paymentCoordinates, clientLegalForm: d.clientLegalForm, clientRepresentative: d.clientRepresentative, clientRole: d.clientRole, place: d.place, emissionDate: d.emissionDate ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  /** Reprend, tels quels, les composants et coûts des applis du client (comme la facture prévisionnelle). */
  async function importCosts(currency = form.currency, clientId = form.clientId) {
    setImportMsg(null);
    try {
      const r = await api<ForecastResponse>("/billing/forecast-lines", { method: "POST", body: { clientId, currency, date: form.emissionDate || undefined, includeClaude: true } });
      const kept = lines.filter((l) => !r.lines.some((n) => n.description === l.description));
      setLines([...r.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })), ...kept]);
      setImportMsg(r.lines.length === 0
        ? { ok: false, text: `Aucune ligne à importer pour ${r.apps.join(", ") || "ce client"} : ${r.skippedFree ? `${r.skippedFree} poste(s) gratuit(s) non repris. ` : "aucun coût trouvé. "}Rattache les applis au client (onglet Clients › Modifier).` }
        : { ok: true, text: `${r.lines.length} ligne(s) importée(s) pour ${r.apps.join(", ")} (tarifs Render du ${new Date(r.pricesAsOf).toLocaleDateString("fr-FR")}${r.rateInfo ? `, taux : ${r.rateInfo}` : ""}). Modifiables ligne par ligne.${r.warnings.length ? " " + r.warnings.join(" ") : ""}` });
    } catch (err) { setImportMsg({ ok: false, text: (err as Error).message }); }
  }
  /** Crée la demande puis passe à l'onglet Signatures, où les liens sont à transmettre. */
  async function requestSignature(d: Doc, kind: "demande" | "convention") {
    onError(""); onNotice("");
    try {
      const r = await api<{ id: string; links: { signerId: string; role: string; name: string; token: string; code: string }[] }>(`/billing/service-docs/${d.id}/signature-requests`, { method: "POST", body: { kind } });
      onSignCreated({ requestId: r.id, links: r.links });
    } catch (err) { onError((err as Error).message); }
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
      <p className="muted small">Une seule saisie produit la <strong>demande de règlement</strong> (ce n’est pas une facture) et la <strong>convention de constatation des travaux</strong>. Les documents sont finaux : ce qui n’est pas renseigné n’y apparaît tout simplement pas, et rien n’est inventé.</p>
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
        <fieldset className="stack-small"><legend className="small">Composants et coûts de l’application (facultatif)</legend>
          <p className="muted small">Reprend les coûts d’hébergement et d’IA des applis rattachées au client (onglet Clients), comme pour la facture prévisionnelle. Le détail s’affiche dans les deux documents.</p>
          <div className="row wrap"><button type="button" onClick={() => void importCosts()} disabled={!form.clientId}>Importer les coûts des applis du client</button><button type="button" onClick={() => setLines([...lines, { description: "", quantity: 1, unitPrice: 0 }])}>+ Ligne libre</button></div>
          {importMsg && <p className="small" style={{ color: importMsg.ok ? "var(--ok)" : "var(--warn)" }}>{importMsg.text}</p>}
          {lines.map((l, i) => <div className="row wrap" key={i}>
            <input style={{ flex: "2 1 200px" }} aria-label={`Intitulé ${i + 1}`} value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Intitulé du composant"/>
            <input style={{ width: 70 }} aria-label={`Quantité ${i + 1}`} type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))}/>
            <input style={{ width: 110 }} aria-label={`Prix unitaire ${i + 1}`} type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitPrice: Number(e.target.value) } : x)))}/>
            <button type="button" className="danger" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
          </div>)}
          {lines.length > 0 && <div className="row wrap"><strong>Total du détail : {fmt(total)}</strong>{form.amount !== "" && Number(form.amount) !== total && <button type="button" onClick={() => set("amount", "")}>Revenir au total du détail</button>}</div>}
        </fieldset>
        <div className="row wrap"><label>Montant convenu (vide = total du détail{lines.length ? ` : ${fmt(total)}` : ""})<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder={lines.length ? String(total) : ""}/></label><label>Devise<select value={form.currency} onChange={(e) => { set("currency", e.target.value); if (editing && lines.length) void importCosts(e.target.value); }}><option value="EUR">Euro (EUR)</option><option value="XOF">Franc CFA (FCFA)</option></select></label></div>
        <div className="row wrap"><label>Mode de paiement<input value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} placeholder="virement…"/></label><label>Échéance<input value={form.paymentDue} onChange={(e) => set("paymentDue", e.target.value)}/></label></div>
        <label>Coordonnées de paiement (vide = informations de paiement du profil)<textarea rows={2} value={form.paymentCoordinates} onChange={(e) => set("paymentCoordinates", e.target.value)}/></label>
        <div className="row wrap"><label>Référence<input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="DR-2026-001"/></label><label>Lieu<input value={form.place} onChange={(e) => set("place", e.target.value)}/></label><label>Date d’émission (vide = jour du téléchargement)<input type="date" value={form.emissionDate} onChange={(e) => set("emissionDate", e.target.value)}/></label></div>
        <fieldset className="stack-small"><legend className="small">Convention : clauses</legend>
          <p className="muted small">Rien n’est laissé en blanc dans les documents. La loi applicable et la juridiction sont nécessaires pour produire la convention ; le reste a une valeur par défaut ou disparaît s’il est vide.</p>
          <div className="row wrap"><label>Loi applicable<select value={terms.law} onChange={(e) => setTerm("law", e.target.value)}><option value="">— à choisir —</option><option value="française">Droit français</option><option value="ivoirienne">Droit ivoirien</option></select></label><label>Juridiction compétente<input value={terms.jurisdiction} onChange={(e) => setTerm("jurisdiction", e.target.value)} placeholder="ex. tribunaux d’Abidjan"/></label></div>
          <div className="row wrap"><label>Droits sur l’application<select value={terms.rights} onChange={(e) => setTerm("rights", e.target.value)}><option value="licence">Licence d’exploitation (le prestataire garde les droits)</option><option value="cession">Cession de droits</option></select></label><label>Exclusivité<select value={terms.exclusivity} onChange={(e) => setTerm("exclusivity", e.target.value)}><option value="non exclusive">Non exclusive</option><option value="exclusive">Exclusive</option></select></label></div>
          <div className="row wrap"><label>Territoire (vide = Côte d’Ivoire)<input value={terms.territory} onChange={(e) => setTerm("territory", e.target.value)}/></label><label>Durée (vide = durée d’exploitation)<input value={terms.duration} onChange={(e) => setTerm("duration", e.target.value)}/></label></div>
          {terms.rights === "cession" && <label>Rémunération de la cession (obligatoire)<input value={terms.cessionFee} onChange={(e) => setTerm("cessionFee", e.target.value)} placeholder="ex. 500 € forfaitaire"/></label>}
          <div className="row wrap"><label>Pénalités de retard (vide = aucune)<input value={terms.penaltyRate} onChange={(e) => setTerm("penaltyRate", e.target.value)} placeholder="ex. 3 % par mois"/></label><label>Frais bancaires à la charge de (vide = non précisé)<input value={terms.bankFees} onChange={(e) => setTerm("bankFees", e.target.value)} placeholder="le client"/></label></div>
          <label>Code source<select value={terms.sourceCode} onChange={(e) => setTerm("sourceCode", e.target.value)}><option value="">Non mentionné</option><option value="oui">Remise du code source comprise</option></select></label>
        </fieldset>
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
        <div className="row wrap"><span className="small">Signature</span><button onClick={() => void requestSignature(d, "convention")}>Convention : vous + client</button><button onClick={() => void requestSignature(d, "demande")}>Demande : vous</button></div>
        <div className="row"><button onClick={() => edit(d)}>Modifier</button><button className="danger" onClick={() => void remove(d.id)}>Supprimer</button></div>
      </div>)}
      <p className="small muted"><strong>Avant signature ou paiement</strong> : fiscalité (France et Côte d’Ivoire), droits d’auteur, loi applicable et juridiction méritent un regard professionnel.</p>
    </section>
  </div>;
}

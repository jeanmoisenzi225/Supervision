import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../lib/api";

type Client = { id: string; kind: string; name: string; email: string | null; phone: string | null; billingAddress: string | null; postalCode: string | null; city: string | null; country: string; rccm: string | null; ncc: string | null; vatNumber: string | null };
type Line = { description: string; quantity: number; unitPrice: number; discountPercent: number; vatRate: number };
type Invoice = { id: string; currency: string; number: string | null; status: string; clientId: string; client: Client; createdAt: string; issueDate: string | null; serviceDate: string | null; dueDate: string | null; notes: string | null; subtotal: string; vatTotal: string; total: string; lines: Array<Line & { id: string; subtotal: string; vatAmount: string; total: string }> };
type Profile = { brandName: string; contactEmail: string; phone: string; website: string; paymentDetails: string; country?: string; legalName?: string; legalForm?: string; businessAddress?: string; rccm?: string; ncc?: string; taxRegime?: string; vatRegime?: string; defaultCurrency?: string };
const blankClient = () => ({ kind: "company", name: "", email: "", phone: "", billingAddress: "", postalCode: "", city: "", country: "Côte d’Ivoire", rccm: "", ncc: "", vatNumber: "" });
const blankLine = (): Line => ({ description: "", quantity: 1, unitPrice: 0, discountPercent: 0, vatRate: 0 });
const money = (v: string | number, currency = "XOF") => new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: currency === "XOF" ? 0 : 2 }).format(Number(v || 0));

export function BillingPage() {
  const [tab, setTab] = useState("invoices");
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [profile, setProfile] = useState<Profile>({ brandName: "NJMDev", contactEmail: "", phone: "", website: "", paymentDetails: "" });
  const [client, setClient] = useState(blankClient());
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceDate, setServiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [c, i, p] = await Promise.all([api<Client[]>("/billing/clients"), api<Invoice[]>("/billing/invoices"), api<Profile>("/billing/profile")]);
    setClients(c); setInvoices(i); setProfile(p);
    if (!clientId && c.length) setClientId(c[0].id);
  }
  useEffect(() => { void refresh().catch((e) => setError(e.message)); }, []);

  const totals = useMemo(() => {
    const factor = currency === "XOF" ? 1 : 100;
    return lines.reduce((a, l) => {
      const base = Math.round(l.quantity * l.unitPrice * (1 - l.discountPercent / 100) * factor) / factor;
      a.ht += base; a.vat += Math.round(base * l.vatRate * factor / 100) / factor; return a;
    }, { ht: 0, vat: 0 });
  }, [lines, currency]);

  function newDraft() {
    setEditingInvoice(null); setLines([blankLine()]); setNotes(""); setCurrency(profile.defaultCurrency || "XOF"); setServiceDate(""); setDueDate("");
    setIssueDate(new Date().toISOString().slice(0, 10)); setTab("new");
  }
  async function saveClient(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try {
      const saved = await api<Client>(editingClient ? `/billing/clients/${editingClient}` : "/billing/clients", { method: editingClient ? "PUT" : "POST", body: client });
      setClient(blankClient()); setEditingClient(null); await refresh(); setClientId(saved.id); setNotice("Client enregistré.");
    } catch (err) { setError((err as Error).message); }
  }
  function startClientEdit(c: Client) {
    setEditingClient(c.id); setClient({ kind: c.kind, name: c.name, email: c.email ?? "", phone: c.phone ?? "", billingAddress: c.billingAddress ?? "", postalCode: c.postalCode ?? "", city: c.city ?? "", country: c.country, rccm: c.rccm ?? "", ncc: c.ncc ?? "", vatNumber: c.vatNumber ?? "" }); setTab("clients");
  }
  async function saveDraft(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try {
      const body = { clientId, currency, issueDate: issueDate || null, serviceDate: serviceDate || null, dueDate: dueDate || null, notes, lines };
      await api(editingInvoice ? `/billing/invoices/${editingInvoice}` : "/billing/invoices", { method: editingInvoice ? "PUT" : "POST", body });
      await refresh(); setNotice("Brouillon enregistré. Aucun numéro officiel attribué."); setTab("invoices"); setEditingInvoice(null);
    } catch (err) { setError((err as Error).message); }
  }
  async function editDraft(i: Invoice) {
    setEditingInvoice(i.id); setClientId(i.clientId); setCurrency(i.currency || "XOF"); setIssueDate(i.issueDate?.slice(0, 10) ?? "");
    setServiceDate(i.serviceDate?.slice(0, 10) ?? ""); setDueDate(i.dueDate?.slice(0, 10) ?? ""); setNotes(i.notes ?? "");
    setLines(i.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPercent: Number(l.discountPercent), vatRate: Number(l.vatRate) })));
    setTab("new");
  }
  async function archiveClient(id: string) {
    if (!window.confirm("Archiver ce client ? Les documents existants seront conservés.")) return;
    try { await api(`/billing/clients/${id}/archive`, { method: "POST" }); await refresh(); }
    catch (err) { setError((err as Error).message); }
  }
  async function removeDraft(id: string) {
    if (!window.confirm("Supprimer ce brouillon ?")) return;
    try { await api(`/billing/invoices/${id}`, { method: "DELETE" }); await refresh(); }
    catch (err) { setError((err as Error).message); }
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    try { await api("/billing/profile", { method: "PUT", body: profile }); setNotice("Paramètres commerciaux enregistrés."); }
    catch (err) { setError((err as Error).message); }
  }

  return <>
    <div className="page-head"><div><h1>Facturation NJMDev</h1><p className="muted small">Répertoire clients et préparation des factures.</p></div><button className="primary" onClick={newDraft}>+ Nouveau brouillon</button></div>
    <div className="banner banner-bad"><div><strong>Émission officielle désactivée</strong><span>La structure juridique et le régime de TVA ne sont pas encore configurés. Aucun numéro de facture ne sera attribué.</span></div></div>
    {notice && <p className="success small">{notice}</p>}{error && <p className="error small">{error}</p>}
    <div className="tabs">
      {([["invoices", `Brouillons (${invoices.length})`], ["clients", `Clients (${clients.length})`], ["new", "Saisie"], ["settings", "Paramètres"]] as const).map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    {tab === "invoices" && <section className="card"><h3>Brouillons</h3>{invoices.length === 0 ? <p className="muted small">Aucun brouillon enregistré.</p> : <div className="table-scroll"><table className="table"><thead><tr><td>Référence</td><td>Client</td><td>Date</td><td className="num">Total TTC estimé</td><td>Actions</td></tr></thead><tbody>{invoices.map((i) => <tr key={i.id}><td><strong>BROUILLON</strong><br/><span className="muted small">{i.id.slice(-8).toUpperCase()}</span></td><td>{i.client.name}</td><td>{new Date(i.createdAt).toLocaleDateString("fr-FR")}</td><td className="num">{money(i.total, i.currency)}</td><td><div className="row wrap"><button onClick={() => void editDraft(i)}>Modifier</button><button className="danger" onClick={() => void removeDraft(i.id)}>Supprimer</button></div></td></tr>)}</tbody></table></div>}</section>}
    {tab === "clients" && <div className="grid">
      <section className="card"><h3>{editingClient ? "Modifier le client" : "Nouveau client"}</h3><form className="stack-small" onSubmit={saveClient}>
        <label>Type<select value={client.kind} onChange={(e) => setClient({ ...client, kind: e.target.value })}><option value="company">Entreprise</option><option value="individual">Particulier</option></select></label>
        <label>Nom / raison sociale<input required value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })}/></label>
        <label>E-mail<input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })}/></label>
        <label>Téléphone<input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })}/></label>
        <label>Adresse<input value={client.billingAddress} onChange={(e) => setClient({ ...client, billingAddress: e.target.value })}/></label>
        <div className="row wrap"><label>Code postal<input value={client.postalCode} onChange={(e) => setClient({ ...client, postalCode: e.target.value })}/></label><label>Ville<input value={client.city} onChange={(e) => setClient({ ...client, city: e.target.value })}/></label></div>
        <label>Pays<input value={client.country} onChange={(e) => setClient({ ...client, country: e.target.value })}/></label>
        <label>RCCM (si applicable)<input value={client.rccm} onChange={(e) => setClient({ ...client, rccm: e.target.value })}/></label>
        <label>NCC (si applicable)<input value={client.ncc} onChange={(e) => setClient({ ...client, ncc: e.target.value })}/></label>
        <label>N° TVA<input value={client.vatNumber} onChange={(e) => setClient({ ...client, vatNumber: e.target.value })}/></label>
        <div className="row"><button className="primary" type="submit">Enregistrer</button>{editingClient && <button type="button" onClick={() => { setEditingClient(null); setClient(blankClient()); }}>Annuler</button>}</div>
      </form></section>
      <section className="card"><h3>Répertoire</h3>{clients.length === 0 ? <p className="muted small">Aucun client pour le moment.</p> : clients.map((c) => <div className="service" key={c.id}><strong>{c.name}</strong><span className="muted small">{[c.email, c.city, c.country].filter(Boolean).join(" · ")}</span><div className="row"><button onClick={() => startClientEdit(c)}>Modifier</button><button onClick={() => void archiveClient(c.id)}>Archiver</button></div></div>)}</section>
    </div>}
    {tab === "new" && <form className="stack" onSubmit={saveDraft}>
      <section className="card"><h3>{editingInvoice ? "Modifier le brouillon" : "Créer un brouillon"}</h3>
        <label>Client<select required value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Sélectionner un client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {clients.length === 0 && <p className="muted small">Crée d'abord une fiche client.</p>}
        <label>Devise<select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="XOF">FCFA (XOF)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar US (USD)</option></select></label>
        <div className="row wrap"><label>Date du document<input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}/></label><label>Date de prestation<input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)}/></label><label>Échéance souhaitée<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}/></label></div>
      </section>
      <section className="card"><div className="page-head"><h3>Prestations</h3><button type="button" onClick={() => setLines([...lines, blankLine()])}>+ Ajouter une ligne</button></div>
        {lines.map((l, n) => <div className="invoice-line" key={n}>
          <label className="line-description">Description<input required value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, description: e.target.value } : x))}/></label>
          <label>Qté<input type="number" min="0.001" step="0.001" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, quantity: Number(e.target.value) } : x))}/></label>
          <label>Prix HT<input type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, unitPrice: Number(e.target.value) } : x))}/></label>
          <label>Remise %<input type="number" min="0" max="100" step="0.01" value={l.discountPercent} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, discountPercent: Number(e.target.value) } : x))}/></label>
          <label>TVA %<input type="number" min="0" max="100" step="0.01" value={l.vatRate} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, vatRate: Number(e.target.value) } : x))}/></label>
          {lines.length > 1 && <button type="button" className="danger" onClick={() => setLines(lines.filter((_, j) => j !== n))}>Retirer</button>}
        </div>)}
      </section>
      <section className="card"><h3>Notes internes</h3><label>Notes<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}/></label>
        <div className="metrics"><div className="metric"><span className="muted small">HT estimé</span><strong className="metric-value">{money(totals.ht, currency)}</strong></div><div className="metric"><span className="muted small">TVA estimée</span><strong className="metric-value">{money(totals.vat, currency)}</strong></div><div className="metric"><span className="muted small">TTC estimé</span><strong className="metric-value">{money(totals.ht + totals.vat, currency)}</strong></div></div>
        <p className="muted small">Le serveur recalcule les montants avec des décimales exactes. Ce document reste un brouillon sans valeur de facture émise.</p>
        <div className="row wrap"><button className="primary" type="submit" disabled={!clientId || lines.some((l) => !l.description.trim() || l.quantity <= 0)}>Enregistrer le brouillon</button><button type="button" onClick={() => setTab("invoices")}>Annuler</button></div>
      </section>
    </form>}
    {tab === "settings" && <section className="card"><h3>Identité commerciale</h3><p className="muted small">Informations de marque uniquement, indépendantes de la future identité juridique.</p><form className="stack-small" onSubmit={saveProfile}>
      <label>Nom commercial<input value={profile.brandName} onChange={(e) => setProfile({ ...profile, brandName: e.target.value })}/></label>
      <label>E-mail<input type="email" value={profile.contactEmail} onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}/></label>
      <label>Téléphone<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}/></label>
      <label>Site internet<input value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })}/></label>
      <label>Informations de paiement<textarea rows={3} value={profile.paymentDetails} onChange={(e) => setProfile({ ...profile, paymentDetails: e.target.value })}/></label>
      <h3>Identité légale (à compléter après immatriculation)</h3>
      <label>Nom et prénoms de l’exploitant<input value={profile.legalName ?? ""} onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}/></label>
      <label>Adresse professionnelle en Côte d’Ivoire<input value={profile.businessAddress ?? ""} onChange={(e) => setProfile({ ...profile, businessAddress: e.target.value })}/></label>
      <div className="row wrap"><label>RCCM<input value={profile.rccm ?? ""} onChange={(e) => setProfile({ ...profile, rccm: e.target.value })}/></label><label>NCC<input value={profile.ncc ?? ""} onChange={(e) => setProfile({ ...profile, ncc: e.target.value })}/></label></div>
      <label>Régime fiscal (à confirmer)<input value={profile.taxRegime ?? ""} onChange={(e) => setProfile({ ...profile, taxRegime: e.target.value })}/></label>
      <label>Régime de TVA (à confirmer)<input value={profile.vatRegime ?? ""} onChange={(e) => setProfile({ ...profile, vatRegime: e.target.value })}/></label>
      <label>Devise par défaut<select value={profile.defaultCurrency ?? "XOF"} onChange={(e) => setProfile({ ...profile, defaultCurrency: e.target.value })}><option value="XOF">FCFA (XOF)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar US (USD)</option></select></label>
      <button className="primary" type="submit">Enregistrer</button>
    </form><div className="banner banner-bad"><div><strong>Émission officielle désactivée</strong><span>Le profil légal et le régime fiscal ivoiriens doivent être vérifiés. L’émission FNE ne sera activée qu’après validation du parcours DGI applicable.</span></div></div></section>}
  </>;
}

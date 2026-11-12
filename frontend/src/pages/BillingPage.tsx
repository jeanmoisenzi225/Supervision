import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, apiBlob } from "../lib/api";
import { InvoicePreview, type InvoicePreviewData } from "../components/InvoicePreview";

type Client = { id: string; kind: string; name: string; email: string | null; phone: string | null; billingAddress: string | null; postalCode: string | null; city: string | null; country: string; rccm: string | null; ncc: string | null; vatNumber: string | null; appKeys?: string[] };
/** `usd` : montant d'origine en dollars d'une ligne importée des coûts ; la ligne se recalcule quand le taux change, tant qu'on ne modifie pas son prix à la main. */
type Line = { description: string; quantity: number; unitPrice: number; discountPercent: number; vatRate: number; source?: string | null; usd?: number | null };
type Fx = { currency: string; rate: number; date: string | null; source: string; mode?: string };
type ForecastResponse = { rate?: number; rateInfo?: string; lines: Line[]; skippedFree: number; warnings: string[]; apps: string[]; missingApps: string[]; pricesAsOf: string };
type AppRef = { key: string; name: string };
type Invoice = { id: string; currency: string; kind?: string; period?: string | null; usdRate?: string | null; number: string | null; status: string; clientId: string; client: Client; createdAt: string; issueDate: string | null; serviceDate: string | null; dueDate: string | null; notes: string | null; subtotal: string; vatTotal: string; total: string; lines: Array<Line & { id: string; subtotal: string; vatAmount: string; total: string }> };
type Profile = { brandName: string; contactEmail: string; phone: string; website: string; paymentDetails: string; country?: string; legalName?: string; legalForm?: string; businessAddress?: string; rccm?: string; ncc?: string; taxRegime?: string; vatRegime?: string; defaultCurrency?: string; fxMode?: string };
const blankClient = () => ({ kind: "company", name: "", email: "", phone: "", billingAddress: "", postalCode: "", city: "", country: "Côte d’Ivoire", rccm: "", ncc: "", vatNumber: "", appKeys: [] as string[] });
const currentMonth = () => new Date().toISOString().slice(0, 7);
const FREE_LINES = ["Développement et évolutions", "Main d'œuvre", "Messagerie e-mail", "Support et maintenance"];
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
  const [previewDoc, setPreviewDoc] = useState<InvoicePreviewData | null>(null);
  const [catalog, setCatalog] = useState<AppRef[]>([]);
  const [kind, setKind] = useState("forecast");
  const [period, setPeriod] = useState(currentMonth());
  const [usdRate, setUsdRate] = useState("");
  /** Taux de change du marché (BCE) pour la devise et la date du document ; le champ « taux » le reprend tant qu'on ne l'a pas modifié. */
  const [fx, setFx] = useState<Fx | null>(null);
  const [fxError, setFxError] = useState("");
  const [rateAuto, setRateAuto] = useState(true);
  const rateAutoRef = useRef(true);
  rateAutoRef.current = rateAuto;
  const [includeClaude, setIncludeClaude] = useState(true);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  /** Résultat de l'import, affiché à côté du bouton (le bandeau du haut de page est hors de vue sur téléphone). */
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    const [c, i, p] = await Promise.all([api<Client[]>("/billing/clients"), api<Invoice[]>("/billing/invoices"), api<Profile>("/billing/profile")]);
    setClients(c); setInvoices(i); setProfile(p);
    api<{ apps: AppRef[] }>("/overview").then((o) => setCatalog(o.apps.map((a) => ({ key: a.key, name: a.name })))).catch(() => undefined);
    if (!clientId && c.length) setClientId(c[0].id);
  }
  useEffect(() => { void refresh().catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    setFx(null); setFxError("");
    if (tab !== "new" || currency === "USD") return;
    let stale = false;
    api<Fx>(`/billing/fx?currency=${currency}${issueDate ? `&date=${issueDate}` : ""}`)
      .then((r) => { if (stale) return; setFx(r); if (rateAutoRef.current) setUsdRate(String(r.rate)); })
      .catch((e) => { if (!stale) setFxError((e as Error).message); });
    return () => { stale = true; };
  }, [tab, currency, issueDate, profile.fxMode]);
  /** Les lignes importées des coûts suivent le taux : si on le change, leurs prix sont recalculés (le total en bas suit). */
  useEffect(() => {
    const rate = currency === "USD" ? 1 : Number(usdRate);
    if (!(rate > 0)) return;
    const factor = currency === "XOF" ? 1 : 100;
    setLines((ls) => {
      let changed = false;
      const next = ls.map((l) => {
        if (l.usd == null || (l.source !== "hosting" && l.source !== "claude")) return l;
        const price = Math.round(l.usd * rate * factor) / factor;
        if (price === l.unitPrice) return l;
        changed = true;
        return { ...l, unitPrice: price };
      });
      return changed ? next : ls;
    });
  }, [usdRate, currency]);

  const totals = useMemo(() => {
    const factor = currency === "XOF" ? 1 : 100;
    return lines.reduce((a, l) => {
      const base = Math.round(l.quantity * l.unitPrice * (1 - l.discountPercent / 100) * factor) / factor;
      a.ht += base; a.vat += Math.round(base * l.vatRate * factor / 100) / factor; return a;
    }, { ht: 0, vat: 0 });
  }, [lines, currency]);

  function newDraft() {
    setEditingInvoice(null); setLines([blankLine()]); setNotes(""); setCurrency(profile.defaultCurrency || "XOF"); setServiceDate(""); setDueDate(""); setKind("forecast"); setPeriod(currentMonth()); setImportWarnings([]); setImportMsg(null); setRateAuto(true); setUsdRate("");
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
    setEditingClient(c.id); setClient({ kind: c.kind, name: c.name, email: c.email ?? "", phone: c.phone ?? "", billingAddress: c.billingAddress ?? "", postalCode: c.postalCode ?? "", city: c.city ?? "", country: c.country, rccm: c.rccm ?? "", ncc: c.ncc ?? "", vatNumber: c.vatNumber ?? "", appKeys: c.appKeys ?? [] }); setTab("clients");
  }
  async function saveDraft(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try {
      const body = { clientId, currency, kind, period: period || null, usdRate: currency !== "USD" && usdRate ? Number(usdRate) : null, issueDate: issueDate || null, serviceDate: serviceDate || null, dueDate: dueDate || null, notes, lines };
      await api(editingInvoice ? `/billing/invoices/${editingInvoice}` : "/billing/invoices", { method: editingInvoice ? "PUT" : "POST", body });
      await refresh(); setNotice(kind === "forecast" ? "Facture prévisionnelle enregistrée. Aucun numéro officiel attribué." : "Brouillon enregistré. Aucun numéro officiel attribué."); setTab("invoices"); setEditingInvoice(null);
    } catch (err) { setError((err as Error).message); }
  }
  async function editDraft(i: Invoice) {
    setEditingInvoice(i.id); setClientId(i.clientId); setCurrency(i.currency || "XOF"); setIssueDate(i.issueDate?.slice(0, 10) ?? "");
    setKind(i.kind ?? "forecast"); setPeriod(i.period ?? currentMonth()); setUsdRate(i.usdRate ? String(Number(i.usdRate)) : ""); setRateAuto(!i.usdRate); setImportWarnings([]);
    setServiceDate(i.serviceDate?.slice(0, 10) ?? ""); setDueDate(i.dueDate?.slice(0, 10) ?? ""); setNotes(i.notes ?? "");
    setLines(i.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPercent: Number(l.discountPercent), vatRate: Number(l.vatRate), source: (l as Line).source ?? null, usd: (l as { usdAmount?: string | null }).usdAmount == null ? null : Number((l as { usdAmount?: string | null }).usdAmount) })));
    setTab("new");
  }
  async function downloadPdf(invoice: Invoice) {
    setError(""); setNotice("");
    try {
      const blob = await apiBlob(`/billing/invoices/${invoice.id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `NJMDev-${invoice.kind === "draft" ? "brouillon" : "previsionnelle"}-${invoice.id.slice(-8).toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      setNotice("PDF généré. Aucun fichier n'est archivé sur le serveur.");
    } catch (err) { setError((err as Error).message); }
  }

  async function archiveClient(id: string) {
    if (!window.confirm("Archiver ce client ? Les documents existants seront conservés.")) return;
    try { await api(`/billing/clients/${id}/archive`, { method: "POST" }); await refresh(); }
    catch (err) { setError((err as Error).message); }
  }
  async function removeDraft(id: string) {
    if (!window.confirm("Supprimer ce document ?")) return;
    try { await api(`/billing/invoices/${id}`, { method: "DELETE" }); await refresh(); }
    catch (err) { setError((err as Error).message); }
  }

  function previewCurrentDraft() {
    const selectedClient = clients.find((item) => item.id === clientId);
    if (!selectedClient) { setError("Sélectionne un client avant de prévisualiser."); return; }
    setPreviewDoc({
      kind, period,
      reference: editingInvoice ? `${kind === "forecast" ? "PREVISION" : "BROUILLON"}-${editingInvoice.slice(-8).toUpperCase()}` : "NON ENREGISTRÉ",
      client: selectedClient, profile, currency, issueDate, serviceDate, dueDate, notes, lines,
    });
  }
  function previewSavedDraft(invoice: Invoice) {
    setPreviewDoc({
      kind: invoice.kind ?? "forecast", period: invoice.period,
      reference: `${invoice.kind === "draft" ? "BROUILLON" : "PREVISION"}-${invoice.id.slice(-8).toUpperCase()}`,
      client: invoice.client, profile, currency: invoice.currency, issueDate: invoice.issueDate,
      serviceDate: invoice.serviceDate, dueDate: invoice.dueDate, notes: invoice.notes ?? "",
      lines: invoice.lines.map((line) => ({
        description: line.description, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice),
        discountPercent: Number(line.discountPercent), vatRate: Number(line.vatRate),
      })),
    });
  }

  /** Reprend les coûts d'hébergement (et Claude) des applis du client, tels quels ; les lignes restent modifiables. */
  async function importHosting() {
    setError(""); setNotice(""); setImportWarnings([]); setImportMsg(null);
    try {
      const r = await api<ForecastResponse>("/billing/forecast-lines", { method: "POST", body: { clientId, currency, usdRate: currency !== "USD" && usdRate && !rateAuto ? Number(usdRate) : undefined, date: issueDate || undefined, includeClaude } });
      const kept = lines.filter((l) => l.source !== "hosting" && l.source !== "claude" && (l.description.trim() || l.unitPrice));
      const next = [...r.lines, ...kept];
      setLines(next.length ? next : [blankLine()]);
      setImportWarnings([...r.warnings, ...r.missingApps.map((k) => `Appli « ${k} » : aucun coût trouvé.`)]);
      setImportMsg(
        r.lines.length === 0
          ? { ok: false, text: `Aucune ligne à importer pour ${r.apps.join(", ") || "ce client"} : ${r.skippedFree ? `${r.skippedFree} poste(s) gratuit(s) (par exemple un site statique), non repris. ` : "aucun coût trouvé. "}Si son hébergement doit être facturé, rattachez-lui aussi l'appli qui le porte (MGA pour Autonova Group) : onglet Clients › Modifier.` }
          : { ok: true, text: `${r.lines.length} ligne(s) importée(s) pour ${r.apps.join(", ")} (tarifs Render du ${new Date(r.pricesAsOf).toLocaleDateString("fr-FR")}${r.rate && currency !== "USD" ? `, taux 1 $ = ${r.rate} ${currency === "XOF" ? "FCFA" : "€"} (${r.rateInfo})` : ""}${r.skippedFree ? `, ${r.skippedFree} poste(s) gratuit(s) non repris` : ""}). Modifiables ligne par ligne.` }
      );
    } catch (err) { setImportMsg({ ok: false, text: (err as Error).message }); }
  }
  function addFreeLine(description: string) {
    const blank = lines.length === 1 && !lines[0].description.trim() && !lines[0].unitPrice;
    const line: Line = { ...blankLine(), description, source: "free" };
    setLines(blank ? [line] : [...lines, line]);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    try { await api("/billing/profile", { method: "PUT", body: profile }); setNotice("Paramètres commerciaux enregistrés."); }
    catch (err) { setError((err as Error).message); }
  }

  return <>
    <div className="page-head"><div className="billing-page-brand"><div><h1>Facturation</h1><p className="muted small">Répertoire clients et préparation des factures.</p></div></div><button className="primary" onClick={newDraft}>+ Nouvelle facture prévisionnelle</button></div>
    <div className="banner banner-bad"><div><strong>Émission officielle désactivée</strong><span>La structure juridique et le régime de TVA ne sont pas encore configurés. Aucun numéro de facture ne sera attribué.</span></div></div>
    {notice && <p className="success small">{notice}</p>}{error && <p className="error small">{error}</p>}
    <div className="tabs">
      {([["invoices", `Factures (${invoices.length})`], ["clients", `Clients (${clients.length})`], ["new", "Saisie"], ["settings", "Paramètres"]] as const).map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    {tab === "invoices" && <section className="card"><h3>Factures prévisionnelles et brouillons</h3>{invoices.length === 0 ? <p className="muted small">Aucun document enregistré.</p> : <div className="stack-small">{invoices.map((i) => <div className="service" key={i.id}>
        <div className="row wrap"><strong>{i.kind === "draft" ? "BROUILLON" : "PRÉVISIONNELLE"}</strong><span className="muted small">{i.period ? `${i.period} · ` : ""}{i.id.slice(-8).toUpperCase()}</span></div>
        <span>{i.client.name} <span className="muted small">· {new Date(i.createdAt).toLocaleDateString("fr-FR")}</span></span>
        <strong>{money(i.total, i.currency)} <span className="muted small">TTC estimé</span></strong>
        <div className="row wrap"><button onClick={() => previewSavedDraft(i)}>Aperçu A4</button><button onClick={() => void downloadPdf(i)}>Télécharger PDF</button><button onClick={() => void editDraft(i)}>Modifier</button><button className="danger" onClick={() => void removeDraft(i.id)}>Supprimer</button></div>
      </div>)}</div>}</section>}
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
        <fieldset className="stack-small"><legend className="small">Applis dont l'hébergement est facturé à ce client</legend>
          {catalog.map((a) => <label className="row" key={a.key}><input type="checkbox" checked={client.appKeys.includes(a.key)} onChange={(e) => setClient({ ...client, appKeys: e.target.checked ? [...client.appKeys, a.key] : client.appKeys.filter((k) => k !== a.key) })}/> {a.name}</label>)}
          <label className="row"><input type="checkbox" checked={client.appKeys.includes("njmdev")} onChange={(e) => setClient({ ...client, appKeys: e.target.checked ? [...client.appKeys, "njmdev"] : client.appKeys.filter((k) => k !== "njmdev") })}/> NJMDev (Supervision)</label>
        </fieldset>
        <div className="row"><button className="primary" type="submit">Enregistrer</button>{editingClient && <button type="button" onClick={() => { setEditingClient(null); setClient(blankClient()); }}>Annuler</button>}</div>
      </form></section>
      <section className="card"><h3>Répertoire</h3>{clients.length === 0 ? <p className="muted small">Aucun client pour le moment.</p> : clients.map((c) => <div className="service" key={c.id}><strong>{c.name}</strong><span className="muted small">{[c.email, c.city, c.country].filter(Boolean).join(" · ")}</span>{c.appKeys?.length ? <span className="small">Applis : {c.appKeys.map((k) => (k === "njmdev" ? "NJMDev" : catalog.find((x) => x.key === k)?.name ?? k)).join(", ")}</span> : <span className="muted small">Aucune appli rattachée</span>}<div className="row"><button onClick={() => startClientEdit(c)}>Modifier</button><button onClick={() => void archiveClient(c.id)}>Archiver</button></div></div>)}</section>
    </div>}
    {tab === "new" && <form className="stack" onSubmit={saveDraft}>
      <section className="card"><h3>{editingInvoice ? "Modifier le document" : "Créer une facture prévisionnelle"}</h3>
        <label>Client<select required value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Sélectionner un client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {clients.length === 0 && <p className="muted small">Crée d'abord une fiche client.</p>}
        <label>Devise<select value={currency} onChange={(e) => { setCurrency(e.target.value); setRateAuto(true); setUsdRate(""); }}><option value="XOF">FCFA (XOF)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar US (USD)</option></select></label>
        <div className="row wrap"><label>Nature<select value={kind} onChange={(e) => setKind(e.target.value)}><option value="forecast">Facture prévisionnelle</option><option value="draft">Brouillon de facture</option></select></label><label>Mois concerné<input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}/></label></div>
        <div className="row wrap"><label>Date du document<input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}/></label><label>Date de prestation<input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)}/></label><label>Échéance souhaitée<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}/></label></div>
      </section>
      <section className="card"><h3>Hébergement et IA des applis du client</h3>
        <p className="muted small">Reprend, tels quels, les coûts de la page « Coûts » des applis rattachées au client (onglet Clients). Les lignes importées restent modifiables, et les coûts sont des estimations : la facture définitive sera établie après la facture de Render.</p>
        {currency !== "USD" && <>
          <label>Taux de conversion : 1 dollar (USD) = … {currency === "XOF" ? "FCFA" : "euro(s)"}<input type="number" min="0" step="0.0001" value={usdRate} onChange={(e) => { setUsdRate(e.target.value); setRateAuto(false); }}/></label>
          {fx && <p className="small muted">{fx.mode === "market" ? "Taux de marché repris automatiquement" : "Taux de facturation retenu"} : 1 $ = {fx.rate.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} {currency === "XOF" ? "FCFA" : "€"} ({fx.source}{fx.date ? `, ${new Date(fx.date).toLocaleDateString("fr-FR")}` : ""}).{rateAuto ? " Modifiable." : <> <button type="button" onClick={() => { setRateAuto(true); setUsdRate(String(fx.rate)); }}>Reprendre le taux retenu</button></>}</p>}
          {fxError && <p className="small">⚠️ {fxError}</p>}
          {fx && Number(usdRate) > 0 && (Number(usdRate) > fx.rate * 1.5 || Number(usdRate) < fx.rate / 1.5) && <p className="error small">⚠️ Ce taux s'éloigne fortement du taux retenu ({fx.rate.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}) : vérifiez l'unité (1 dollar = combien de {currency === "XOF" ? "FCFA" : "euros"}).</p>}
        </>}
        <label className="row"><input type="checkbox" checked={includeClaude} onChange={(e) => setIncludeClaude(e.target.checked)}/> Inclure les dépenses Claude du mois en cours</label>
        {(() => {
          const c = clients.find((x) => x.id === clientId);
          if (!c) return <p className="small">⚠️ Choisissez d'abord un client.</p>;
          const names = (c.appKeys ?? []).map((k) => (k === "njmdev" ? "NJMDev" : catalog.find((x) => x.key === k)?.name ?? k));
          return names.length ? <p className="small muted">Applis rattachées à {c.name} : {names.join(", ")}.</p> : <p className="small">⚠️ Aucune appli n'est rattachée à {c.name} : onglet Clients › Modifier › « Applis dont l'hébergement est facturé à ce client ».</p>;
        })()}
        <div className="row wrap"><button type="button" onClick={() => void importHosting()} disabled={!clientId || (currency !== "USD" && !Number(usdRate) && !fx)}>Importer l'hébergement du client</button></div>
        {importMsg && <p className={importMsg.ok ? "success small" : "error small"} role="status">{importMsg.text}</p>}
        {importWarnings.map((w) => <p key={w} className="small">⚠️ {w}</p>)}
      </section>
      <section className="card"><div className="page-head"><h3>Prestations</h3><button type="button" onClick={() => setLines([...lines, blankLine()])}>+ Ajouter une ligne</button></div>
        <div className="row wrap"><span className="muted small">Ligne libre :</span>{FREE_LINES.map((d) => <button type="button" key={d} onClick={() => addFreeLine(d)}>{d}</button>)}</div>
        {lines.map((l, n) => <div className="invoice-line" key={n}>
          <label className="line-description">Description{l.source === "hosting" || l.source === "claude" ? <span className="muted small"> · importée des coûts{l.usd != null ? " (suit le taux)" : " (prix modifié à la main)"}</span> : null}<input required value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, description: e.target.value } : x))}/></label>
          <label>Qté<input type="number" min="0.001" step="0.001" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, quantity: Number(e.target.value) } : x))}/></label>
          <label>Prix HT<input type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, unitPrice: Number(e.target.value), usd: null } : x))}/></label>
          <label>Remise %<input type="number" min="0" max="100" step="0.01" value={l.discountPercent} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, discountPercent: Number(e.target.value) } : x))}/></label>
          <label>TVA %<input type="number" min="0" max="100" step="0.01" value={l.vatRate} onChange={(e) => setLines(lines.map((x, j) => j === n ? { ...x, vatRate: Number(e.target.value) } : x))}/></label>
          {lines.length > 1 && <button type="button" className="danger" onClick={() => setLines(lines.filter((_, j) => j !== n))}>Retirer</button>}
        </div>)}
      </section>
      <section className="card"><h3>Notes internes</h3><label>Notes<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}/></label>
        <div className="metrics"><div className="metric"><span className="muted small">HT estimé</span><strong className="metric-value">{money(totals.ht, currency)}</strong></div><div className="metric"><span className="muted small">TVA estimée</span><strong className="metric-value">{money(totals.vat, currency)}</strong></div><div className="metric"><span className="muted small">TTC estimé</span><strong className="metric-value">{money(totals.ht + totals.vat, currency)}</strong></div></div>
        <p className="muted small">Le serveur recalcule les montants avec des décimales exactes. Ce document reste un brouillon sans valeur de facture émise.</p>
        <div className="row wrap"><button type="button" onClick={previewCurrentDraft} disabled={!clientId || lines.some((l) => !l.description.trim() || l.quantity <= 0)}>Aperçu A4</button><button className="primary" type="submit" disabled={!clientId || lines.some((l) => !l.description.trim() || l.quantity <= 0)}>Enregistrer le brouillon</button><button type="button" onClick={() => setTab("invoices")}>Annuler</button></div>
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
      <label>Conversion des coûts d'hébergement (dollars → devise du document)<select value={profile.fxMode ?? "market"} onChange={(e) => setProfile({ ...profile, fxMode: e.target.value })}><option value="market">Taux de marché (BCE, à la date du document)</option><option value="parity">Parité commerciale : 1 $ = 1 € (1 $ = 655,957 FCFA)</option></select></label>
      <label>Devise par défaut<select value={profile.defaultCurrency ?? "XOF"} onChange={(e) => setProfile({ ...profile, defaultCurrency: e.target.value })}><option value="XOF">FCFA (XOF)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar US (USD)</option></select></label>
      <button className="primary" type="submit">Enregistrer</button>
    </form><div className="banner banner-bad"><div><strong>Émission officielle désactivée</strong><span>Le profil légal et le régime fiscal ivoiriens doivent être vérifiés. L’émission FNE ne sera activée qu’après validation du parcours DGI applicable.</span></div></div></section>}
    {previewDoc && <InvoicePreview data={previewDoc} onClose={() => setPreviewDoc(null)} />}
  </>;
}

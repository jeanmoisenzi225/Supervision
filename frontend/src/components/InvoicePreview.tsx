import type { ReactNode } from "react";
import { NJMDEV_LOGO_BLACK } from "../assets/njmdevLogo";

export type InvoicePreviewData = {
  /** « forecast » : facture prévisionnelle (estimation avant la facture de l'hébergeur) ; sinon brouillon. */
  kind?: string;
  period?: string | null;
  reference: string;
  client: {
    name: string; email: string | null; phone: string | null; billingAddress: string | null;
    postalCode: string | null; city: string | null; country: string; rccm: string | null; ncc: string | null;
  };
  profile: {
    brandName: string; contactEmail: string; phone: string; website: string; paymentDetails: string;
    legalName?: string; businessAddress?: string; rccm?: string; ncc?: string;
  };
  currency: string;
  issueDate: string | null;
  serviceDate: string | null;
  dueDate: string | null;
  notes: string;
  lines: Array<{ description: string; quantity: number; unitPrice: number; discountPercent: number; vatRate: number }>;
};

const money = (value: number, currency: string) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency, maximumFractionDigits: currency === "XOF" ? 0 : 2,
}).format(value);
const date = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR") : "—";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="invoice-preview-field"><span>{label}</span><strong>{children || "—"}</strong></div>;
}

export function InvoicePreview({ data, onClose }: { data: InvoicePreviewData; onClose: () => void }) {
  const factor = data.currency === "XOF" ? 1 : 100;
  const round = (value: number) => Math.round(value * factor) / factor;
  const rows = data.lines.map((line) => {
    const base = round(line.quantity * line.unitPrice * (1 - line.discountPercent / 100));
    const vat = round(base * line.vatRate / 100);
    return { ...line, base, vat, total: round(base + vat) };
  });
  const subtotal = rows.reduce((sum, row) => sum + row.base, 0);
  const vatTotal = rows.reduce((sum, row) => sum + row.vat, 0);
  const total = subtotal + vatTotal;

  const forecast = data.kind === "forecast";
  return <div className="invoice-preview-overlay" role="dialog" aria-modal="true" aria-label="Aperçu A4 du document">
    <div className="invoice-preview-toolbar no-print">
      <div><strong>Aperçu A4</strong><span>Document de travail — aucune émission officielle</span></div>
      <div className="row wrap"><button onClick={() => window.print()} className="primary">Imprimer l’aperçu</button><button onClick={onClose}>Fermer</button></div>
    </div>
    <article className="invoice-print-root">
      <div className="invoice-print-sheet">
        <header className="invoice-preview-header">
          <div className="invoice-preview-brand"><img src={NJMDEV_LOGO_BLACK} alt="NJMDev" /><div className="invoice-preview-issuer"><h1>{data.profile.brandName || "NJMDev"}</h1>
            {data.profile.legalName && <p>{data.profile.legalName}</p>}
            {data.profile.businessAddress && <p>{data.profile.businessAddress}</p>}
            {data.profile.contactEmail && <p>{data.profile.contactEmail}</p>}
            {data.profile.phone && <p>{data.profile.phone}</p>}
            {data.profile.website && <p>{data.profile.website}</p>}
            {data.profile.rccm && <p>RCCM : {data.profile.rccm}</p>}
            {data.profile.ncc && <p>NCC : {data.profile.ncc}</p>}
            </div>
          </div>
          <div className="invoice-preview-title"><span>{forecast ? "PRÉVISIONNELLE" : "BROUILLON"}</span><h2>{forecast ? "FACTURE PRÉVISIONNELLE" : "FACTURE"}</h2><strong>{[forecast ? data.period : null, data.reference].filter(Boolean).join(" · ")}</strong></div>
        </header>
        <div className="invoice-preview-parties">
          <section><h3>FACTURÉ À</h3><strong>{data.client.name}</strong>
            <p>{data.client.billingAddress}</p><p>{[data.client.postalCode, data.client.city].filter(Boolean).join(" ")}</p>
            <p>{data.client.country}</p><p>{data.client.email}</p><p>{data.client.phone}</p>
            {data.client.rccm && <p>RCCM : {data.client.rccm}</p>}{data.client.ncc && <p>NCC : {data.client.ncc}</p>}
          </section>
          <section className="invoice-preview-dates">
            <Field label="Date du document">{date(data.issueDate)}</Field>
            <Field label="Date de prestation">{date(data.serviceDate)}</Field>
            <Field label="Échéance">{date(data.dueDate)}</Field>
            <Field label="Devise">{data.currency}</Field>
          </section>
        </div>
        <table className="invoice-preview-table">
          <thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Remise</th><th>TVA</th><th className="right">Total HT</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}>
            <td>{row.description}</td><td>{row.quantity}</td><td>{money(row.unitPrice, data.currency)}</td>
            <td>{row.discountPercent}%</td><td>{row.vatRate}%</td><td className="right">{money(row.base, data.currency)}</td>
          </tr>)}</tbody>
        </table>
        <div className="invoice-preview-bottom">
          <div className="invoice-preview-notes">{data.notes && <><h3>NOTES</h3><p>{data.notes}</p></>}</div>
          <div className="invoice-preview-totals">
            <Field label="Total HT">{money(subtotal, data.currency)}</Field>
            <Field label="Total TVA">{money(vatTotal, data.currency)}</Field>
            <Field label="Total TTC">{money(total, data.currency)}</Field>
          </div>
        </div>
        {data.profile.paymentDetails && <div className="invoice-preview-payment"><h3>INFORMATIONS DE PAIEMENT</h3><p>{data.profile.paymentDetails}</p></div>}
        <footer className="invoice-preview-footer">
          <strong>{forecast ? "DOCUMENT PRÉVISIONNEL — NON DÉFINITIF" : "DOCUMENT DE TRAVAIL — BROUILLON NON ÉMIS"}</strong>
          {forecast && <p>Montants estimés d'après les offres d'hébergement en vigueur ; la facture définitive sera établie après la facturation par l'hébergeur, et peut différer.</p>}
          <p>Ce document est une prévisualisation. Il ne constitue pas une facture officielle, ne porte aucun numéro fiscal et ne comporte aucune certification FNE.</p>
        </footer>
      </div>
    </article>
  </div>;
}

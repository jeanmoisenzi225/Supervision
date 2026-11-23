/**
 * Documents de prestation : demande de règlement et convention de constatation des travaux.
 * Documents FINAUX (v0.47.0) : une information absente fait disparaître sa ligne ou sa phrase, jamais de zone à compléter.
 * Le contenu est décrit en blocs, rendus ensuite en PDF et en DOCX. Marqueur : **gras**.
 * Règles : jamais de faux identifiant administratif, jamais de « facture », jamais d'antidatage.
 */
export type Terms = {
  /** Loi applicable : « française » ou « ivoirienne ». */
  law: string;
  /** Juridiction ou mode de règlement compétent (ex. « tribunaux de commerce d'Abidjan »). */
  jurisdiction: string;
  /** « licence » (par défaut) ou « cession ». */
  rights: string;
  /** « non exclusive » (par défaut) ou « exclusive ». */
  exclusivity: string;
  territory: string;
  duration: string;
  /** Rémunération distincte de la cession (obligatoire si rights = cession). */
  cessionFee: string;
  /** Pénalités de retard (ex. « 3 % par mois ») : la clause n'apparaît que si renseigné. */
  penaltyRate: string;
  /** Qui supporte les frais bancaires : « le client », « le prestataire »… */
  bankFees: string;
  /** « oui » si la remise du code source est comprise. */
  sourceCode: string;
};
export const EMPTY_TERMS: Terms = { law: "", jurisdiction: "", rights: "licence", exclusivity: "non exclusive", territory: "", duration: "", cessionFee: "", penaltyRate: "", bankFees: "", sourceCode: "" };

export type ServiceDocData = {
  appName: string; description: string; features: string[]; technologies: string; workNature: string; period: string; deliveryState: string; location: string;
  amount: number | null; currency: "EUR" | "XOF"; paymentTerms: string; paymentDue: string; paymentCoordinates: string;
  clientLegalForm: string; clientRepresentative: string; clientRole: string; place: string; reference: string; emissionDate: string | null;
  lines: { description: string; quantity: number; unitPrice: number }[];
  terms?: Partial<Terms>;
  provider: { name: string; address: string; email: string; phone: string; brand: string };
  client: { name: string; address: string; rccm: string; ncc: string; email: string; phone: string };
};

export type Block =
  | { t: "title"; title: string; sub: string }
  | { t: "meta"; items: [string, string][] }
  /** Mention de nature du document : texte sobre entre deux filets, sans encadré coloré. */
  | { t: "mention"; label: string; text: string }
  | { t: "h2"; text: string }
  | { t: "p"; text: string; small?: boolean }
  | { t: "list"; items: string[] }
  | { t: "cols"; left: [string, string[]]; right: [string, string[]] }
  | { t: "kv"; rows: [string, string][] }
  | { t: "amount"; rows: [string, string][]; total: string; note: string }
  | { t: "art"; n: number; title: string; items: (string | Block)[] }
  /** Deux cadres de signature : prestataire (gauche) et client (droite). */
  | { t: "sig2"; intro: string; left: string; right: string; rightLabel?: string }
  | { t: "foot"; text: string };

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function frDate(iso: string | null | undefined): string {
  const m = iso && /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  const day = Number(m[3]);
  return `${day}${day === 1 ? "er" : ""} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
export function formatAmount(amount: number, currency: "EUR" | "XOF"): string {
  const n = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: currency === "EUR" ? 2 : 0, maximumFractionDigits: currency === "EUR" ? 2 : 0 }).format(amount).replace(/[  ]/g, " ");
  return currency === "EUR" ? `${n} €` : `${n} FCFA`;
}

// ---------- Montant en lettres ----------
const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];
function below100(n: number, final: boolean): string {
  if (n < 20) return UNITS[n];
  if (n < 70) { const t = Math.floor(n / 10), u = n % 10; return TENS[t] + (u === 1 ? " et un" : u ? `-${UNITS[u]}` : ""); }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${UNITS[n - 60]}`;
  if (n === 80) return final ? "quatre-vingts" : "quatre-vingt";
  return `quatre-vingt-${UNITS[n - 80]}`;
}
function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100), r = n % 100;
  if (h === 0) return below100(r, final);
  const head = h === 1 ? "cent" : `${UNITS[h]} cent`;
  if (r === 0) return h === 1 ? "cent" : head + (final ? "s" : "");
  return `${head} ${below100(r, final)}`;
}
export function numberToFrench(n: number): string {
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const millions = Math.floor(n / 1e6), thousands = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  if (millions) parts.push(`${below1000(millions, false)} million${millions > 1 ? "s" : ""}`);
  if (thousands) parts.push(thousands === 1 ? "mille" : `${below1000(thousands, false)} mille`);
  if (rest) parts.push(below1000(rest, true));
  return parts.join(" ");
}
export function amountInWords(amount: number, currency: "EUR" | "XOF"): string {
  const whole = Math.floor(amount + 1e-9), cents = Math.round((amount - whole) * 100);
  const unit = currency === "EUR" ? (whole > 1 ? "euros" : "euro") : (whole > 1 ? "francs CFA" : "franc CFA");
  const base = `${numberToFrench(whole)} ${unit}`;
  return currency === "EUR" && cents ? `${base} et ${numberToFrench(cents)} centime${cents > 1 ? "s" : ""}` : base;
}

// Une valeur sans lettre ni chiffre (« . », « - ») est traitée comme absente.
const has = (x: string | null | undefined): x is string => Boolean(x && /[\p{L}\p{N}]/u.test(x));
const t = (x: string | null | undefined) => (x ?? "").trim();
const art = (n: number, title: string, ...items: (string | Block | null | false | undefined)[]): Block => {
  const kept = items.filter((i): i is string | Block => Boolean(i));
  const strings = kept.filter((i) => typeof i === "string").length;
  let k = 0;
  return { t: "art", n, title, items: kept.map((i) => (typeof i === "string" && strings > 1 ? `${n}.${++k}. ${i}` : i)) };
};

/** Informations indispensables pour produire un document, sinon il ne peut pas être final. */
export function missingForDoc(d: ServiceDocData, kind: "demande" | "convention"): string[] {
  const missing: string[] = [];
  if (!has(d.provider.name)) missing.push("ton nom et prénoms (Paramètres › Prestataire)");
  if (!has(d.provider.address)) missing.push("ton adresse (Paramètres › Prestataire)");
  const sum = d.lines.some((l) => has(l.description));
  if (d.amount == null && !sum) missing.push("le montant (ou les coûts importés des applis du client)");
  if (kind === "convention") {
    const tm = { ...EMPTY_TERMS, ...d.terms };
    if (!has(tm.law)) missing.push("la loi applicable");
    if (!has(tm.jurisdiction)) missing.push("la juridiction compétente");
    if (tm.rights === "cession" && !has(tm.cessionFee)) missing.push("la rémunération de la cession de droits");
  }
  return missing;
}

export function buildServiceDocs(d: ServiceDocData, today = new Date().toISOString().slice(0, 10)) {
  const p = d.provider, c = d.client, nc = p.brand || "NJMDev";
  const tm = { ...EMPTY_TERMS, ...d.terms };
  const eur = d.currency === "EUR";
  const dateEm = frDate(d.emissionDate || today);
  const nomP = t(p.name), cli = t(c.name), app = t(d.appName);
  const ref = t(d.reference);
  const feat = d.features.map(t).filter(Boolean);

  // Les lignes (coûts des applis, repris de la facturation) alimentent le total tant qu'aucun montant n'est saisi à la main.
  const lines = d.lines.filter((l) => has(l.description));
  const prec = eur ? 2 : 0;
  const roundTo = (n: number) => Math.round(n * 10 ** prec) / 10 ** prec;
  const lineAmounts = lines.map((l) => roundTo(l.quantity * l.unitPrice));
  const lineSum = roundTo(lineAmounts.reduce((s, x) => s + x, 0));
  const total = d.amount ?? (lines.length ? lineSum : 0);
  const mont = formatAmount(total, d.currency);
  const lineRows: [string, string][] = lines.map((l, i) => [l.quantity === 1 ? t(l.description) : `${t(l.description)} (× ${l.quantity})`, formatAmount(lineAmounts[i], d.currency)]);
  const gap = lines.length > 0 && d.amount != null && Math.abs(lineSum - d.amount) > 0.005;

  const identPre = [`**${nomP}**, personne physique, agissant à titre personnel`, has(p.address) && `Adresse : ${t(p.address)}`, [p.email, p.phone].filter(has).length > 0 && `Contact : ${[p.email, p.phone].filter(has).join(" · ")}`, "Prestataire sans structure juridique à ce jour."].filter(Boolean) as string[];
  const ids = [has(c.rccm) && `RCCM : ${t(c.rccm)}`, has(c.ncc) && `NCC : ${t(c.ncc)}`].filter(Boolean).join(" · ");
  const identCli = [
    `**${cli}**${has(d.clientLegalForm) ? `, ${t(d.clientLegalForm)}` : ""}`,
    has(c.address) && `Siège : ${t(c.address)}`,
    ids,
    has(d.clientRepresentative) && `Représentée par ${t(d.clientRepresentative)}${has(d.clientRole) ? `, ${t(d.clientRole)}` : ""}`,
    [c.email, c.phone].filter(has).length > 0 && [c.email, c.phone].filter(has).join(" · "),
  ].filter(Boolean) as string[];
  const place = has(d.place) ? `Fait à ${t(d.place)}, le ${dateEm}` : `Fait le ${dateEm}`;

  // ---------- Demande de règlement ----------
  const payRows: [string, string][] = [
    has(d.paymentTerms) && ["Mode de paiement", t(d.paymentTerms)],
    has(d.paymentDue) && ["Échéance", t(d.paymentDue)],
    has(d.paymentCoordinates) && ["Coordonnées de paiement", t(d.paymentCoordinates)],
    ref && ["Libellé à indiquer", ref],
  ].filter(Boolean) as [string, string][];
  const hasWork = has(d.workNature) || has(d.period) || has(d.deliveryState);
  const workLine = [has(d.period) && `Période de réalisation : ${t(d.period)}.`, has(d.deliveryState) && `État à ce jour : ${t(d.deliveryState)}.`].filter(Boolean).join(" ");

  const demande: Block[] = [
    { t: "title", title: "DEMANDE DE RÈGLEMENT", sub: "Prestation de développement informatique" },
    { t: "meta", items: [ref && ["Référence", ref], ["Date d’émission", dateEm], ["Objet", `Règlement de la prestation « ${app} »`]].filter(Boolean) as [string, string][] },
    { t: "mention", label: "Nature du document", text: "La présente demande de règlement n’est pas une facture fiscale et n’en tient pas lieu : elle ne comporte ni numéro de facture ni TVA. Elle ne vaut pas, à elle seule, reconnaissance de dette ni titre de créance exigible." },
    { t: "h2", text: "1. Parties" },
    { t: "cols", left: ["Prestataire", identPre], right: ["Client destinataire", identCli] },
    { t: "h2", text: "2. Prestation concernée" },
    { t: "p", text: `Application : **${app}**.` },
    has(d.description) && { t: "p", text: t(d.description) },
    feat.length > 0 && { t: "p", text: "**Fonctionnalités principales**" },
    feat.length > 0 && { t: "list", items: feat },
    has(d.technologies) && { t: "p", text: `**Environnement technique** : ${t(d.technologies).replace(/\.$/, "")}.` },
    hasWork && { t: "h2", text: "3. Nature des travaux réalisés" },
    has(d.workNature) && { t: "p", text: t(d.workNature) },
    workLine && { t: "p", text: workLine },
    { t: "h2", text: `${hasWork ? 4 : 3}. Montant demandé` },
    { t: "amount", rows: lines.length ? lineRows : [[`Prestation de développement informatique « ${app} »`, mont]], total: mont,
      note: `${lines.length ? "Détail des composants et coûts relevés pour l’application. " : ""}Montant net, sans TVA.${gap ? ` Le montant convenu diffère du total du détail ci-dessus (${formatAmount(lineSum, d.currency)}).` : ""}` },
    payRows.length > 0 && { t: "h2", text: `${hasWork ? 5 : 4}. Modalités et coordonnées de paiement` },
    payRows.length > 0 && { t: "kv", rows: payRows },
    has(tm.bankFees) && { t: "p", text: `Les frais bancaires, notamment de virement international et de conversion de devise, sont à la charge de ${t(tm.bankFees)}.` },
    { t: "sig2", intro: `${place}.`, left: nomP, right: `${cli}${has(d.clientRepresentative) ? `, représenté par ${t(d.clientRepresentative)}` : ""}`, rightLabel: "Le client : bon pour accord" },
  ].filter(Boolean) as Block[];

  // ---------- Convention ----------
  const cession = tm.rights === "cession";
  const territory = has(tm.territory) ? t(tm.territory) : "la Côte d’Ivoire";
  const duration = has(tm.duration) ? t(tm.duration) : "la durée d’exploitation de l’application";
  const excl = tm.exclusivity === "exclusive" ? "exclusive" : "non exclusive";
  const rightsClause = cession
    ? `**Cession de droits.** Le prestataire cède au client, à titre ${excl}, les droits patrimoniaux suivants, chacun étant énuméré et délimité : droit de reproduction ; droit de représentation ; droit d’adaptation, de modification et de traduction ; droit de mise sur le marché et de distribution. Territoire : ${territory}. Durée : ${duration}. Destination : exploitation de l’application pour les besoins du client. La cession n’est effective qu’à compter du **paiement intégral du prix convenu** et de la signature de la présente convention. Elle ne porte pas sur les composants tiers et logiciels libres, qui restent soumis à leurs licences propres, ni sur les savoir-faire, outils, bibliothèques et composants génériques préexistants du prestataire, réutilisables pour d’autres projets.`
    : `**Licence d’exploitation.** Le prestataire reste titulaire de l’ensemble des droits de propriété intellectuelle sur l’application, son code source et sa documentation. Il concède au client une licence ${excl}, incessible sauf accord écrit du prestataire, pour ${territory}, pour ${duration}, limitée à l’exploitation de l’application pour les besoins propres du client, à l’exclusion de toute revente ou sous-licence sauf accord écrit.`;
  const law = tm.law === "ivoirienne" ? "ivoirien" : "français";
  const refConv = ref ? ref.replace(/^DR/i, "CV") : "";

  const convention: Block[] = [
    { t: "title", title: "CONVENTION DE CONSTATATION DES TRAVAUX", sub: "et de régularisation contractuelle" },
    { t: "meta", items: [refConv && ["Référence", refConv], ["Prend effet", "à la date de la dernière signature"], ["Objet", `Application « ${app} »`]].filter(Boolean) as [string, string][] },
    { t: "h2", text: "ENTRE LES SOUSSIGNÉS" },
    { t: "cols", left: ["Le prestataire", identPre], right: ["Le client", identCli] },
    { t: "p", text: "Ci-après désignés ensemble « les parties » et séparément « le prestataire » et « le client »." },
    { t: "h2", text: "PRÉAMBULE" },
    { t: "p", text: `Le prestataire a réalisé, à la demande du client et avant la signature de la présente convention, des travaux de développement informatique relatifs à l’application « ${app} ». À la date de la signature, aucun contrat écrit n’avait été conclu entre les parties. Elles souhaitent constater ces travaux, fixer par écrit les conditions de leur rémunération et régler la question des droits de propriété intellectuelle. ${nc} est le nom commercial et l’identité visuelle utilisés par le prestataire ; ce n’est pas une personne morale.` },
    art(1, "Objet", "La présente convention a pour objet : (a) de constater les travaux déjà réalisés par le prestataire pour le client ; (b) de fixer la rémunération convenue et ses modalités de paiement ; (c) de définir les conditions de livraison et de réception ; (d) de régler les droits de propriété intellectuelle sur l’application."),
    art(2, "Constatation des travaux réalisés",
      has(d.workNature) && `Les parties constatent que le prestataire a réalisé les travaux suivants : ${t(d.workNature).replace(/\.$/, "")}.`,
      has(d.period) && `Période de réalisation : ${t(d.period)}.`,
      "Cette constatation est faite à la date de signature. Elle ne vaut pas conclusion rétroactive d’un contrat ; la convention **produit ses effets à compter de la date de la dernière signature**. Les parties reconnaissent néanmoins la réalité des travaux antérieurs décrits dans la présente convention."),
    art(3, "Description de l’application",
      `Application : **${app}**.${has(d.description) ? ` ${t(d.description)}` : ""}`,
      feat.length > 0 && "Fonctionnalités principales :",
      feat.length > 0 && { t: "list", items: feat },
      (has(d.technologies) || has(d.location)) && `Description technique : ${[has(d.technologies) && t(d.technologies).replace(/\.$/, ""), has(d.location) && `localisation : ${t(d.location)}`].filter(Boolean).join(". ")}.`,
      tm.sourceCode === "oui" && "La remise du code source est comprise dans la prestation."),
    art(4, "Rémunération",
      `Les parties conviennent d’une rémunération forfaitaire de **${mont}** (${amountInWords(total, d.currency)}), nette de TVA, pour les travaux constatés à l’article 2.`,
      "Ce montant rémunère les travaux de développement. **Il ne rémunère pas la cession de droits d’auteur**, qui, si elle est retenue à l’article 8, fait l’objet d’une rémunération distincte précisée à cet article.",
      lines.length > 0 && "Détail des composants et coûts constatés pour l’application :",
      lines.length > 0 && { t: "list", items: lineRows.map(([a, b]) => `${a} : ${b}`) },
      gap && `Le montant convenu diffère du total de ce détail (${formatAmount(lineSum, d.currency)}).`),
    art(5, "Modalités de paiement",
      (has(d.paymentTerms) || has(d.paymentDue)) && `Paiement ${[has(d.paymentTerms) && `par ${t(d.paymentTerms)}`, has(d.paymentDue) && `à l’échéance suivante : ${t(d.paymentDue)}`].filter(Boolean).join(", ")}.`,
      has(d.paymentCoordinates) && `Coordonnées de paiement : ${t(d.paymentCoordinates)}.`,
      `Devise de paiement : ${eur ? "euro (EUR)" : "franc CFA (FCFA)"}.${has(tm.bankFees) ? ` Les frais bancaires et de change sont supportés par ${t(tm.bankFees)}.` : ""}`,
      has(tm.penaltyRate) && `En cas de retard de paiement, des pénalités de ${t(tm.penaltyRate)} s’appliquent après mise en demeure écrite.`),
    art(6, "Livraison et réception",
      has(d.deliveryState) && `Livraison : ${t(d.deliveryState)}.`,
      "Le client dispose de quinze (15) jours à compter de la signature pour formuler par écrit ses réserves motivées sur la conformité de l’application à la description de l’article 3. À défaut, l’application est réputée reçue.",
      "Le prestataire corrige les anomalies de conformité signalées dans ce délai, dans un délai raisonnable. La maintenance évolutive ou corrective ultérieure n’est pas incluse et fait l’objet d’un accord distinct."),
    art(7, "Garanties et responsabilités",
      "Le prestataire est tenu d’une obligation de moyens. Il garantit qu’il détient les droits sur le code qu’il a lui-même écrit, sous réserve des composants tiers visés à l’article 8.",
      "Le client est responsable de l’usage de l’application, des données qu’il y saisit et du respect de la réglementation qui lui est applicable, notamment en matière de données personnelles.",
      "La responsabilité du prestataire est limitée aux dommages directs et plafonnée au montant effectivement perçu au titre de la présente convention, sauf faute lourde ou dolosive."),
    art(8, "Propriété intellectuelle",
      "L’application est une création protégée. Le simple paiement du prix des travaux ne transfère pas, à lui seul, la propriété des droits d’auteur : une **licence d’exploitation** (droit d’usage) se distingue d’une **cession de droits** (transfert de la titularité de droits énumérés), qui doit être expresse et délimitée.",
      rightsClause,
      cession && `**Rémunération de la cession.** La cession fait l’objet d’une rémunération distincte du prix des travaux, fixée à ${t(tm.cessionFee)}.`,
      "**Titulaire.** Les droits sont consentis ou cédés au client **désigné à la présente convention**. Ils ne sont pas présumés appartenir à une société future ou en cours de création : un éventuel transfert à une telle société suppose un accord écrit distinct, après sa constitution.",
      "**Droit moral.** Le prestataire conserve les prérogatives attachées à sa qualité d’auteur dans la mesure où elles sont inaliénables selon le droit applicable."),
    art(9, "Confidentialité",
      "Chaque partie garde confidentielles les informations non publiques reçues de l’autre (code source, données, documents commerciaux) et ne les utilise que pour l’exécution de la convention.",
      "Cette obligation dure cinq (5) ans après la fin de la convention et ne s’applique pas aux informations publiques ou dont la divulgation est imposée par la loi."),
    art(10, "Données personnelles", "Si l’application traite des données personnelles, le client est responsable du traitement et du respect de la réglementation qui lui est applicable."),
    art(11, "Durée, résiliation, effet",
      "La convention prend effet à la **date de la dernière signature** et reste en vigueur jusqu’à l’exécution complète des obligations des parties.",
      "En cas de manquement grave non corrigé trente (30) jours après mise en demeure écrite, l’autre partie peut résilier la convention, sans préjudice des sommes déjà dues."),
    art(12, "Droit applicable et règlement des litiges",
      `La convention est soumise au droit ${law}.`,
      "Les parties recherchent d’abord une solution amiable pendant trente (30) jours après notification écrite du différend.",
      `À défaut, compétence est attribuée à : ${t(tm.jurisdiction)}.`),
    art(13, "Dispositions générales", "La convention exprime l’accord complet des parties sur son objet. Toute modification est faite par écrit signé des deux parties. Si une clause est nulle, les autres restent valables. Elle est établie en deux (2) exemplaires originaux, ou signée électroniquement."),
    { t: "sig2", intro: "Fait en deux exemplaires, à la date indiquée sous chaque signature. La convention prend effet à la date de la dernière signature.", left: nomP, right: `${cli}${has(d.clientRepresentative) ? `, représenté par ${t(d.clientRepresentative)}` : ""}` },
  ];

  return {
    demande: { blocks: demande, header: ref ? `Demande de règlement — ${ref}` : "Demande de règlement" },
    convention: { blocks: convention, header: "Convention de constatation des travaux" },
    brand: nc,
  };
}

export type DocKind = "demande" | "convention";
export const DOC_FILENAMES: Record<DocKind, string> = { demande: "demande_reglement", convention: "convention_prestation" };

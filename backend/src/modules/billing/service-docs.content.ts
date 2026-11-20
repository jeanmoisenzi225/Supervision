/**
 * Documents de prestation (v0.42.0) : demande de règlement et convention de constatation des travaux.
 * Le contenu est décrit en blocs, rendus ensuite en PDF et en DOCX. Marqueurs : **gras**, ⟦zone à compléter⟧.
 * Règles : jamais de faux identifiant administratif, jamais de « facture », jamais d'antidatage.
 */
export type ServiceDocData = {
  appName: string; description: string; features: string[]; technologies: string; workNature: string; period: string; deliveryState: string; location: string;
  amount: number | null; currency: "EUR" | "XOF"; paymentTerms: string; paymentDue: string; paymentCoordinates: string;
  clientLegalForm: string; clientRepresentative: string; clientRole: string; place: string; reference: string; emissionDate: string | null;
  lines: { description: string; quantity: number; unitPrice: number }[];
  provider: { name: string; address: string; email: string; phone: string; brand: string };
  client: { name: string; address: string; rccm: string; ncc: string; email: string; phone: string };
};

export type Block =
  | { t: "title"; title: string; sub: string }
  | { t: "meta"; items: [string, string][] }
  | { t: "warn"; text: string }
  | { t: "h2"; text: string }
  | { t: "p"; text: string; small?: boolean }
  | { t: "list"; items: string[] }
  | { t: "cols"; left: [string, string[]]; right: [string, string[]] }
  | { t: "kv"; rows: [string, string][] }
  | { t: "amount"; rows: [string, string][]; total: string; note: string }
  | { t: "art"; n: number; title: string; items: (string | Block)[] }
  | { t: "sig1"; place: string; label: string; name: string }
  | { t: "sig2"; left: string; right: string }
  | { t: "foot"; text: string };

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function frDate(iso: string | null | undefined): string {
  const m = iso && /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  const day = Number(m[3]);
  return `${day}${day === 1 ? "er" : ""} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
export function formatAmount(amount: number | null, currency: "EUR" | "XOF"): string {
  if (amount == null) return `⟦montant à compléter⟧ ${currency === "EUR" ? "€" : "FCFA"}`;
  const n = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: currency === "EUR" ? 2 : 0, maximumFractionDigits: currency === "EUR" ? 2 : 0 }).format(amount).replace(/[  ]/g, " ");
  return currency === "EUR" ? `${n} €` : `${n} FCFA`;
}
const v = (x: string | null | undefined, label: string) => (x && x.trim() ? x.trim() : `⟦${label}⟧`);
const art = (n: number, title: string, ...items: (string | Block)[]): Block => ({ t: "art", n, title, items });

export function buildServiceDocs(d: ServiceDocData, today = new Date().toISOString().slice(0, 10)) {
  const p = d.provider, c = d.client, nc = p.brand || "NJMDev";
  // Les lignes (coûts des applis, repris de la facturation) alimentent le total tant qu'aucun montant n'est saisi à la main.
  const lines = (d.lines ?? []).filter((l) => l.description.trim());
  // Chaque ligne est arrondie comme elle est affichée (0 décimale en FCFA), puis additionnée : le total est toujours la somme de ce qu'on lit.
  const prec = d.currency === "XOF" ? 0 : 2;
  const roundTo = (n: number) => Math.round(n * 10 ** prec) / 10 ** prec;
  const lineAmounts = lines.map((l) => roundTo(l.quantity * l.unitPrice));
  const lineSum = roundTo(lineAmounts.reduce((t, x) => t + x, 0));
  const mont = formatAmount(d.amount ?? (lines.length ? lineSum : null), d.currency);
  const dateEm = frDate(d.emissionDate || today);
  const nomP = v(p.name, "nom et prénom du prestataire");
  const cli = v(c.name, "raison sociale du client");
  const app = v(d.appName, "nom de l'application");
  const ref = d.reference.trim() || "⟦référence à attribuer⟧";
  const refConv = d.reference.trim() ? d.reference.trim().replace(/^DR/i, "CV") : "⟦référence à attribuer⟧";
  const feat = d.features.filter((f) => f.trim()).length ? d.features.filter((f) => f.trim()) : ["⟦liste des fonctionnalités principales⟧"];
  const identPre = [
    `**${nomP}**, personne physique, agissant à titre personnel`,
    `Adresse : ${v(p.address, "adresse du prestataire (France)")}`,
    `Contact : ${[p.email, p.phone].filter(Boolean).join(" · ") || "⟦e-mail et téléphone⟧"}`,
    "Identifiants d’entreprise : néant à ce jour. Le prestataire n’exerce pas, à la date du document, par l’intermédiaire d’une société ou d’une entreprise immatriculée.",
  ];
  const identCli = [
    `**${cli}**, ${d.clientLegalForm.trim() || "⟦forme juridique⟧"}`,
    `Siège : ${v(c.address, "adresse du client, Côte d’Ivoire")}`,
    `RCCM : ${v(c.rccm, "RCCM, à fournir par le client")} · NCC : ${v(c.ncc, "NCC, à fournir par le client")}`,
    `Représentée par ${v(d.clientRepresentative, "nom du représentant")}, ${v(d.clientRole, "qualité")}`,
    ...([c.email, c.phone].filter(Boolean).length ? [[c.email, c.phone].filter(Boolean).join(" · ")] : []),
  ];
  const lieu = v(d.place, "lieu");
  const lineRows: [string, string][] = lines.map((l, i) => [l.quantity === 1 ? l.description : `${l.description} (× ${l.quantity})`, formatAmount(lineAmounts[i], d.currency)]);
  const gap = lines.length && d.amount != null && Math.abs(lineSum - d.amount) > 0.005;
  const gapNote = gap ? ` Le montant convenu diffère du total du détail (${formatAmount(lineSum, d.currency)}) : ⟦expliquer l’écart : remise, forfait, poste non détaillé⟧.` : "";
  const eur = d.currency === "EUR";

  const demande: Block[] = [
    { t: "title", title: "DEMANDE DE RÈGLEMENT", sub: "Prestation de développement informatique" },
    { t: "meta", items: [["Référence", ref], ["Date d’émission", dateEm], ["Objet", `Règlement de la prestation « ${app} »`]] },
    { t: "warn", text: "Ce document est une **demande de règlement**. Il **n’est pas une facture fiscale** : il ne comporte ni numéro de facture, ni TVA, et ne tient pas lieu de facture au sens de la réglementation fiscale. Il ne vaut pas, à lui seul, reconnaissance de dette ni titre de créance exigible ; les droits et obligations des parties sont ceux qui résultent de leur accord écrit (voir la convention de constatation des travaux, jointe ou à venir)." },
    { t: "h2", text: "1. Parties" },
    { t: "cols", left: ["Prestataire", identPre], right: ["Client destinataire", identCli] },
    { t: "h2", text: "2. Prestation concernée" },
    { t: "p", text: `Application : **${app}**.` },
    { t: "p", text: v(d.description, "description détaillée de l’application : finalité, utilisateurs, périmètre") },
    { t: "p", text: "**Fonctionnalités principales**" },
    { t: "list", items: feat },
    { t: "p", text: `**Environnement technique** : ${v(d.technologies, "technologies utilisées")}.` },
    { t: "h2", text: "3. Nature des travaux réalisés" },
    { t: "p", text: v(d.workNature, "nature des travaux : conception, développement, tests, mise en ligne, etc.") },
    { t: "p", text: `Période de réalisation : ${v(d.period, "période de réalisation")}. État à ce jour : ${v(d.deliveryState, "état de livraison")}.` },
    { t: "h2", text: "4. Montant demandé" },
    { t: "amount", rows: lines.length ? lineRows : [[`Prestation de développement informatique « ${app} »`, mont]], total: mont,
      note: `${lines.length ? "Détail indicatif des composants et coûts, tels que relevés pour l’application. " : ""}Montant convenu entre les parties ⟦confirmer la date et la forme de cet accord⟧. Montant net, sans TVA : le prestataire n’est pas, à ce jour, assujetti à la TVA au titre de cette activité ⟦à faire valider⟧.${eur ? "" : " Montant exprimé en francs CFA : ⟦préciser la zone monétaire (XOF ou XAF)⟧."}${gapNote}` },
    { t: "h2", text: "5. Modalités et coordonnées de paiement" },
    { t: "kv", rows: [["Mode de paiement", v(d.paymentTerms, "mode de paiement")], ["Échéance", v(d.paymentDue, "échéance de paiement")], ["Coordonnées de paiement", v(d.paymentCoordinates, "IBAN / BIC ou autre moyen de paiement")], ["Libellé à indiquer", ref]] },
    { t: "p", text: "Les frais bancaires, notamment de virement international et de conversion de devise, sont à la charge de ⟦partie à préciser⟧." },
    { t: "h2", text: "6. Observations" },
    { t: "p", text: "Cette demande est adressée au client pour permettre le règlement amiable de la prestation. Toute question ou contestation peut être adressée au prestataire aux coordonnées ci-dessus." },
    { t: "sig1", place: `Fait à ${lieu}, le ${dateEm}`, label: "Le prestataire", name: nomP },
    { t: "foot", text: `Visuel de présentation « ${nc} » : nom commercial et identité graphique du prestataire, sans valeur d’immatriculation. ${nc} n’est pas une société.` },
  ];

  const droits: string[] = [
    "**Option A : licence d’exploitation (par défaut).** Le prestataire reste titulaire de l’ensemble des droits de propriété intellectuelle sur l’application, son code source et sa documentation. Il concède au client une licence ⟦non exclusive / exclusive⟧, ⟦incessible / cessible avec accord écrit⟧, pour le territoire ⟦territoire⟧, pour la durée ⟦durée⟧, limitée à l’usage interne du client et à l’exploitation de l’application pour ses besoins propres, à l’exclusion de toute revente ou sous-licence sauf accord écrit.",
    "**Option B : cession de droits.** Le prestataire cède au client, à titre ⟦exclusif / non exclusif⟧, les droits patrimoniaux suivants, chacun étant énuméré et délimité : droit de reproduction ; droit de représentation ; droit d’adaptation, de modification et de traduction ; droit de mise sur le marché et de distribution ; ⟦autres droits à lister⟧. Étendue : ⟦fonctionnalités et supports concernés⟧. Territoire : ⟦territoire⟧. Durée : ⟦durée⟧. Destination : ⟦usages autorisés⟧.",
    "La cession n’est effective qu’à compter du **paiement intégral du prix convenu** et de la signature de la présente convention, sous réserve des mentions requises par le droit applicable. Elle ne porte pas sur les composants tiers et logiciels libres, qui restent soumis à leurs licences propres, ni sur les savoir-faire, outils, bibliothèques et composants génériques préexistants du prestataire, réutilisables pour d’autres projets.",
  ];

  const convention: Block[] = [
    { t: "title", title: "CONVENTION DE CONSTATATION DES TRAVAUX", sub: "et de régularisation contractuelle" },
    { t: "meta", items: [["Référence", refConv], ["Prend effet", "à la date de la dernière signature, sans rétroactivité"], ["Objet", `Application « ${app} »`]] },
    { t: "warn", text: "**Projet de convention à faire valider avant signature.** Les zones surlignées sont à compléter par les parties. Les points signalés « ⚠ Validation » nécessitent l’avis d’un juriste ou d’un fiscaliste (France et Côte d’Ivoire) avant signature ou paiement. Aucun identifiant administratif n’a été inventé." },
    { t: "h2", text: "ENTRE LES SOUSSIGNÉS" },
    { t: "cols", left: ["Le prestataire", identPre], right: ["Le client", identCli] },
    { t: "p", text: "Ci-après désignés ensemble « les parties » et séparément « le prestataire » et « le client »." },
    { t: "h2", text: "PRÉAMBULE" },
    { t: "p", text: `Le prestataire a réalisé, à la demande du client et avant la signature de la présente convention, des travaux de développement informatique relatifs à l’application « ${app} ». À la date de la signature, aucun contrat écrit n’avait été conclu entre les parties. Elles souhaitent constater ces travaux, fixer par écrit les conditions de leur rémunération et régler la question des droits de propriété intellectuelle. ${nc} est le nom commercial et l’identité visuelle utilisés par le prestataire ; ce n’est pas une personne morale.` },
    art(1, "Objet", "La présente convention a pour objet : (a) de constater les travaux déjà réalisés par le prestataire pour le client ; (b) de fixer la rémunération convenue et ses modalités de paiement ; (c) de définir les conditions de livraison et de réception ; (d) de régler les droits de propriété intellectuelle sur l’application."),
    art(2, "Constatation des travaux réalisés",
      `2.1. Les parties constatent que le prestataire a réalisé les travaux suivants : ${v(d.workNature, "nature des travaux").replace(/\.$/, "")}.`,
      `2.2. Période de réalisation : ${v(d.period, "période de réalisation")}.`,
      "2.3. Cette constatation est faite à la date de signature. Elle ne vaut pas conclusion rétroactive d’un contrat ; la convention **produit ses effets à compter de la date de la dernière signature**. Les parties reconnaissent néanmoins la réalité des travaux antérieurs décrits ci-dessus ⟦le client confirme-t-il les avoir demandés et reçus ?⟧.",
      "⚠ Validation : conséquences fiscales et comptables, pour chaque partie, de la constatation de travaux antérieurs à la convention."),
    art(3, "Description de l’application",
      `3.1. Application : **${app}**. ${v(d.description, "description fonctionnelle : finalité, utilisateurs, périmètre")}`,
      "3.2. Fonctionnalités principales :", { t: "list", items: feat },
      `3.3. Description technique : ${v(d.technologies, "technologies, hébergement, bases de données, services tiers")}. Localisation : ${v(d.location, "adresse de l’application ou du dépôt de code")}.`,
      "3.4. L’application comprend le code source ⟦oui / non, à préciser⟧, la documentation ⟦oui / non⟧ et les accès d’administration ⟦à préciser⟧."),
    art(4, "Rémunération",
      `4.1. Les parties conviennent d’une rémunération forfaitaire de **${mont}**, nette de TVA ⟦à faire valider⟧, pour les travaux constatés à l’article 2.`,
      `4.2. En lettres : ⟦montant en lettres⟧ ${eur ? "euros" : "francs CFA"}.`,
      "4.3. Ce montant rémunère les travaux de développement. **Il ne rémunère pas la cession de droits d’auteur**, qui, si elle est retenue à l’article 8, fait l’objet d’une rémunération distincte précisée à cet article.",
      ...(lines.length ? [`4.4. Détail indicatif des composants et coûts constatés pour l’application :`, { t: "list", items: lineRows.map(([a, b]) => `${a} : ${b}`) } as Block, ...(gap ? [`Le montant convenu diffère du total de ce détail (${formatAmount(lineSum, d.currency)}) : ⟦expliquer l’écart⟧.`] : [])] : []),
      "⚠ Validation : régime fiscal applicable (France et Côte d’Ivoire), retenue à la source éventuelle, convention fiscale, déclaration des revenus en France."),
    art(5, "Modalités de paiement",
      `5.1. Paiement par ${v(d.paymentTerms, "mode de paiement")}, à l’échéance suivante : ${v(d.paymentDue, "échéance")}.`,
      `5.2. Coordonnées de paiement : ${v(d.paymentCoordinates, "coordonnées bancaires")}.`,
      `5.3. Devise de paiement : ${eur ? "euro (EUR)" : "franc CFA (FCFA)"}. Les frais bancaires et de change sont supportés par ⟦partie à préciser⟧.`,
      "5.4. En cas de retard, des pénalités de ⟦taux à fixer⟧ pourront s’appliquer après mise en demeure écrite. ⚠ Validation : conformité de ce taux au droit applicable."),
    art(6, "Livraison et réception",
      `6.1. Livraison : ${v(d.deliveryState, "état de livraison de l’application")}.`,
      "6.2. Le client dispose de ⟦nombre⟧ jours à compter de la signature pour formuler par écrit ses réserves motivées sur la conformité de l’application à la description de l’article 3. À défaut, l’application est réputée reçue.",
      "6.3. Le prestataire corrige les anomalies de conformité signalées dans ce délai, dans un délai raisonnable. La maintenance évolutive ou corrective ultérieure n’est pas incluse et fait l’objet d’un accord distinct."),
    art(7, "Garanties et responsabilités",
      "7.1. Le prestataire est tenu d’une obligation de moyens. Il garantit qu’il détient les droits sur le code qu’il a lui-même écrit, sous réserve des composants tiers visés à l’article 8.",
      "7.2. Le client est responsable de l’usage de l’application, des données qu’il y saisit et du respect de la réglementation qui lui est applicable, notamment en matière de données personnelles.",
      "7.3. La responsabilité du prestataire est limitée aux dommages directs et plafonnée au montant effectivement perçu au titre de la présente convention, sauf faute lourde ou dolosive. ⚠ Validation : opposabilité de cette limitation selon le droit applicable."),
    art(8, "Propriété intellectuelle",
      "8.1. **Principe.** L’application est une création protégée. Le simple paiement du prix des travaux ne transfère pas, à lui seul, la propriété des droits d’auteur : une **licence d’exploitation** (droit d’usage) se distingue d’une **cession de droits** (transfert de la titularité de droits énumérés), qui doit être expresse et délimitée. Les parties choisissent l’une des options ci-dessous ⟦cocher : [ ] A   [ ] B⟧.",
      ...droits,
      "8.2. **Rémunération de la cession (option B).** La cession fait l’objet d’une rémunération distincte, fixée à ⟦montant forfaitaire ou proportionnel, base de calcul⟧, payable ⟦modalités⟧. À défaut d’accord sur ce point, l’option A s’applique.",
      "8.3. **Titulaire.** Les droits sont consentis ou cédés au client **désigné à la présente convention**. Ils ne sont pas présumés appartenir à une société future ou en cours de création : un éventuel transfert à une telle société suppose un accord écrit distinct, après sa constitution.",
      "8.4. **Droit moral.** Le prestataire conserve les prérogatives attachées à sa qualité d’auteur dans la mesure où elles sont inaliénables selon le droit applicable.",
      "8.5. **Code source.** La remise du code source ⟦est / n’est pas⟧ comprise ; le client ne peut le modifier qu’à titre ⟦préciser⟧.",
      "⚠ Validation : conditions de forme de la cession, rémunération, mentions obligatoires et droit applicable aux droits d’auteur (français et ivoirien) ; titularité des droits en cas de futur transfert à une société."),
    art(9, "Confidentialité",
      "9.1. Chaque partie garde confidentielles les informations non publiques reçues de l’autre (code source, données, documents commerciaux) et ne les utilise que pour l’exécution de la convention.",
      "9.2. Cette obligation dure ⟦durée⟧ après la fin de la convention et ne s’applique pas aux informations publiques ou dont la divulgation est imposée par la loi."),
    art(10, "Données personnelles", "Si l’application traite des données personnelles, le client est responsable du traitement et du respect de la réglementation qui lui est applicable. ⚠ Validation : réglementation ivoirienne (protection des données) et, le cas échéant, européenne."),
    art(11, "Durée, résiliation, effet",
      "11.1. La convention prend effet à la **date de la dernière signature** et reste en vigueur jusqu’à l’exécution complète des obligations des parties.",
      "11.2. En cas de manquement grave non corrigé ⟦nombre⟧ jours après mise en demeure écrite, l’autre partie peut résilier la convention, sans préjudice des sommes déjà dues."),
    art(12, "Droit applicable et règlement des litiges",
      "12.1. La convention est soumise au droit ⟦français / ivoirien : à choisir par les parties⟧.",
      "12.2. Les parties recherchent d’abord une solution amiable pendant ⟦nombre⟧ jours après notification écrite du différend.",
      "12.3. À défaut, compétence ⟦juridiction ou mode d’arbitrage⟧.",
      "⚠ Validation : choix de la loi et de la juridiction entre deux pays, exécution d’une décision à l’étranger, clause d’arbitrage éventuelle."),
    art(13, "Dispositions générales", "La convention exprime l’accord complet des parties sur son objet. Toute modification est faite par écrit signé des deux parties. Si une clause est nulle, les autres restent valables. Elle est établie en ⟦nombre⟧ exemplaires originaux, ou signée électroniquement."),
    { t: "sig2", left: nomP, right: `${cli}, représenté par ${v(d.clientRepresentative, "représentant")}` },
  ];

  return {
    demande: { blocks: demande, header: `Demande de règlement — ${d.reference.trim() || "à référencer"}` },
    convention: { blocks: convention, header: "Convention de constatation des travaux — projet à valider avant signature" },
    brand: nc,
  };
}

export type DocKind = "demande" | "convention";
export const DOC_FILENAMES: Record<DocKind, string> = { demande: "demande_reglement", convention: "convention_prestation" };

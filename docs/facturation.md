# Module Facturation NJMDev

> Depuis la v0.20.0, la facturation est un **module à part entière de NJMDev**, « NJM Facturation » (`/facturation`, carte du menu général), au même titre que NJM Supervision. La page de coûts par appli, utilisée pour les factures prévisionnelles, reste dans NJM Supervision sous le nom « Coûts ».

## Intention et périmètre

Le module Facturation est un espace privé de Supervision destiné à gérer les clients, préparer les factures, produire les documents PDF et suivre les règlements de l'activité NJMDev. Il s'agit d'un module interne au super-administrateur, pas d'une fonctionnalité multi-tenant vendue aux applications surveillées.

La marque commerciale NJMDev peut être configurée dès maintenant. Elle est volontairement séparée de l'identité juridique du vendeur : aucune nom légal de l’entrepreneur, forme juridique, adresse officielle en Côte d’Ivoire, RCCM, NCC et régime de TVA ne doit être inventée.

## États et garde-fous

- **Brouillon** : modifiable, sans numéro officiel ; aperçu A4 et génération PDF côté serveur à la demande. Le PDF est téléchargé directement par le navigateur, clairement marqué « BROUILLON », puis n’est pas conservé par le serveur.
- **Émise** : uniquement lorsque le profil juridique est complet et validé ; numéro attribué à l'émission dans une transaction atomique.
- **Payée / partiellement payée / en retard** : états calculés à partir des règlements et de l'échéance.
- Une facture émise ne se modifie pas et son numéro n'est jamais réutilisé. Une correction ultérieure passe par le document rectificatif approprié.
- Les données du vendeur et du client sont figées dans un instantané au moment de l'émission.
- Les calculs définitifs sont effectués côté serveur avec des décimales exactes ; l'interface n'est qu'un aperçu.
- Aucun fichier PDF n’est actuellement archivé : ni stockage objet, ni système de fichiers Render. Un éventuel archivage des documents officiellement émis fera l’objet d’une décision et d’une évolution séparées.

## Parcours cible

1. Configurer les éléments commerciaux NJMDev.
2. Créer une fiche client.
3. Saisir une facture avec dates, lignes, quantités, prix unitaires HT, remises et TVA.
4. Enregistrer en brouillon, vérifier l’aperçu A4 et télécharger le PDF de travail généré à la demande.
5. Compléter le profil juridique et les mentions requises avant toute émission.
6. Émettre et numéroter après validation réglementaire ; l’archivage PDF n’est pas activé dans le périmètre actuel.
7. Suivre les règlements et, ultérieurement, envoyer le document par e-mail.

## Architecture cible

- API Express protégée par `requireAdmin`, sous un préfixe dédié `/api/billing`.
- Modèles Prisma dédiés : profil de facturation, clients, factures, lignes, règlements et événements.
- Migration PostgreSQL versionnée.
- Calculs et transitions d'état validés côté serveur.
- Aperçu A4 rendu côté navigateur ; export PDF par la fonction d'impression du navigateur pour les seuls brouillons.
- La génération PDF serveur et le stockage objet durable restent à mettre en place avant toute émission officielle ; aucun fichier local Render ne sera considéré comme archive.
- Envoi e-mail et connecteur de plateforme agréée séparés du cœur métier pour pouvoir changer de fournisseur.

## Cadre NJMDev en Côte d’Ivoire

NJMDev est prévu comme nom commercial d’une entreprise individuelle ivoirienne. Le vendeur légal sera la personne physique exploitante ; le nom commercial ne constitue pas une personne morale distincte. La devise par défaut est le franc CFA BCEAO (XOF), avec prise en charge de devises étrangères pour les clients internationaux. Le profil distingue RCCM, NCC, régime fiscal et régime de TVA. Aucun taux ni régime fiscal n’est présumé : ces paramètres seront renseignés après confirmation auprès de la DGI ou d’un conseil local.

Les factures officielles devront suivre les exigences DGI/FNE effectivement applicables à l’entreprise individuelle et à son régime. Le module ne génère pas de numéro officiel ni de QR code de certification de sa propre initiative. Les brouillons restent clairement identifiés comme tels.

L’activité est déclarée comme exploitée depuis la Côte d’Ivoire. La résidence personnelle du propriétaire en France justifie néanmoins une validation fiscale transfrontalière distincte avant le démarrage commercial.

## Facture prévisionnelle (v0.19.0)

Décision du propriétaire (2026-11-12) : à partir des coûts de la page « Coûts », on établit pour chaque client une **facture prévisionnelle**, puis la **facture définitive** une fois que Render a facturé.

- **Rattachement** : la fiche client indique les applis dont l'hébergement lui est facturé (`BillingClient.appKeys`, clés du catalogue plus `njmdev`).
- **Import** : « Importer l'hébergement du client » (route `POST /api/billing/forecast-lines`) reprend, **tels quels**, les postes de la page « Coûts » des applis du client : une ligne par service, base, stockage (postes gratuits non repris), et, en option, les dépenses Claude du mois en cours, **cumulées en une ligne par appli** (ses espaces de travail Anthropic additionnés, v0.25.0). Montants convertis dans la devise du document, car Render facture en dollars. **Règle de conversion** (décision du propriétaire, 2026-11-12) : **taux de marché** par défaut (v0.21.0), réglable dans Paramètres (« Conversion des coûts ») pour appliquer à la place la **parité commerciale 1 $ = 1 €** (655,957 FCFA pour 1 $, v0.22.0, essayée puis abandonnée comme réglage par défaut). Taux de marché : taux de référence de la BCE (Frankfurter, fichier du jour de la BCE en secours) à la date du document ; le franc CFA se déduit de l'euro par la parité fixe 1 € = 655,957 FCFA. Le taux reste modifiable (bouton « Reprendre le taux du marché ») ; un taux saisi à plus de 50 % du marché est signalé à l'écran et refusé par le serveur (erreur d'unité, par exemple 655,957 saisi pour des euros). Le taux d'une facture enregistrée est conservé (`usdRate`). Un poste d'offre inconnue est signalé, jamais inventé.
- **Recalcul automatique** (v0.23.0) : une ligne importée garde son montant d'origine en dollars (`usdAmount`) ; si l'on change le taux ou la devise, ses prix sont recalculés aussitôt et le total en bas suit. Une ligne dont on modifie le prix à la main n'est plus recalculée (« prix modifié à la main »).
- **Lignes modifiables** : les lignes importées sont des lignes ordinaires (description, quantité, prix, remise, TVA) que l'on peut corriger ou retirer ; elles portent leur origine (`source` : `hosting`, `claude`, `free`). Un nouvel import remplace les lignes importées et garde les autres.
- **Lignes libres** : coûts de développement, main d'œuvre, messagerie e-mail, support… saisies à la main (raccourcis dans la saisie).
- **Nature du document** : `kind` = `forecast` (facture prévisionnelle, par défaut) ou `draft` (brouillon de facture) ; mois concerné (`period`) et taux utilisé (`usdRate`) conservés. L'aperçu A4 et le PDF portent « PRÉVISIONNELLE », la référence `PREVISION-…` et la mention « montants estimés, la facture définitive sera établie après la facturation par l'hébergeur ». Toujours aucun numéro officiel ni certification FNE.

## Phase initiale

La première phase doit rendre utilisables les clients et les brouillons, avec calculs et aperçu. Tant que l'identité juridique n'est pas renseignée, l'interface doit afficher explicitement que l'émission officielle est désactivée. Les factures de démonstration ne doivent jamais recevoir de numéro ressemblant à un numéro officiel.

## Dossiers de prestation (v0.44.0)

Onglet « Prestations » : une saisie (`BillingServiceDoc`, routes `/api/billing/service-docs`) produit deux documents téléchargeables en PDF et en Word (`GET /service-docs/:id/{demande|convention}.{pdf|docx}`), générés à la demande et jamais conservés.

- **Demande de règlement** : explicitement « pas une facture fiscale », sans numéro de facture ni TVA, sans valeur de titre de créance.
- **Convention de constatation des travaux** : prend effet à la dernière signature (jamais antidatée) ; constate les travaux antérieurs ; propriété intellectuelle en deux options (licence d'exploitation par défaut, cession délimitée avec rémunération distincte) ; titularité non présumée au profit d'une future société ; confidentialité, responsabilités, droit applicable.
- **Prestataire** : repris du profil de facturation (Paramètres, rubrique « Prestataire ») ; statut « Personne physique » possible. **Client** : fiche client. Tout champ vide devient une zone surlignée « à compléter » ; aucun identifiant administratif n'est inventé.
- **Technique** : contenu en blocs (`service-docs.content.ts`), rendu PDF (`pdfkit`, police Inter dans `backend/assets/fonts`) et Word (`docx`). Logo : `backend/assets/logo-njmdev.png`.
- **Validation** : les points « ⚠ Validation » (fiscalité France et Côte d'Ivoire, droits d'auteur, loi et juridiction) sont à faire valider avant signature ou paiement.
- **Composants et coûts (v0.46.0)** : le dossier peut porter un détail `lines` (`{description, quantity, unitPrice}`), importé par `POST /billing/forecast-lines` (même source que la facture prévisionnelle : coûts Render et Claude des applis du client, convertis dans la devise du dossier) ou saisi à la main. Le détail figure dans la demande de règlement et à l'article 4.4 de la convention ; un écart avec le montant convenu est signalé dans le document.
- **Total automatique (v0.46.2)** : sans montant saisi, le total des documents est la somme des lignes, chacune arrondie à la précision de la devise (0 décimale en FCFA). Les coûts du client sont repris à l'ouverture d'un nouveau dossier et reconvertis au changement de devise.
- **Remplissage initial du profil (v0.46.3)** : variable d'environnement `BILLING_PROFILE_SEED` (JSON, champs `legalName`, `legalForm`, `businessAddress`, `contactEmail`, `phone`), lue au démarrage ; elle complète les champs vides du profil et n'écrase jamais une saisie. À retirer une fois le profil renseigné.
- **Documents finaux (v0.47.0)** : aucune zone à compléter dans les PDF et Word : une information absente supprime sa ligne ou sa phrase. Les clauses de la convention viennent du dossier (`terms` : loi, juridiction, licence ou cession, exclusivité, territoire, durée, rémunération de la cession, pénalités, frais bancaires, code source) avec des valeurs par défaut ; le montant est écrit en lettres. `GET /service-docs/:id/{demande|convention}.{pdf|docx}` répond 409 si une information indispensable manque (identité, montant, loi applicable, juridiction, rémunération d'une cession).

## Signature électronique des documents de prestation (v0.48.0)

Signature **simple**, sans service d'e-mail : l'émetteur transmet lui-même le lien et le code.

- **Demande** : `POST /api/billing/service-docs/:id/signature-requests` (`kind` = `demande` ou `convention`). Génère le document final, le **fige** (PDF + SHA-256) et crée deux signataires (prestataire et client). Le lien (`/signer/<jeton>`) et le code à 6 chiffres sont renvoyés **une seule fois** ; seules leurs empreintes sont stockées (jeton : SHA-256 ; code : HMAC-SHA-256 avec `JWT_SECRET`). Une seule demande en cours par document ; validité 30 jours.
- **Page publique** : `POST /api/sign/:jeton/open` puis `/sign`, montées **avant** les routeurs protégés de `/api`, limitées à 60 appels par 15 minutes et par adresse (compteur en mémoire, non conservé). Le code est exigé à chaque appel ; 5 mauvais codes bloquent le signataire (nouveau lien et code par `POST /signature-requests/:id/signers/:signerId/reset`).
- **Signature** : nom complet, tracé PNG contrôlé (signature du fichier, taille), case de consentement. Sont journalisés : date, nom saisi, tracé, **adresse IP et navigateur** (v0.48.2). Ces traces techniques restent **en base, jamais sur les documents** (ni certificat ni PDF signé) ; l'administration les expose dans le journal de preuve (`GET /signature-requests/:id/proof`, JSON). Le signataire en est informé par le texte de consentement. Durée de conservation à fixer (voir l'étude).
- **Finalisation** : au dernier signataire, une page de **certificat** (pdfkit) est ajoutée au PDF figé (`pdf-lib`) ; `signedPdf` et `signedSha256` sont stockés en base (octets). Téléchargements : `GET /signature-requests/:id/{signed|original}.pdf`.
- **Limites** : preuve de niveau « signature simple » (identification par lien et code, pas de vérification d'identité) ; pas d'archivage hors base ; un dossier qui a des demandes de signature ne peut pas être supprimé. Pour une valeur probante renforcée, passer par un prestataire de signature agréé.
- **Suivi et confirmation (v0.49.0)** : onglet « Signatures » (`GET /api/billing/signature-requests`, liste des 50 dernières demandes, rafraîchie toutes les 15 s) ; page de signature avec écran de confirmation ; notification push à chaque signature (`sendPushToAll`, url `/facturation`). La création d'une demande se fait depuis « Prestations » et mène à l'onglet Signatures.
- **Deux signataires et signature dans le document (v0.49.1)** : les deux documents sont signés par le prestataire et le client (la demande : « bon pour accord »). Le moteur PDF mémorise l'emplacement de chaque cadre (`BillingSignRequest.boxes`) ; à la finalisation, `pdf-lib` y pose la mention « Signé électroniquement le … », le nom et le tracé, puis ajoute la page de certificat. L'empreinte enregistrée reste celle du document soumis aux signataires.
- **Suppression (v0.49.1, raccourcis retirés en v0.49.2)** : `DELETE /signature-requests/:id` supprime une demande et ses preuves (irréversible, confirmation côté interface). Une signature atteste d'un document précis (empreinte) : elle n'est jamais reportée sur une version modifiée, il faut supprimer et refaire. Aucune signature rapide : chaque signataire, émetteur compris, passe par son lien et son code.
- **Hébergement sur une ligne (v0.49.5)** : dans la demande et la convention, les lignes d'hébergement d'une appli (`source` = `hosting`, ou intitulé « … — hébergement : … ») sont regroupées en une ligne « Hébergement <appli> » dont le montant est la somme des postes arrondis, avec le détail des postes dans la ligne ; l'IA (`claude`) et les lignes libres restent chacune sur leur ligne. `lines[].source` est conservé dans le dossier. Sans origine enregistrée, l'intitulé est examiné (hébergement, serveur de l'application, base de données, espace de stockage) ; le sélecteur « Hébergement / Autre ligne » du dossier prime sur cette déduction. Le titre du groupe est « Hébergement » suivi du nom de l'appli (préfixe de l'intitulé, sinon nom de l'appli du dossier).
- **Intitulés clairs à l'import (v0.49.6)** : `forecastLines` produit des intitulés lisibles par le client (serveur de l'application, base de données, espace de stockage, traitements automatisés par intelligence artificielle) ; le nom technique (service, base, offre, espaces de travail Claude) est conservé dans `tech`, affiché dans l'application et **jamais imprimé**. `lines[].tech` est mémorisé dans le dossier. Les dossiers existants gardent leurs intitulés.

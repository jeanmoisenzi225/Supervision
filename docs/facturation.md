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
- **Import** : « Importer l'hébergement du client » (route `POST /api/billing/forecast-lines`) reprend, **tels quels**, les postes de la page « Coûts » des applis du client : une ligne par service, base, stockage (postes gratuits non repris), et, en option, les dépenses Claude du mois en cours par espace de travail. Montants convertis dans la devise du document, car Render facture en dollars. **Règle de conversion** (décision du propriétaire, 2026-11-12) : **parité commerciale 1 $ = 1 €** par défaut, soit 655,957 FCFA pour 1 $ (parité fixe de l'euro) ; réglable dans Paramètres (« Conversion des coûts ») pour reprendre à la place le **taux de marché** (v0.21.0) : taux de référence de la BCE (Frankfurter, fichier du jour de la BCE en secours) à la date du document ; le franc CFA se déduit de l'euro par la parité fixe 1 € = 655,957 FCFA. Le taux reste modifiable (bouton « Reprendre le taux du marché ») ; un taux saisi à plus de 50 % du marché est signalé à l'écran et refusé par le serveur (erreur d'unité, par exemple 655,957 saisi pour des euros). Le taux d'une facture enregistrée est conservé (`usdRate`). Un poste d'offre inconnue est signalé, jamais inventé.
- **Lignes modifiables** : les lignes importées sont des lignes ordinaires (description, quantité, prix, remise, TVA) que l'on peut corriger ou retirer ; elles portent leur origine (`source` : `hosting`, `claude`, `free`). Un nouvel import remplace les lignes importées et garde les autres.
- **Lignes libres** : coûts de développement, main d'œuvre, messagerie e-mail, support… saisies à la main (raccourcis dans la saisie).
- **Nature du document** : `kind` = `forecast` (facture prévisionnelle, par défaut) ou `draft` (brouillon de facture) ; mois concerné (`period`) et taux utilisé (`usdRate`) conservés. L'aperçu A4 et le PDF portent « PRÉVISIONNELLE », la référence `PREVISION-…` et la mention « montants estimés, la facture définitive sera établie après la facturation par l'hébergeur ». Toujours aucun numéro officiel ni certification FNE.

## Phase initiale

La première phase doit rendre utilisables les clients et les brouillons, avec calculs et aperçu. Tant que l'identité juridique n'est pas renseignée, l'interface doit afficher explicitement que l'émission officielle est désactivée. Les factures de démonstration ne doivent jamais recevoir de numéro ressemblant à un numéro officiel.

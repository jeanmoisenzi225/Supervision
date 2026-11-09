# Module Facturation NJMDev

## Intention et périmètre

Le module Facturation est un espace privé de Supervision destiné à gérer les clients, préparer les factures, produire les documents PDF et suivre les règlements de l'activité NJMDev. Il s'agit d'un module interne au super-administrateur, pas d'une fonctionnalité multi-tenant vendue aux applications surveillées.

La marque commerciale NJMDev peut être configurée dès maintenant. Elle est volontairement séparée de l'identité juridique du vendeur : aucune raison sociale, forme juridique, adresse officielle, immatriculation ou situation de TVA ne doit être inventée.

## États et garde-fous

- **Brouillon** : modifiable, sans numéro officiel ; aperçu PDF clairement marqué « BROUILLON ».
- **Émise** : uniquement lorsque le profil juridique est complet et validé ; numéro attribué à l'émission dans une transaction atomique.
- **Payée / partiellement payée / en retard** : états calculés à partir des règlements et de l'échéance.
- Une facture émise ne se modifie pas et son numéro n'est jamais réutilisé. Une correction ultérieure passe par le document rectificatif approprié.
- Les données du vendeur et du client sont figées dans un instantané au moment de l'émission.
- Les calculs définitifs sont effectués côté serveur avec des décimales exactes ; l'interface n'est qu'un aperçu.
- Les PDF définitifs doivent être stockés dans un stockage durable. Le système de fichiers local du service Render n'est pas un stockage pérenne.

## Parcours cible

1. Configurer les éléments commerciaux NJMDev.
2. Créer une fiche client.
3. Saisir une facture avec dates, lignes, quantités, prix unitaires HT, remises et TVA.
4. Enregistrer en brouillon et vérifier l'aperçu.
5. Compléter le profil juridique et les mentions requises avant toute émission.
6. Émettre, numéroter, figer les données et archiver le PDF.
7. Suivre les règlements et, ultérieurement, envoyer le document par e-mail.

## Architecture cible

- API Express protégée par `requireAdmin`, sous un préfixe dédié `/api/billing`.
- Modèles Prisma dédiés : profil de facturation, clients, factures, lignes, règlements et événements.
- Migration PostgreSQL versionnée.
- Calculs et transitions d'état validés côté serveur.
- Génération PDF côté serveur ; stockage objet durable à sélectionner avant d'activer l'émission.
- Envoi e-mail et connecteur de plateforme agréée séparés du cœur métier pour pouvoir changer de fournisseur.

## Phase initiale

La première phase doit rendre utilisables les clients et les brouillons, avec calculs et aperçu. Tant que l'identité juridique n'est pas renseignée, l'interface doit afficher explicitement que l'émission officielle est désactivée. Les factures de démonstration ne doivent jamais recevoir de numéro ressemblant à un numéro officiel.

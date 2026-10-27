# Journal des versions

## v0.1.0 — 2026-10-27

Première version de la Supervision.

- Tableau de bord des cinq projets (MGA · My Autonova, site Autonova, Yiri Invest, My Family, Procedia) : état, temps de réponse, disponibilité sur 24 h, alertes et erreurs du jour.
- Vérification automatique des adresses (1 min pour MGA et Yiri, 5 min pour le site, 30 min pour Procedia en offre gratuite), bouton « Vérifier maintenant ».
- Alertes : panne après 2 échecs consécutifs, fermeture automatique au retour, erreurs et alertes métier envoyées par les applis, regroupement des répétitions, prise en compte et résolution manuelles.
- Notifications push des alertes sur le téléphone (PWA).
- Réception des journaux par appli (jeton propre à chaque appli), consultation avec filtres, recherche et mode en direct ; conservation 30 jours.
- Administration : redémarrage et redéploiement des services Render, protocole d'actions propres à chaque appli avec chiffres clés, historique des actions.
- Modules d'envoi à copier : Node (`clients/node`) et Python (`clients/python`).

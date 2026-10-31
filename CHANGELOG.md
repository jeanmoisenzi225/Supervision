# Journal des versions

## v0.1.2 — 2026-10-31

Module d'envoi Node (`clients/node/supervision.ts`), utilisé par MGA v0.87.0 :

- `mirrorConsole()` : recopie `console.log` / `info` / `warn` / `error` vers la supervision, le préfixe « [module] » devenant la source du journal.
- `captureProcessErrors()` : une promesse rejetée non gérée arrête désormais le processus comme le fait Node par défaut (au lieu de le laisser tourner), après envoi du journal ; l'arrêt demandé par l'hébergeur (SIGTERM) est journalisé.
- Tests du module (envoi par lots, silence sans configuration, conservation si la supervision est injoignable).

## v0.1.1 — 2026-10-31

Mise en ligne simplifiée : plus aucune clé à copier dans Render.

- L'interface est servie par l'API elle-même : un seul service Render, une seule adresse, plus de `VITE_API_URL` ni de `CORS_ORIGIN` à recopier entre deux services.
- Les clés des notifications sont générées au premier démarrage et gardées en base (nouvelle table `Setting`) : plus de `VAPID_*` à saisir. Le sujet des notifications est l'adresse publique Render (https) ou, à défaut, l'e-mail du super administrateur.
- Un problème de notifications n'empêche plus jamais le serveur de démarrer.
- Seules valeurs demandées à la création du Blueprint : `ADMIN_EMAIL` et `ADMIN_PASSWORD`.

## v0.1.0 — 2026-10-27

Première version de la Supervision.

- Tableau de bord des cinq projets (MGA · My Autonova, site Autonova, Yiri Invest, My Family, Procedia) : état, temps de réponse, disponibilité sur 24 h, alertes et erreurs du jour.
- Vérification automatique des adresses (1 min pour MGA et Yiri, 5 min pour le site, 30 min pour Procedia en offre gratuite), bouton « Vérifier maintenant ».
- Alertes : panne après 2 échecs consécutifs, fermeture automatique au retour, erreurs et alertes métier envoyées par les applis, regroupement des répétitions, prise en compte et résolution manuelles.
- Notifications push des alertes sur le téléphone (PWA).
- Réception des journaux par appli (jeton propre à chaque appli), consultation avec filtres, recherche et mode en direct ; conservation 30 jours.
- Administration : redémarrage et redéploiement des services Render, protocole d'actions propres à chaque appli avec chiffres clés, historique des actions.
- Modules d'envoi à copier : Node (`clients/node`) et Python (`clients/python`).

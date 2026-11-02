# Journal des versions

## v0.11.0 — 2026-11-02

Demandé le 2026-11-02 : « avoir dans l'interface les différents garages ayant acheté l'outil, et pour chaque garage ses spécificités ; on reste trop en surface, pour toutes les applis — sans les infos confidentielles de chaque client (CA…) ».

- **Onglet « Clients »** dans la fiche de chaque appli : la liste de ses clients (recherche au-delà de 6), puis la fiche détaillée de chacun, en sections.
  - MGA : les **garages** (fiche, administrateurs et contacts, équipe par métier, clients et véhicules, activité en nombres, avis, site internet, écrans TV, paiement mobile configuré).
  - Procedia : **vue d'ensemble du cabinet** et **comptes** (rôle, périmètre, activité) ; clients du cabinet comptés par secteur, jamais nommés.
  - Yiri : **vue d'ensemble des abonnés** (par registre, mode, canal), **demandes en attente** et **abonnés** (statut, préférences, accès).
- Jamais de montant (chiffre d'affaires, encaissements, factures) ni de contenu de dossier : seulement des caractéristiques, des comptages et des dates.
- Protocole : `GET /supervision/tenants` et `/supervision/tenants/:id` (signés), option `tenants` des modules Node et Python.

## v0.10.0 — 2026-11-02

- **Actions d'administration pour tout le parc** (onglet Administration de chaque appli) : MGA (notification de test, déconnexion d'un compte, code de réinitialisation, reconstruction du site, rappels de RDV, RDV manqués, actualités), Procedia (désactiver, réactiver, mot de passe temporaire), Yiri (statut, approuver, refuser, renvoyer quiz ou digest, maintenance). Chiffres clés de chaque appli.
- **Protocole signé, sans aucune variable à saisir** : clé d'administration dérivée du jeton d'envoi des journaux déjà partagé ; chaque appel est signé (HMAC-SHA256) et daté, l'appli refuse un appel non signé, modifié ou de plus de 5 minutes. Adresses d'administration de MGA, Yiri et Procedia connues par défaut.
- Information sensible (code ou mot de passe temporaire) affichée une seule fois, jamais enregistrée dans l'historique des actions.
- Refus d'une appli (compte introuvable…) affiché tel quel ; appli pas encore à jour : « pas encore branchées » au lieu d'une erreur.
- Modules d'envoi Node et Python : `supervisionAdminRouter` et `supervision_fastapi_router` vérifient les signatures.

## v0.9.0 — 2026-11-01

- **Tâches planifiées** (« rendez-vous manqués ») : chaque appli signale l'exécution de ses tâches (rappels, récap, purges…) avec leur horaire attendu ; onglet **Tâches** dans la fiche de l'appli (horaire lisible, dernière exécution, résultat, prochaine échéance, historique).
- Alertes : tâche **non exécutée** à l'heure prévue (critique, vérifié toutes les 5 minutes, marge propre à chaque tâche), tâche **en échec**, tâche **exécutée plusieurs fois** pour une même échéance (tâches au plus toutes les 6 h : risque d'envois en double). Refermées à la prochaine exécution réussie.
- Diagnostic complet : ligne « Tâches planifiées ».
- Module d'envoi Node : `supervision.job(clé, { label, cron, graceMinutes, summarize }, fonction)`.
- Horaires lus sans dépendance (expressions cron à 5 champs, UTC).

## v0.8.0 — 2026-11-01

Retour du propriétaire : « c'est normal de n'avoir aucune donnée concernant la base ? » — non : Render refuse certaines mesures sur l'offre Hobby de l'espace de travail (« query is not allowed for plan: Hobby »).

- **Taille de chaque base et de ses plus grosses tables**, par une route Render autorisée sur toutes les offres. Historique construit par la Supervision elle-même (relevé toutes les heures, conservé 90 jours, nouvelle table `ResourceSample`), puisque Render ne le fournit pas sur Hobby.
- **Temps de réponse mesuré par la Supervision** (à chaque vérification de disponibilité) en tête de l'onglet Ressources, disponible quelle que soit l'offre Render.
- Mesures refusées par Render : plus de courbe vide ni de message technique, une phrase « réservé aux offres Render supérieures à Hobby ».

## v0.7.0 — 2026-11-01

- **Page « Claude »** : dépenses de l'organisation Anthropic (rapport de coûts de l'API Admin) : ce mois-ci, hier, aujourd'hui, courbe des 30 derniers jours, répartition par modèle et par espace de travail. Demande une clé Admin Anthropic (`ANTHROPIC_ADMIN_KEY`) ; sans elle, la page explique comment la créer.
- **Budget mensuel Claude** (facultatif, `CLAUDE_MONTHLY_BUDGET_USD`) : alerte à 80 % puis critique à 100 %, vérifiée toutes les heures.
- **Disque persistant des services** (ex. Yiri, qui garde ses données sur un disque Render) : jauge et courbe dans l'onglet Ressources, alerte au-delà de 80 % (critique à 95 %), ligne dans le diagnostic complet.
- `ANTHROPIC_ADMIN_API_URL` (facultative) : adresse de l'API Admin Anthropic, remplaçable pour les essais locaux uniquement.

## v0.6.0 — 2026-11-01

- **Onglet « Ressources »** dans la fiche de chaque appli (mesures Render, sur 24 h, 7 jours ou 30 jours) : pour chaque service web, mémoire utilisée face à la limite du plan, processeur, requêtes, erreurs serveur (5xx), temps de réponse (95 % des requêtes) ; pour chaque base de données, espace disque face à sa taille, connexions actives et date d'expiration des bases gratuites. Jauges, courbes avec limite et seuil d'alerte en pointillés, valeur exacte au toucher ou au survol.
- **Alertes de ressources** (vérifiées toutes les 15 minutes) : mémoire au-delà de 85 % de la limite (critique à 95 %), disque d'une base au-delà de 80 %, base gratuite qui expire dans 7 jours ou moins (critique à 2 jours). Refermées seules quand la situation revient à la normale.
- **Incidents Claude reconnus dans les journaux** des applis : crédit épuisé, clé refusée ou absente (critiques), saturation ou limite de débit. Une alerte dédiée par incident, sans alerte d'erreur en double.
- **Diagnostic complet** enrichi : mémoire de chaque service, remplissage et expiration de chaque base.

## v0.5.0 — 2026-10-31

- **Coupure complète du service** par appli (onglet Administration › Coupure du service) : tous les services Render de l'appli sont suspendus, l'appli est hors ligne. Confirmation en retapant le nom de l'appli, motif facultatif. La supervision de l'appli est coupée en même temps (pas d'alerte de panne pour une coupure voulue).
- **Remettre en service** : services suspendus relancés et supervision reprise.
- Coupures et remises en service tracées dans l'historique des actions ; la fiche de l'appli se met à jour aussitôt.
- `RENDER_API_URL` (facultative) : adresse de l'API Render, remplaçable pour les essais locaux uniquement.

## v0.4.0 — 2026-10-31

- **Couper la supervision** d'une ou plusieurs applis (maintenance) : depuis les Réglages (plusieurs applis cochées) ou l'onglet Administration d'une appli ; pendant 1 h, 4 h, 24 h ou jusqu'à réactivation, avec un motif facultatif. Pendant la coupure : ni vérifications, ni alertes, ni notifications ; les journaux continuent d'arriver. Reprise automatique à l'échéance. Carte « Supervision coupée » sur le tableau de bord. Coupures et reprises tracées dans l'historique des actions.
- **Diagnostic complet** par appli (bouton en tête de la fiche) : adresses vérifiées à l'instant et temps de réponse, disponibilité 24 h, services Render et dernier déploiement, erreurs des dernières 24 h regroupées par message, alertes en cours, réception des journaux, actions de l'appli joignables. Compte-rendu point par point en vert, orange ou rouge.
- **Tout relancer** (depuis le diagnostic) : redémarre d'un coup tous les services web Render de l'appli ; tracé dans l'historique.

## v0.3.1 — 2026-10-31

- Activation de la double authentification : explications corrigées après le premier essai réel sur iPad (le bouton ouvre une fiche « Nouveau mot de passe » à compléter et valider ; chemin pour saisir la clé à la main).

## v0.3.0 — 2026-10-31

- **Double authentification** du super administrateur : un code à 6 chiffres (changeant toutes les 30 s, généré par le téléphone) est demandé après le mot de passe. Activation dans Réglages : bouton « Ajouter sur cet appareil » (ouvre l'appli Mots de passe sur iPhone), QR code ou clé à saisir, puis un premier code pour confirmer. Désactivation avec mot de passe et code.
- Un code ne sert qu'une fois ; 10 essais par 15 minutes au plus (connexion et réglages).
- Secours en cas de téléphone perdu : variable `ADMIN_RESET_2FA=true` sur le service `supervision`, à retirer après redémarrage.

## v0.2.0 — 2026-10-31

- Boutons Redémarrer / Redéployer : les services Render de chaque appli sont reconnus automatiquement (par leur nom ou leur adresse) ; seule la clé API Render est à saisir, plus aucun identifiant `srv-…`. `<PREFIXE>_RENDER_SERVICES` reste possible pour imposer une liste.
- « Redémarrer » n'est proposé que pour les services web (un site statique se redéploie seulement) ; type de service affiché en français ; message clair si aucun service n'est reconnu ou si Render refuse la clé.

## v0.1.5 — 2026-10-31

Module d'envoi Python (`clients/python/supervision_client.py`), utilisé par Yiri Invest 0.47.0 :

- Numéros de téléphone masqués par défaut (`22507••••••56`), fonction de masquage remplaçable (`redact`).
- Bibliothèques bavardes (uvicorn.access, httpx, httpcore, urllib3, apscheduler…) : seuls leurs avertissements et erreurs sont envoyés ; les lignes httpx contiennent les adresses appelées, jetons compris.
- Source courte tirée du nom du logger (`brvm_agent.jobs` → `jobs`, serveur → `serveur`).
- Tests du module : `python3 -m unittest clients/python/test_supervision_client.py`.

## v0.1.4 — 2026-10-31

- Procedia surveillé : API (`procedia-backend`, route de santé) et appli web (`procedia-frontend`), toutes les 30 minutes. L'API, en offre gratuite Render, se réveille en une minute environ (mesuré : 52 s) : délai de 90 s avant de la déclarer en panne. Plus besoin de `PROCEDIA_URLS`.

## v0.1.3 — 2026-10-31

Journaux, retours après les premiers journaux réels de MGA :

- Taille du texte identique sur toutes les lignes sur iPhone (iOS agrandissait de lui-même certains messages, surtout en paysage).
- Le préfixe « [module] » n'est plus répété dans le message quand le module est déjà affiché à côté (ex. « news »).

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

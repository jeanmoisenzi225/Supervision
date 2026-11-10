# Backlog — Supervision

**Vision (2026-10-31)** : la Supervision est la base de NJMDev, l'épicentre du développement ; à terme, elle deviendra une brique de NJMDev. Nom et dépôt inchangés pour l'instant.

## 1. Mise en ligne

- [x] Créer le dépôt GitHub `Supervision` (privé) et y pousser ce code (2026-10-30).
- [x] Simplifier la mise en ligne : un seul service, clés de notification générées par le serveur (v0.1.1, 2026-10-31, demande du propriétaire : impossible de copier-coller chaque clé).
- [ ] Créer le projet Render depuis `render.yaml` (seules saisies : `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- [ ] Installer l'appli sur le téléphone et activer les notifications.
- [x] Boutons Redémarrer / Redéployer : services reconnus automatiquement (v0.2.0) ; seule saisie `RENDER_API_KEY`.

## 2. Branchement des applis (journaux et alertes)

Une section par appli, dans son propre dépôt, avec sa propre version :
- [x] **MGA** v0.87.0 (2026-10-31) : module copié, `mirrorConsole` + `captureProcessErrors`, erreurs 500 avec modèle de route, requêtes lentes. À saisir sur `garage-backend` : `SUPERVISION_URL`, `SUPERVISION_INGEST_TOKEN`.
- [x] **MGA** v0.88.0 : 8 tâches planifiées signalées (rappels de RDV, rappels d'entretien, actualités, RDV manqués, récap hebdomadaire, purges du site) — Supervision v0.9.0, demande du 2026-11-01.
- [ ] **MGA** suite : alertes métier (paiement en échec, push en erreur).
- [x] **Yiri Invest** 0.47.0 (2026-10-31) : `SupervisionHandler` sur le logger racine et `uvicorn.error`, numéros et contenus masqués. À saisir sur le service Yiri : `SUPERVISION_URL`, `SUPERVISION_INGEST_TOKEN`.
- [ ] **Yiri Invest** suite : alertes métier dédiées (récap ou BOC non parti à l'heure).
- [x] **Procedia** : disponibilité surveillée (v0.1.4, 2026-10-31).
- [x] **Procedia** v0.15.0 (2026-11-01) : module Node, `mirrorConsole` + `captureProcessErrors`, erreurs 500 et 5xx prévues avec modèle de route (jamais l'objet d'erreur : données de clients). À saisir sur `procedia-backend` : `SUPERVISION_URL`, `SUPERVISION_INGEST_TOKEN`.
- [ ] **My Family** : à intégrer dès le premier backend.\n- [x] **EDEN Supervision** (2026-11-08) : disponibilité API, gateway et interface web ; reconnaissance des services Render `eden-sup-*` ; collecte des journaux backend Python via le module commun. EDEN SUP conserve sa mission de supervision métier pour EDEN Telecom, NJMDev Supervision supervise l’application EDEN comme service du parc.
- [ ] **Site Autonova** : surveillé par son adresse ; échec de construction à remonter par MGA (publication du site).

## 3. Actions super administrateur par appli

Protocole `/supervision` décrit dans `docs/integration.md`. Liste à valider avec le propriétaire du produit ; premières idées :
- MGA : chiffres clés (garages, utilisateurs, RDV du jour, paiements du jour), relancer la publication du site, envoyer une notification de test, déconnecter un utilisateur, désactiver un compte.
- Yiri Invest : abonnés en attente / actifs, relancer le récap du jour, renvoyer le BOC, mettre en pause les alertes news.
- Procedia : missions et utilisateurs, réinitialiser un mot de passe.

Fait (v0.10.0, 2026-11-02, « toute tâche d'admin pour l'ensemble des applis du parc applicatif ») : MGA v0.89.0 (8 actions), Procedia v0.16.0 (3 actions), Yiri 0.48.0 (7 actions), protocole signé sans variable à saisir. Site Autonova : reconstruction depuis MGA et boutons Render. My Family : à brancher dès sa mise en ligne.

Fait (v0.11.0, 2026-11-02, « avoir les garages et leurs spécificités, trop en surface pour toutes les applis ») : onglet Clients — garages de MGA v0.90.0, comptes et vue d'ensemble de Procedia v0.17.0, abonnés de Yiri 0.49.0 ; sans données confidentielles.

## 4. Sécurité de l'accès

- [x] Double authentification (code TOTP) pour le super administrateur (v0.3.0, 2026-10-31).
- [ ] Journal des connexions à la supervision.

## 4 bis. Coupure de la supervision, diagnostic, coupure du service ✅ (v0.4.0, v0.5.0)

Demandé le 2026-10-31 : « pouvoir couper la sup sur une ou plusieurs applis, et faire une compute complète de service via une commande, par application ». Première lecture (v0.4.0) : coupure de la supervision par appli (journaux conservés) et diagnostic complet par appli avec « Tout relancer ». Précision du propriétaire le même jour : « je voulais dire coupure et non compute » → **coupure complète du service** par appli, c'est-à-dire suspension de tous ses services Render, avec remise en service (v0.5.0). Les fonctions de la v0.4.0 restent en place.

## 4 ter. Graphiques de ressources et incidents Claude ✅ (v0.6.0)

Demandé le 2026-11-01 : « des graphiques permettant un meilleur monitoring : utilisation de la mémoire, capacités des bases, clé Claude coupée par manque de crédit ». Mesures Render (mémoire, processeur, trafic, disque, connexions, expiration des bases gratuites), alertes de ressources, crédit et clé Claude reconnus dans les journaux.

- [x] Dépenses Claude par jour, par modèle et par espace de travail, alerte de budget (v0.7.0, 2026-11-01, « pourquoi ne pas les faire directement ? »). À saisir : `ANTHROPIC_ADMIN_KEY`, et facultatif `CLAUDE_MONTHLY_BUDGET_USD`.
- [x] Disque persistant des services (v0.7.0).

- [x] Offre Hobby de Render (2026-11-01) : taille des bases et des tables, historique relevé par la Supervision, temps de réponse des vérifications (v0.8.0). Passer l'espace de travail Render en offre supérieure rendrait aussi disponibles le temps de réponse Render, l'historique du disque et les connexions des bases.

## 4 quater. Backlog de chaque appli ✅ (v0.12.0)

Demandé le 2026-11-02 : « rajoute à l'outil de sup des rubriques par application qui reprennent tout le backlog ; à chaque évol, la tâche change de statut dans le backlog ». Page « Backlog » : une rubrique par appli, lue dans son dépôt GitHub toutes les 15 minutes, statuts et historique des changements.

- [x] Lecture des backlogs MGA, Procedia, Yiri (ROADMAP), My Family, Supervision.
- [x] Historique des changements de statut.
- [x] `GITHUB_TOKEN` saisi sur Render (2026-11-02).

## 5. Idées pour la suite

- Battements de cœur des tâches planifiées (« le récap de 17 h doit arriver chaque jour ouvré ») : alerte si absent.
- Lecture des journaux de plateforme Render (construction, plantages) en complément.
- Erreurs côté navigateur (écrans blancs des applis web).
- Alerte e-mail ou WhatsApp en plus des notifications push.
- Seuil de lenteur (temps de réponse anormal) et certificats HTTPS proches de l'expiration.
- Page d'état publique facultative.

## 6. Fiabilité de la disponibilité EDEN 🚧

- [x] Retirer le contrôle Gateway suspendu de la disponibilité EDEN ; conserver l'API backend et l'application web.
- [x] Fermer automatiquement les alertes de panne associées aux contrôles supprimés, en conservant les résultats historiques.
- [ ] Exécuter les tests, déployer et confirmer le statut « Opérationnel » dans le tableau de bord.

## 7. Historique des imports de Procedia 🚧 (v0.13.0)

- Demande (propriétaire, 2026-11-10) : voir dans la Supervision tout l'historique des imports, succès, échecs et causes.
- Fait : route `GET /api/apps/:key/imports` et onglet « Imports » (Procedia). Passe en ✅ quand Procedia v0.51.0 est en ligne et l'onglet vérifié.

# Backlog — Supervision

## 1. Mise en ligne

- [x] Créer le dépôt GitHub `Supervision` (privé) et y pousser ce code (2026-10-30).
- [x] Simplifier la mise en ligne : un seul service, clés de notification générées par le serveur (v0.1.1, 2026-10-31, demande du propriétaire : impossible de copier-coller chaque clé).
- [ ] Créer le projet Render depuis `render.yaml` (seules saisies : `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
- [ ] Installer l'appli sur le téléphone et activer les notifications.
- [x] Boutons Redémarrer / Redéployer : services reconnus automatiquement (v0.2.0) ; seule saisie `RENDER_API_KEY`.

## 2. Branchement des applis (journaux et alertes)

Une section par appli, dans son propre dépôt, avec sa propre version :
- [x] **MGA** v0.87.0 (2026-10-31) : module copié, `mirrorConsole` + `captureProcessErrors`, erreurs 500 avec modèle de route, requêtes lentes. À saisir sur `garage-backend` : `SUPERVISION_URL`, `SUPERVISION_INGEST_TOKEN`.
- [ ] **MGA** suite : alertes métier (paiement en échec, push en erreur).
- [x] **Yiri Invest** 0.47.0 (2026-10-31) : `SupervisionHandler` sur le logger racine et `uvicorn.error`, numéros et contenus masqués. À saisir sur le service Yiri : `SUPERVISION_URL`, `SUPERVISION_INGEST_TOKEN`.
- [ ] **Yiri Invest** suite : alertes métier dédiées (récap ou BOC non parti à l'heure).
- [x] **Procedia** : disponibilité surveillée (v0.1.4, 2026-10-31).
- [ ] **Procedia** : module Node, erreurs de l'analyse par Claude.
- [ ] **My Family** : à intégrer dès le premier backend.
- [ ] **Site Autonova** : surveillé par son adresse ; échec de construction à remonter par MGA (publication du site).

## 3. Actions super administrateur par appli

Protocole `/supervision` décrit dans `docs/integration.md`. Liste à valider avec le propriétaire du produit ; premières idées :
- MGA : chiffres clés (garages, utilisateurs, RDV du jour, paiements du jour), relancer la publication du site, envoyer une notification de test, déconnecter un utilisateur, désactiver un compte.
- Yiri Invest : abonnés en attente / actifs, relancer le récap du jour, renvoyer le BOC, mettre en pause les alertes news.
- Procedia : missions et utilisateurs, réinitialiser un mot de passe.

## 4. Sécurité de l'accès

- [x] Double authentification (code TOTP) pour le super administrateur (v0.3.0, 2026-10-31).
- [ ] Journal des connexions à la supervision.

## 5. Idées pour la suite

- Battements de cœur des tâches planifiées (« le récap de 17 h doit arriver chaque jour ouvré ») : alerte si absent.
- Lecture des journaux de plateforme Render (construction, plantages) en complément.
- Erreurs côté navigateur (écrans blancs des applis web).
- Alerte e-mail ou WhatsApp en plus des notifications push.
- Seuil de lenteur (temps de réponse anormal) et certificats HTTPS proches de l'expiration.
- Page d'état publique facultative.

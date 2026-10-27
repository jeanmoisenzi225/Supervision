# Backlog — Supervision

## 1. Mise en ligne

- [ ] Créer le dépôt GitHub `Supervision` (privé) et y pousser ce code.
- [ ] Créer le projet Render depuis `render.yaml` (API Starter + base + site statique).
- [ ] Renseigner `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGIN`, `VITE_API_URL`, clés VAPID, `RENDER_API_KEY`.
- [ ] Installer l'appli sur le téléphone et activer les notifications.

## 2. Branchement des applis (journaux et alertes)

Une section par appli, dans son propre dépôt, avec sa propre version :
- [ ] **MGA** : copier `clients/node/supervision.ts`, brancher `captureProcessErrors`, `expressErrorLogger`, les erreurs du planificateur (actus, rappels) et des paiements ; alertes métier (paiement en échec, push en erreur).
- [ ] **Yiri Invest** : `SupervisionHandler` sur le logger racine, alertes métier sur les envois WhatsApp, le récap et le BOC.
- [ ] **Procedia** : module Node, erreurs de l'analyse par Claude.
- [ ] **My Family** : à intégrer dès le premier backend.
- [ ] **Site Autonova** : surveillé par son adresse ; échec de construction à remonter par MGA (publication du site).

## 3. Actions super administrateur par appli

Protocole `/supervision` décrit dans `docs/integration.md`. Liste à valider avec le propriétaire du produit ; premières idées :
- MGA : chiffres clés (garages, utilisateurs, RDV du jour, paiements du jour), relancer la publication du site, envoyer une notification de test, déconnecter un utilisateur, désactiver un compte.
- Yiri Invest : abonnés en attente / actifs, relancer le récap du jour, renvoyer le BOC, mettre en pause les alertes news.
- Procedia : missions et utilisateurs, réinitialiser un mot de passe.

## 4. Sécurité de l'accès

- [ ] Double authentification (code TOTP) pour le super administrateur : à faire **avant** de brancher les actions sensibles.
- [ ] Journal des connexions à la supervision.

## 5. Idées pour la suite

- Battements de cœur des tâches planifiées (« le récap de 17 h doit arriver chaque jour ouvré ») : alerte si absent.
- Lecture des journaux de plateforme Render (construction, plantages) en complément.
- Erreurs côté navigateur (écrans blancs des applis web).
- Alerte e-mail ou WhatsApp en plus des notifications push.
- Seuil de lenteur (temps de réponse anormal) et certificats HTTPS proches de l'expiration.
- Page d'état publique facultative.

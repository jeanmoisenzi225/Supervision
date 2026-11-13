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
- [ ] **My Family** : à intégrer dès le premier backend.
- [x] **EDEN Supervision** (2026-11-08) : disponibilité API, gateway et interface web ; reconnaissance des services Render `eden-sup-*` ; collecte des journaux backend Python via le module commun. EDEN SUP conserve sa mission de supervision métier pour EDEN Telecom, NJMDev Supervision supervise l’application EDEN comme service du parc.
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

## 7. Historique des imports de Procedia ✅ (v0.13.0, v0.13.1)

- Demande (propriétaire, 2026-11-10) : voir dans la Supervision tout l'historique des imports, succès, échecs et causes.
- Fait : route `GET /api/apps/:key/imports` et onglet « Imports » (Procedia). Vérifié par le propriétaire le 2026-11-11.

## 8. Imports de Procedia : comparaison par client ✅ (v0.14.0, v0.16.2)

- Constat (propriétaire, 2026-11-11) : 291 procédures pour BNI dans Procedia, 139 imports dans la Supervision. Les 139 sont des fichiers (un fichier peut créer plusieurs procédures), tous clients confondus, suivis seulement depuis le 2026-11-10 ; les procédures saisies ou dupliquées ne sont pas des imports.
- Fait : onglet « Imports » avec procédures créées, date de début du suivi, tableau par client (procédures dans l'outil, dont importées, autres, imports suivis) et filtre par client. Procedia v0.57.0 en ligne le 2026-11-12.

## 9. NJMDev : menu général et modules ✅ (v0.15.0)

- Demande (propriétaire, 2026-11-11) : l'application globale s'appelle **NJMDev**, avec le logo NJMDev. À l'entrée, un menu général ; module disponible : **NJM Supervision** (l'outil actuel) ; **NJM Website** grisé pour l'instant.
- Fait : nom et logo NJMDev (repris du dépôt MGA, `frontend/public/brand/`), menu général `/`, module sous `/supervision`, redirection des anciennes adresses.
- [ ] NJM Website : à définir.

## 10. Actualisation par glissement 🚧 (v0.16.0)

- Demande (propriétaire, 2026-11-12) : un geste pour actualiser la Supervision en glissant du haut vers le bas. Cas déclencheur : après l'agrandissement de la base de Procedia (1 → 5 Go), la Supervision affichait toujours 1 Go (mémoires tampons de 2 et 10 minutes).
- Fait : geste « tirer pour actualiser » sur toutes les pages ; l'actualisation manuelle contourne les mémoires tampons du serveur (en-tête `X-Refresh`). Vérifié avec un navigateur à écran tactile émulé (glissement court sans effet, glissement long : un rechargement avec l'en-tête).
- [ ] Vérification par le propriétaire sur téléphone, puis passage en ✅.

## 11. Procedia en offre payante Render ✅ (v0.16.5)

- Constat (2026-11-12) : API `procedia-backend` en Starter, base `procedia-db` payante (5 Go). Vérification passée de 30 minutes à 1 minute, mentions de l'offre gratuite retirées, tableau des offres d'hébergement ajouté à `docs/deploiement.md`.
- [ ] Ménage : base de test `supervision-staging-db` (gratuite) expire le 2026-12-09.

## 12. Coûts par application ✅ (v0.17.0, renommée « Coûts » en v0.18.0)

- Demande (propriétaire, 2026-11-12) : intégrer la facturation par application. Render n'expose pas sa facturation par l'API : estimation d'après les offres et les tarifs publics (relevés le 2026-11-12), plus les dépenses Claude du mois par espace de travail.
- [ ] Vérifier le rattachement des espaces de travail Claude (nom contenant le nom de l'appli) dès que la clé Admin Anthropic est lue ; sinon `<APPLI>_CLAUDE_WORKSPACE`.
- [ ] Idée : historique mensuel des coûts, alerte de budget par appli, montants en francs CFA.

## 13. Module Facturation NJMDev 🚧 (en production depuis v0.18.0 ; module « NJM Facturation » du menu NJMDev depuis v0.20.0)

Cadre confirmé : entreprise individuelle en Côte d’Ivoire, au nom propre de l’exploitant, avec NJMDev comme nom commercial. Devise par défaut XOF, devises internationales possibles. Régime fiscal et régime de TVA à confirmer ; émission officielle soumise aux exigences DGI/FNE applicables. Le propriétaire réside actuellement en France : la situation transfrontalière devra être validée avant émission.

Objectif : intégrer à Supervision un espace privé de gestion commerciale et de facturation pour l'activité NJMDev, sans dépendre d'une structure juridique qui n'est pas encore constituée.

- [ ] Paramètres commerciaux (marque, logo, coordonnées de contact et de paiement), distincts de l'identité juridique du vendeur.
- [ ] Configuration juridique différée : nom légal de l’exploitant, entreprise individuelle, adresse en Côte d’Ivoire, RCCM, NCC, régime fiscal, régime TVA et mentions DGI/FNE ; bloquer l'émission officielle tant que les données requises ne sont pas validées.
- [x] Gestion des clients et adresses ; archivage plutôt que suppression des clients déjà utilisés (v0.13.0).
- [x] Création et gestion des brouillons, lignes, quantités, prix HT, remises et taux de TVA multiples (v0.13.0).
- [x] Calculs monétaires exacts côté serveur, totaux HT, TVA et TTC (v0.13.0).
- [x] Aperçu A4 des brouillons et export PDF via impression du navigateur (v0.15.0) ; document explicitement marqué BROUILLON.
- [x] Génération PDF côté serveur à la demande pour les brouillons enregistrés, téléchargement direct sans archivage ni stockage externe (v0.16.0).
- [ ] Archivage durable des PDF : hors périmètre actuel, à reconsidérer uniquement si une conservation des documents émis est décidée.
- [x] Cadrage pays Côte d’Ivoire, entreprise individuelle, devise XOF par défaut et prise en charge XOF/EUR/USD dans les brouillons (v0.14.0).
- [ ] Profil légal ivoirien : identité de l’exploitant, nom commercial, adresse, RCCM, NCC, régime fiscal et régime TVA (à compléter après immatriculation).
- [ ] Qualification du parcours FNE auprès de la DGI avant activation de l’émission.
- [ ] Numérotation chronologique continue et atomique à l'émission ; instantané des identités vendeur/client ; facture émise non modifiable.
- [x] Facture prévisionnelle d'après les coûts (client ↔ applis, import des coûts d'hébergement et Claude au taux saisi, lignes modifiables, lignes libres, PDF « PRÉVISIONNELLE »), v0.19.0 (2026-11-12).
- [ ] Facture définitive après la facture de Render : à bâtir sur la prévisionnelle (même client, mêmes lignes, montants réels), une fois le profil légal prêt.
- [ ] Historique, suivi des paiements et journal des événements.
- [ ] Envoi e-mail traçable (phase ultérieure).
- [ ] Préparer l'intégration à une plateforme agréée pour la facturation électronique ; ne pas assimiler un PDF envoyé par e-mail à une facture électronique conforme.
- [ ] Tests : calculs multi-TVA, concurrence de numérotation, immutabilité, autorisations et PDF.
- [ ] Documentation, migrations et déploiement vérifiés.

## 14. Incident Procedia : arrêts « mémoire saturée » ⏸ (2026-11-13)

- Constat (Render, 2026-11-13) : l'API `procedia-backend` (Starter, 512 Mo) est tuée par manque de mémoire (événements « oomKilled », 512 Mi) : 11/11 vers 10 h 04, 12/11 vers 16 h 49, 13/11 vers 09 h 32, 09 h 40, 09 h 47 et 10 h 06 (UTC). Chaque arrêt coupe les imports en cours ; le client relance, la boucle recommence. Mémoire normale ~190 Mo, avec des paliers de +40 à +190 Mo en quelques secondes pour 1 à 11 requêtes par minute, en partie jamais rendus.
- Décisions du propriétaire (2026-11-13) : **pas** de passage à 3 ou 4 imports simultanés ; plan de correction **mis de côté pour l'instant**.
- [ ] Correction Procedia (v0.59.0, à livrer avec la règle de mise en ligne de Procedia : `jobs` = 0, client prévenu, feu vert) : limite de deux imports à la fois et un gros document (> 10 Mo environ) seul ; moins de copies en mémoire par import (décodage unique, libération dès l'envoi à Claude) ; journal de la mémoire au début et à la fin de chaque import et alerte vers 400 Mo ; vérification de la lecture du document d'origine.
- [ ] Alerte Supervision sur les événements Render « mémoire saturée » (`/services/{id}/events`, type `server_failed`), qui arrivent 15 à 30 minutes après l'arrêt.
- [ ] Si les arrêts continuent après la correction : API de Procedia en offre Standard (2 Go, +18 $ par mois).
- Cause exacte du pic de mémoire : **non identifiée côté Render** (Render ne donne ni l'adresse appelée ni la mémoire par fonction) ; à établir par le journal de mémoire ci-dessus.


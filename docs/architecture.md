# Architecture et API

## Composants

```
 Applis supervisées                    Supervision (projet Render dédié)
 ┌──────────────┐  journaux, alertes   ┌──────────────────────────────┐
 │ MGA, Yiri,   │ ───────────────────▶ │ supervision (Starter)        │──▶ PostgreSQL
 │ Procedia,    │  POST /api/ingest/*  │  · boucle de vérification    │
 │ My Family    │ ◀─────────────────── │  · alertes + push            │──▶ API Render
 └──────────────┘  /supervision/*      │  · actions, purge 30 j       │    (redémarrer,
        ▲          (actions admin)     └──────────────▲───────────────┘     redéployer)
        │ GET (disponibilité)                         │ /api/*
        └────────────────────── boucle ───────────────┤
                                         interface PWA (servie par l'API)
```

Un seul service Render (`supervision`) : l'API sert aussi l'interface construite (`frontend/dist`), à la même adresse. Toute adresse hors `/api` renvoie l'interface.

Interface (v0.15.0) : l'application s'appelle **NJMDev** (logo NJMDev repris de MGA, `frontend/public/brand/njmdev-white.png` ; icônes de l'écran d'accueil générées depuis ce logo, nommées `njmdev-*.png` depuis la v0.16.4 pour forcer leur rechargement par les téléphones). `/` = menu général des modules (`pages/Home.tsx`) : **NJM Supervision** (avec l'état d'ensemble), **NJM Facturation** (v0.20.0 : clients et factures, avec leur nombre) et **NJM Website** (grisé, à venir). Le module Supervision est sous `/supervision` (`/supervision/applis/:key`, `/supervision/alertes`, `/journaux`, `/backlog`, `/claude`, `/reglages`) ; les anciennes adresses (`/alertes?id=…`, `/applis/…`, etc.) redirigent vers leur équivalent, pour les notifications déjà reçues. Les notifications ouvrent `/supervision/alertes`.

L'API tourne en continu : elle interroge les applis selon leur intervalle (boucle toutes les 15 s, vérification lancée quand l'intervalle de l'appli est écoulé, jamais deux en même temps pour une même appli).

## Données (`backend/prisma/schema.prisma`)

| Table | Contenu |
|---|---|
| `AdminUser` | Super administrateur (créé au premier démarrage depuis `ADMIN_EMAIL` / `ADMIN_PASSWORD`) ; double authentification : `totpSecret`, `totpEnabled`, `totpLastStep` (anti-rejeu) |
| `CheckResult` | Une vérification : appli, adresse, réussite, code HTTP, temps de réponse, erreur. Conservée 30 jours |
| `Alert` | Alerte : type (`down`, `error`, `app`), gravité, empreinte, statut (`open`, `acknowledged`, `resolved`), compteur |
| `LogEntry` | Journal reçu : appli, date, niveau, source, message (4 000 car. max), contexte JSON (8 Ko max). Conservé 30 jours |
| `ActionAudit` | Chaque action lancée : qui, quand, quoi, paramètres, résultat |
| `PushSubscription` | Appareils abonnés aux notifications |
| `AppPause` | Supervision coupée sur une appli : échéance (`until`, nulle = jusqu'à réactivation), motif, auteur. Retirée automatiquement à l'échéance |
| `ResourceSample` | Relevés faits par la Supervision quand Render ne fournit pas l'historique (offre Hobby) : taille des bases (`dbsize:<id>`), une fois par heure, conservés 90 jours |
| `Job` / `JobRun` | Tâches planifiées déclarées par les applis (clé, libellé, horaire cron UTC, marge) et leurs exécutions (statut, message, durée), conservées comme les journaux |
| `BacklogItem` | Chantier du backlog d'une appli (source, clé, numéro, titre, statut, versions, groupe, priorité, cases à cocher, texte), date du dernier changement de statut, `removedAt` s'il a disparu du fichier |
| `BacklogEvent` | Changement de statut d'un chantier (ancien, nouveau, date) ; ancien vide = nouveau chantier |
| `Setting` | Réglages générés par le serveur : clés des notifications (`vapid`), créées au premier démarrage si `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` ne sont pas définies |

## Objectifs de la semaine (v0.36.0)

Section de la page d'accueil (`frontend/src/components/WeeklyObjectives.tsx`, affichée par `pages/Home.tsx`). Les routes `/api/objectives/*` (`backend/src/modules/objectives/`) sont protégées par `requireAdmin` : `GET /api/objectives?week=AAAA-MM-JJ` (semaine en cours par défaut) renvoie les objectifs de la semaine, sa progression et les semaines voisines ; `POST` ajoute un objectif ; `PATCH /:id` change le texte ou valide (`done: true`) / rouvre (`done: false`) ; `DELETE /:id` supprime. La table `Objective` (migration `20261116100000_objectives`) garde pour chaque objectif sa semaine de création (`weekStart`, lundi 00:00 UTC) et sa date de validation (`doneAt`). **Règle de report** : une semaine affiche les objectifs créés cette semaine ou avant qui n'ont pas été validés avant elle ; un objectif non validé passe donc d'une semaine à l'autre jusqu'à sa validation (`carried` = nombre de semaines de report), puis reste dans la semaine où il a été validé. Une semaine future est vide. Rouvrir un objectif validé une semaine passée est refusé (409), l'historique ne se réécrit pas. Semaines du lundi au dimanche en UTC (heure d'Abidjan) ; calcul dans `weeks.ts`, testé dans `tests/objectives.test.ts`.

## Suivi de la qualité de Procedia (v0.37.0)

Onglet « Qualité » (`frontend/src/pages/QualityPanel.tsx`) : `GET /api/apps/:key/qualite/{documents|cibles|incoherences}` relaie les rapports signés `reports/documents`, `reports/cibles` et `reports/incoherences` de Procedia v0.63.0 (`backend/src/modules/actions/actions.routes.ts`) ; `?days=` et `?refresh=1` sont transmis. Si Procedia répond 404 (version antérieure), la réponse porte `notReady: true` et l'écran l'explique. Le rapport des incohérences est mis en cache 10 minutes côté Procedia et reporté (`deferred`) pendant un import ; « Recalculer » force le calcul.

**Retour de la mémoire au repos** (`backend/src/modules/runtime/rest.ts`) : à partir des relevés en direct (`RuntimeSample`, 15 s), `importEpisodes` repère les périodes où `imports > 0`, le niveau de base (plus bas relevé des 2 minutes avant), le pic, et l'heure où la mémoire repasse sous `restLimit` (base + max(30 Mo, 15 %)). Un import lancé avant le retour au repos hérite du niveau de base du précédent. `GET /api/apps/:key/runtime` renvoie `episodes` ; la courbe de mémoire teinte ces périodes (`LineChart`, propriété `bands`). `watchTrends` lève l'alerte « la mémoire ne redescend pas après un import » (`mem-no-rest:<appli>`, avertissement) quand le dernier import est terminé depuis 15 minutes sans retour au repos ni nouvel import, et la résout au retour.

## Identité visuelle et accueil (v0.38.0)

Couleurs définies par variables dans `frontend/src/styles.css` (`:root` sombre, `[data-theme="light"]` clair) ; le thème est lu avant l'affichage (`index.html`) puis géré par `lib/theme.ts` (clé `supervision.theme`). L'en-tête est une pile de rangées `.lvl` dans `#hstack` (barre NJMDev, navigation du module, et les onglets d'une fiche d'appli ajoutés par `components/StackLevel.tsx`) ; `lib/useStagedHide.ts` les retire une par une au défilement vers le bas et les ramène par niveau vers le haut (la rangée la plus proche du contenu d'abord). L'accueil (`pages/Home.tsx`) compose un brief écrit d'après `GET /api/overview` et `GET /api/alerts?status=open`, les objectifs de la semaine et la **constellation** (`components/Constellation.tsx` : nœud = appli, anneau = disponibilité 24 h la plus basse des vérifications, couleur = état, libellé = temps de réponse le plus haut). Logos dans `frontend/public/logos/` (`LOGOS` dans `Constellation.tsx` ; My Family : initiales).

## Rejeu, recherche et tableau de bord (v0.39.0)

`GET /api/replay?hours=6&step=5` (`backend/src/modules/replay/`) renvoie, pour chaque appli, une case d'état par pas de `step` minutes (`ok` = toutes les vérifications réussies, `w` = certaines en échec, `b` = toutes en échec, `null` = aucun relevé, avec le temps de réponse et la mémoire moyens de la case) et les événements de la chronologie des applis (`getTimeline` : alertes, redémarrages, événements Render). Résultat mis en cache 60 s ; `hours` 1 à 48, `step` 5, 15, 30 ou 60. Côté interface : `components/Replay.tsx` (frise, curseur, lecture), `Constellation` (propriété `overrides` : état à l'instant rejoué), `pages/Home.tsx` (titre réécrit d'après l'événement le plus proche), `pages/Dashboard.tsx` (liste ou constellation, grille 24 h avec `step=15`), `components/CommandPalette.tsx` (Ctrl ou ⌘ + K, montée une seule fois dans `App.tsx`) et `components/DiagnosticPanel.tsx` (résumé puis détail replié).

## Pages restylées (v0.40.0)

`components/Treemap.tsx` (carte à cases, découpage récursif proportionnel aux valeurs) est utilisée par la page Coûts (`GET /api/hosting-costs`). Le brief de l'accueil (`pages/Home.tsx`, `procediaBrief`) lit `GET /api/apps/procedia/qualite/documents?days=7`, `GET /api/apps/procedia/runtime?minutes=360` (`episodes`) et `GET /api/apps/procedia/qualite/incoherences` ; une réponse `notReady`, `deferred` ou en erreur n'affiche simplement pas la phrase. Le thème se choisit aussi dans Réglages (`lib/theme.ts`).

## Accueil épuré et fenêtre d'appli (v0.41.0)

L'accueil (`pages/Home.tsx`) ne contient que le brief, les objectifs de la semaine, le rejeu et la constellation. Un clic sur un nœud ouvre `components/AppPopup.tsx` (verre dépoli : `backdrop-filter`) : indicateurs tirés de `GET /api/overview` et des alertes ouvertes ; pour Procedia, `components/ProcediaDetails.tsx` charge ses rapports (documents, mémoire, incohérences) uniquement à l'ouverture de la fenêtre. `components/SettingsMenu.tsx` (thème, Réglages, mesure de l'écran, déconnexion) remplace les boutons de thème et de déconnexion des en-têtes. La constellation (`components/Constellation.tsx`) utilise des filtres SVG (`#c-glow`, `#c-soft`) pour la lueur et un halo qui respire (`@media (prefers-reduced-motion)` coupe les animations).

## Module de facturation NJMDev

Les routes `/api/billing/*` sont protégées par `requireAdmin` ; `POST /api/billing/forecast-lines` (v0.19.0) renvoie les lignes d'une facture prévisionnelle (coûts d'hébergement et Claude des applis du client, voir [facturation.md](facturation.md)) ; `GET /api/billing/fx?currency=&date=` (v0.21.0 ; les lignes importées gardent leur montant en dollars `usdAmount`, v0.23.0) renvoie le taux dollars → devise retenu : taux de la BCE par défaut (`fxMode` = `market` du profil de facturation ; `parity` = parité commerciale 1 $ = 1 €) (`backend/src/modules/billing/fx.ts`, gardé 6 h). Elles couvrent le profil commercial, les clients et les brouillons de facture. Les montants sont recalculés côté serveur avec `Prisma.Decimal`. Les brouillons n'ont pas de numéro officiel ; les routes d'émission ne sont pas encore disponibles. Les modèles `BillingClient`, `BillingInvoice` et `BillingInvoiceLine` sont créés par la migration `20261109000000_billing_drafts`.

## Règles d'alerte

- **Panne** (`down`, critique) : ouverte au 2ᵉ échec consécutif d'une adresse (`ALERT_AFTER_FAILURES`), refermée automatiquement dès qu'elle répond. Un échec = code hors 2xx, pas de réponse dans le délai (15 s ; 90 s pour un service gratuit en veille) ou, pour une adresse « health », un JSON `status` autre que ok/healthy/up/pass.
- **Erreur** (`error`) : chaque journal `error` (attention) ou `fatal` (critique). Les erreurs identiques à un nombre ou un identifiant près partagent la même empreinte : une seule alerte, compteur incrémenté.
- **Alerte métier** (`app`) : envoyée par l'appli avec une clé ; la même clé met à jour l'alerte, `resolve: true` la referme.
- **Supervision coupée** sur une appli : aucune alerte n'est ouverte (ni panne, ni erreur, ni alerte métier) et la boucle ne la vérifie plus ; les journaux sont toujours enregistrés. À la reprise, le premier passage referme une alerte de panne restée ouverte si l'appli répond.
- **Ressources** (toutes les 15 minutes, clé API Render nécessaire) : mémoire ≥ 85 % de la limite (critique ≥ 95 %, refermée sous 75 %) ; disque d'une base ≥ 80 % (critique ≥ 95 %, refermée sous 70 %) ; base gratuite expirant dans 7 jours ou moins (critique à 2 jours). Bases rattachées à une appli par leur nom (mêmes motifs que les services).
- **Disque persistant** d'un service web (mesures `disk-usage` / `disk-capacity` du service) : mêmes seuils que le disque des bases.
- **Budget Claude** (toutes les heures, si `ANTHROPIC_ADMIN_KEY` et `CLAUDE_MONTHLY_BUDGET_USD` sont définies) : dépenses du mois ≥ 80 % du budget (critique ≥ 100 %), alerte rattachée à « Claude » (`claude-budget:<mois>`).
- **Tâches planifiées** (toutes les 5 minutes) : non exécutée si l'échéance prévue (horaire cron, marge comprise) est passée sans exécution reçue depuis (critique, `joblate:<clé>`) ; une exécution en échec ouvre `jobfail:<clé>` ; plus d'une exécution réussie pour une même échéance, pour une tâche au plus toutes les 6 h, ouvre `jobdup:<clé>:<échéance>`. Une tâche n'est jamais « en retard » pour une échéance antérieure à sa première déclaration.
- **Page Ressources (v0.28.0)** : mémoire et processeur demandés à Render à un pas fin (`RANGES[...].fine` : 60 s sur 24 h, 300 s sur 7 jours, 900 s sur 30 jours) puis regroupés en gardant le **maximum** de chaque pas d'affichage (`maxBuckets`), car Render ne conserve pas les pics aux pas larges ; les arrêts Render (`failures` : événements `server_failed`) sont renvoyés par service et tracés en repères verticaux sur les courbes.
- **Taille réelle de la base** (toutes les 5 minutes, v0.45.0, `modules/resources/realsize.ts`) : rapport signé `GET /supervision/reports/database` de l'appli → deux relevés `ResourceSample` (`dbreal:<appli>` données utiles, `dbdisk:<appli>` disque occupé). `GET /api/apps/:key/resources` joint `real` (courbes, dernier relevé, place libérée réutilisable) à la base de l'appli ; la page Ressources affiche la carte « Données réelles » et la courbe en direct avec le disque en pointillé. Applis qui répondent 404 : réessayées toutes les heures. Les repères de suppression de documents (`deletions`, lus à chaque affichage via `?days=`) sont dessinés sur la courbe (`LineChart`, propriété `events`).
- **État en direct** (toutes les 15 secondes, v0.29.0, `modules/runtime`) : rapport signé `GET /supervision/reports/runtime` de chaque appli qui le propose (Procedia v0.61.0) → table `RuntimeSample` (7 jours). Un changement de `startedAt` ouvre `restart:<appli>` (sauf s'il suit un déploiement Render lancé dans les 15 minutes précédentes, quelle que soit la mémoire ; la mémoire n'est jugée que sur les 2 dernières minutes avant l'arrêt, v0.33.3 : alors `restart-deploy:<appli>`, en information, sans notification, v0.32.1) (critique si la mémoire vue avant l'arrêt était ≥ 400 Mo, sinon avertissement) ; refermée après 2 h calmes. Applis qui répondent 404 : réessayées toutes les heures ; applis qui s'endorment (offre gratuite) : interrogées seulement au rythme de leurs vérifications de disponibilité (v0.43.0). Route `GET /api/apps/:key/runtime?minutes=` (relevés, redémarrages).
- **Journaux Render** (toutes les 15 secondes, v0.30.0, `modules/renderLogs`) : `GET /logs?type=app` de chaque service de l'appli (reprise à partir de la dernière ligne vue, 100 lignes par passage) → `LogEntry` avec `source = render` et `context.service`. Lecture HTTP et non WebSocket : la connexion WebSocket de Render n'a pas pu être vérifiée depuis l'environnement de développement.
- **Alertes de tendance** (v0.32.0) : sur chaque relevé en direct, `mem-high:<appli>` (≥ 400 Mo avertissement, ≥ 460 Mo critique, refermée < 330 Mo), `loop-lag:<appli>` (retard de boucle ≥ 1 s deux relevés de suite), `restart-loop:<appli>` (≥ 3 redémarrages en 1 h, critique) ; toutes les 5 minutes, `err-rate:<service>` (≥ 20 requêtes et ≥ 5 % de réponses 5xx sur 15 min, critique ≥ 20 %, refermée < 2 %). La page Ressources ajoute `bandwidth` (octets, pas d'une heure) et `instances` par service ; la route `GET /api/apps/:key/runtime` renvoie aussi `current` (dernier rapport en mémoire, dont les imports en cours).
- **Chronologie** (v0.31.0, `modules/timeline`) : `GET /api/apps/:key/timeline?hours=` fusionne les alertes (`Alert.openedAt`), les événements Render du service (`server_failed`, `server_available`, `deploy_*`, `build_ended` en échec, suspensions) et les redémarrages détectés (`detectRestarts`) ; renvoie aussi la disponibilité (`CheckResult` réussis / total sur la période).
- **Arrêts du service** (toutes les 10 minutes, clé API Render nécessaire, v0.26.0) : événements Render `server_failed` des services de l'appli (`/services/{id}/events`, `modules/renderEvents`). Premier passage : dernière heure seulement. Un arrêt « mémoire saturée » (`oomKilled`) ou autre ouvre `render-failed:<service>` (avertissement, titre distinct) ; chaque nouvel arrêt incrémente le compteur ; refermée après 2 h sans arrêt. Les événements arrivent 15 à 30 minutes après l'arrêt réel.
- **Incidents connus** repérés dans les journaux reçus, quel que soit leur niveau : crédit Claude épuisé, clé Claude refusée ou absente, saturation de l'API Claude. Alerte dédiée (`known:<clé>`), sans alerte d'erreur générique en double. Anthropic ne permet pas de lire le solde de crédit : c'est le message d'erreur de l'API qui le révèle.
- Notification push à l'ouverture (critique ou attention) et à la fermeture automatique.

## Appareils pliables : iPhone Duo (v0.35.0, v0.35.1)

Tailles de référence (pixels CSS, Safari 27.1 d'après WebKit) : écran extérieur 382 × 618 (portrait) et 594 × 406 (paysage) ; écran intérieur 669 × 902 et 951 × 620 ; deux fenêtres côte à côte 385 × 609. Règles : mise en page par **largeur** (≤ 640 px menu sur une ligne défilante ; 641–960 px menu sur sa ligne et onglets sur plusieurs lignes ; au-delà, mise en page large), **jamais par orientation** (l'écran intérieur ne respecte pas l'orientation) ; marges de sécurité gauche et droite traitées séparément (`max(16px, env(safe-area-inset-left))`, asymétriques sur l'appareil) ; barre du haut non fixe sous 520 px de hauteur ; zones tactiles de 44 px et champs à 16 px (`pointer: coarse`). Les API Device Posture et Viewport Segments de Safari 27.1 sont en préversion derrière un drapeau : non utilisées (une seule surface continue, rien à gérer).

## Heures (v0.34.0)

Une seule heure à l'écran : celle de l'appareil. Les textes écrits par le serveur ne contiennent jamais d'heure en clair : ils portent la date sous la forme `⟦ISO⟧` (`backend/src/utils/time.ts`, `stamp`), remplacée par l'heure de l'appareil par `localizeTimes` (`frontend/src/lib/format.ts`) dans les alertes, le diagnostic et la chronologie, et par le service worker des notifications (`public/push-worker.js`). Exceptions affichées comme telles : horaires des tâches planifiées (expressions cron, UTC) et découpage par jour UTC des coûts Claude.

## Page de démarrage (v0.33.0)

`frontend/src/components/Splash.tsx`, `lib/launch.ts` (`isNewOpening` : premier chargement de la fenêtre dans l'application installée, `sessionStorage` `njmdev.opened`) : logo posé, sans animation, avec une barre de chargement qui se remplit dessous, 4 s (`LOGO_MS`, comme Procedia) puis fondu de 0,4 s ; `?splash=1` la force. Styles `.splash*` dans `styles.css`.

## Routes

Réservées aux applis (jeton `Bearer <APPLI>_INGEST_TOKEN`, 600 requêtes/min) :

| Route | Corps |
|---|---|
| `POST /api/ingest/logs` | `{ entries: [{ at?, level, message, source?, context?, requestId? }] }`, 500 entrées max |
| `POST /api/ingest/alerts` | `{ key, title?, detail?, severity?, resolve? }` |
| `POST /api/ingest/jobs` | `{ key, label, cron, graceMinutes?, status: "ok"\|"error", message?, durationMs? }` : exécution d'une tâche planifiée |

Réservées au super administrateur (jeton de session) :

| Route | Rôle |
|---|---|
| `POST /api/auth/login`, `GET /api/auth/me` | Connexion (10 essais / 15 min) ; si la double authentification est active, réponse 401 `totpRequired` tant que `code` (6 chiffres) manque ou est faux |
| `POST /api/auth/2fa/setup` · `/confirm` · `/disable` | Double authentification : nouveau secret (QR code, lien `otpauth://`), activation par un premier code, désactivation avec mot de passe et code |
| `GET /api/overview` | État de toutes les applis |
| `GET /api/apps/:key`, `GET /api/apps/:key/checks?hours=` , `POST /api/apps/:key/check-now` | Détail, historique, vérification immédiate |
| `GET /api/alerts?status=&app=`, `POST /api/alerts/:id/ack`, `POST /api/alerts/:id/resolve` | Alertes |
| `GET /api/logs?app=&minLevel=&q=&source=&before=&after=&limit=` | Journaux (pagination par identifiant) |
| `GET /api/apps/:key/actions` | Services Render, actions et chiffres clés de l'appli, historique |
| `GET /api/apps/:key/resources?range=24h\|7d\|30d` | Mesures Render des services web (mémoire et limite, processeur et limite, requêtes par code HTTP, temps de réponse au 95e centile) et des bases (disque, connexions, taille, expiration) ; gardées 2 minutes en mémoire (contournées par l'en-tête `X-Refresh: 1` envoyé par le geste « tirer pour actualiser ») |
| — | Offre Hobby de Render : `http-latency`, `disk-usage` des bases et `active-connections` sont refusés (« query is not allowed for plan ») ; la taille des bases vient alors de `GET /postgres/{id}/query/sizes` (autorisée partout) avec historique relevé par la Supervision, et le temps de réponse des vérifications de la Supervision remplace celui de Render. Sans ligne « base entière » dans `query/sizes` (constaté le 2026-11-12), la taille est la somme des tables de la base. Réponse 429 de Render (limite de demandes) : la dernière valeur connue de la mesure est reprise ; une actualisation forcée ne relit Render qu'une fois par minute au plus |
| `GET /api/hosting-costs` | Coûts par appli (v0.17.0 ; page « Coûts », route renommée en v0.18.0, `backend/src/modules/hosting/`) : hébergement Render estimé par mois (offre de chaque service et base reconnus pour l'appli × tarifs publics de `backend/src/modules/hosting/prices.ts`, relevés le 2026-11-12 ; stockage des bases 0,30 $/Go, disque de service 0,25 $/Go ; instance d'un service suspendu non facturée, son disque supposé facturé ; sites statiques gratuits) et dépenses Claude du mois en cours par espace de travail (reconnu par son nom, `claudeNames` du catalogue ou `<PREFIXE>_CLAUDE_WORKSPACE`). Groupes « NJMDev (Supervision) » (services et bases `supervision*`) et « Non rattaché à une appli ». Render n'expose aucune route de facturation : estimation, hors bande passante, minutes de construction et forfait de l'espace de travail. Les offres absentes de la table sont signalées (`unknown`), jamais inventées |
| `GET /api/claude/costs` (avec `byApp` depuis la v0.25.0 : espaces de travail cumulés par appli) | Dépenses Claude des 31 derniers jours (rapport de coûts de l'API Admin Anthropic, appel HTTP direct `GET /v1/organizations/cost_report` avec `ending_at` = fin de demain pour inclure la journée en cours, sinon seules les journées terminées sont renvoyées ; regroupé par description et espace de travail ; montants en centimes convertis en dollars) ; gardées 10 minutes en mémoire (contournées par `X-Refresh: 1`) |
| `GET /api/apps/:key/jobs` | Tâches planifiées de l'appli : état (`ok`, `late`, `failed`, `waiting`), échéance attendue, prochaine, 10 dernières exécutions |
| `GET /api/apps/:key/imports` | Historique des imports de documents (Procedia), relayé depuis la route signée `/supervision/reports/imports` de l'appli (`status`, `limit`, `before`, `client`) ; avec Procedia v0.57.0 : procédures créées, début du suivi, détail par client ; avec Procedia v0.60.0 : `size` (octets du document) par import |
| `GET /api/apps/:key/tenants` · `/tenants/:id` | Clients de l'appli (garages, comptes, abonnés) et fiche détaillée, relayés depuis la route signée `/supervision/tenants` de l'appli ; caractéristiques et comptages seulement |
| `POST /api/apps/:key/diagnostic` | Diagnostic complet (vérifications lancées à l'instant), compte-rendu `ok` / `warn` / `ko` / `info` par point et état d'ensemble. Le point « Actions de l'appli » appelle `GET /supervision/actions` avec la requête **signée** (v0.36.1, sinon l'appli répond 401). Le point « Journaux » est `ok` si un journal est arrivé depuis moins de 24 h, `info` au-delà (une appli n'écrit un journal que lors d'un événement : `logsStatus`), `warn` seulement si aucun journal n'est jamais arrivé |
| `POST /api/pause` `{ apps, minutes, reason }` · `POST /api/resume` `{ apps }` | Coupe / reprend la supervision d'une ou plusieurs applis (`minutes` nul : jusqu'à réactivation) |
| `POST /api/apps/:key/render/suspend-all` `{ confirm, reason }` | Coupure complète du service : suspend tous les services Render de l'appli et coupe sa supervision ; `confirm` doit reprendre le nom de l'appli |
| `POST /api/apps/:key/render/resume-all` | Remise en service : relance les services suspendus et reprend la supervision |
| `POST /api/apps/:key/render/restart-all` | « Tout relancer » : redémarre tous les services web Render de l'appli (sites statiques ignorés) |
| `POST /api/apps/:key/render/:serviceId/restart` · `/deploy` | Actions Render (service rattaché à l'appli uniquement : reconnu automatiquement ou imposé par `<PREFIXE>_RENDER_SERVICES`) |
| `POST /api/apps/:key/actions/:actionId` | Action propre à l'appli (relayée vers son protocole `/supervision`) |
| `GET /api/backlog` | Rubriques backlog : par appli, nombre de chantiers par statut, dernière lecture, erreur éventuelle ; 30 derniers changements ; `githubConfigured` |
| `GET /api/backlog/:source` · `/:source/:key` · `POST /api/backlog/:source/sync` | Chantiers d'une appli (sans le texte) et ses changements, fiche d'un chantier (texte et historique), relecture immédiate |
| `GET /api/push/public-key`, `POST /api/push/subscribe` · `/unsubscribe` · `/test` | Notifications |

## Configuration des applis

Catalogue dans `backend/src/config/apps.ts` (adresses de production par défaut), variables par appli décrites dans [integration.md](integration.md).

## Backlog des applis

`backend/src/modules/backlog/` : lecture des fichiers de backlog sur GitHub (API `contents`, jeton `GITHUB_TOKEN` en lecture seule), 30 s après le démarrage puis toutes les 15 minutes. `parse.ts` découpe le fichier en chantiers (`## N. Titre`, ou `### ÉPOPÉE` / `**CODE — Titre**` pour My Family) et déduit le statut des marqueurs (✅ terminé, 🚧 en cours, ⏸ en attente, ❌ abandonné, ℹ️ information, puis cases à cocher). Chaque changement de statut est enregistré dans `BacklogEvent`. Sources : `backend/src/modules/backlog/backlog.service.ts` (`BACKLOG_SOURCES`).

## Contrôles de disponibilité EDEN

EDEN est évalué à partir de deux contrôles actifs : l'API (`/api/v1/health`) et l'application web (`eden-sup-app`). L'ancien service `eden-sup-gateway` est suspendu et ne doit plus être une sonde de disponibilité. Les services Render `eden-sup-*` restent reconnus dans l'onglet Administration pour l'inventaire et les opérations d'hébergement. Lorsqu'un contrôle est retiré du catalogue, son alerte de panne ouverte est automatiquement résolue au démarrage du moniteur ; les résultats historiques restent conservés.

## Actualisation par glissement (règle)

Le geste « glisser vers le bas » (`components/PullToRefresh.tsx`) émet l'événement `supervision:refresh` (`lib/refresh.ts`) et force le serveur à ignorer ses mémoires tampons pendant 10 s (`X-Refresh`). Tout écran qui charge des données **doit** l'écouter : soit par `usePolling` (qui s'abonne tout seul), soit par `onRefreshRequested` pour un chargement fait à la main. Le test `backend/tests/refreshCoverage.test.ts` le vérifie sur tous les fichiers de l'interface qui appellent l'API ; les exceptions (connexion, page de signature publique, panneaux d'actions, palette de commandes) y sont listées avec leur raison.

## Notifications push : icônes (v0.52.0)

`PushMessage.kind` (`critical`, `warning`, `ok`, `signature`) choisit l'icône affichée par `push-worker.js` (`/notif/critique.png`, `avertissement.png`, `ok.png`, `signature.png`) ; sans `kind`, l'icône de l'appli. Les titres n'ont plus d'émoji (`tests/pushTitles.test.ts`). Une notification ne peut pas contenir d'icône dessinée dans son titre ; l'iPhone n'affiche que l'icône de l'appli, d'où le préfixe en mots (« Critique : », « Attention : », « Résolu : »).

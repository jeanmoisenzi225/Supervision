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
- **État en direct** (toutes les 15 secondes, v0.29.0, `modules/runtime`) : rapport signé `GET /supervision/reports/runtime` de chaque appli qui le propose (Procedia v0.61.0) → table `RuntimeSample` (7 jours). Un changement de `startedAt` ouvre `restart:<appli>` (critique si la mémoire vue avant l'arrêt était ≥ 400 Mo, sinon avertissement) ; refermée après 2 h calmes. Applis qui répondent 404 : réessayées toutes les heures ; applis qui s'endorment : jamais interrogées. Route `GET /api/apps/:key/runtime?minutes=` (relevés, redémarrages).
- **Journaux Render** (toutes les 15 secondes, v0.30.0, `modules/renderLogs`) : `GET /logs?type=app` de chaque service de l'appli (reprise à partir de la dernière ligne vue, 100 lignes par passage) → `LogEntry` avec `source = render` et `context.service`. Lecture HTTP et non WebSocket : la connexion WebSocket de Render n'a pas pu être vérifiée depuis l'environnement de développement.
- **Arrêts du service** (toutes les 10 minutes, clé API Render nécessaire, v0.26.0) : événements Render `server_failed` des services de l'appli (`/services/{id}/events`, `modules/renderEvents`). Premier passage : dernière heure seulement. Un arrêt « mémoire saturée » (`oomKilled`) ou autre ouvre `render-failed:<service>` (avertissement, titre distinct) ; chaque nouvel arrêt incrémente le compteur ; refermée après 2 h sans arrêt. Les événements arrivent 15 à 30 minutes après l'arrêt réel.
- **Incidents connus** repérés dans les journaux reçus, quel que soit leur niveau : crédit Claude épuisé, clé Claude refusée ou absente, saturation de l'API Claude. Alerte dédiée (`known:<clé>`), sans alerte d'erreur générique en double. Anthropic ne permet pas de lire le solde de crédit : c'est le message d'erreur de l'API qui le révèle.
- Notification push à l'ouverture (critique ou attention) et à la fermeture automatique.

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
| `POST /api/apps/:key/diagnostic` | Diagnostic complet (vérifications lancées à l'instant), compte-rendu `ok` / `warn` / `ko` / `info` par point et état d'ensemble |
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

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
| `Setting` | Réglages générés par le serveur : clés des notifications (`vapid`), créées au premier démarrage si `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` ne sont pas définies |

## Règles d'alerte

- **Panne** (`down`, critique) : ouverte au 2ᵉ échec consécutif d'une adresse (`ALERT_AFTER_FAILURES`), refermée automatiquement dès qu'elle répond. Un échec = code hors 2xx, pas de réponse dans le délai (15 s ; 90 s pour un service gratuit en veille) ou, pour une adresse « health », un JSON `status` autre que ok/healthy/up/pass.
- **Erreur** (`error`) : chaque journal `error` (attention) ou `fatal` (critique). Les erreurs identiques à un nombre ou un identifiant près partagent la même empreinte : une seule alerte, compteur incrémenté.
- **Alerte métier** (`app`) : envoyée par l'appli avec une clé ; la même clé met à jour l'alerte, `resolve: true` la referme.
- **Supervision coupée** sur une appli : aucune alerte n'est ouverte (ni panne, ni erreur, ni alerte métier) et la boucle ne la vérifie plus ; les journaux sont toujours enregistrés. À la reprise, le premier passage referme une alerte de panne restée ouverte si l'appli répond.
- Notification push à l'ouverture (critique ou attention) et à la fermeture automatique.

## Routes

Réservées aux applis (jeton `Bearer <APPLI>_INGEST_TOKEN`, 600 requêtes/min) :

| Route | Corps |
|---|---|
| `POST /api/ingest/logs` | `{ entries: [{ at?, level, message, source?, context?, requestId? }] }`, 500 entrées max |
| `POST /api/ingest/alerts` | `{ key, title?, detail?, severity?, resolve? }` |

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
| `POST /api/apps/:key/diagnostic` | Diagnostic complet (vérifications lancées à l'instant), compte-rendu `ok` / `warn` / `ko` / `info` par point et état d'ensemble |
| `POST /api/pause` `{ apps, minutes, reason }` · `POST /api/resume` `{ apps }` | Coupe / reprend la supervision d'une ou plusieurs applis (`minutes` nul : jusqu'à réactivation) |
| `POST /api/apps/:key/render/restart-all` | « Tout relancer » : redémarre tous les services web Render de l'appli (sites statiques ignorés) |
| `POST /api/apps/:key/render/:serviceId/restart` · `/deploy` | Actions Render (service rattaché à l'appli uniquement : reconnu automatiquement ou imposé par `<PREFIXE>_RENDER_SERVICES`) |
| `POST /api/apps/:key/actions/:actionId` | Action propre à l'appli (relayée vers son protocole `/supervision`) |
| `GET /api/push/public-key`, `POST /api/push/subscribe` · `/unsubscribe` · `/test` | Notifications |

## Configuration des applis

Catalogue dans `backend/src/config/apps.ts` (adresses de production par défaut), variables par appli décrites dans [integration.md](integration.md).

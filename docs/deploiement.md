# Déploiement et développement

## Render

1. Dashboard Render › **New › Blueprint** › dépôt `Supervision` › **Apply**. Render crée le projet « Supervision » : un service web `supervision` (plan Starter, API + interface) et la base `supervision-db`.
2. Au moment de l'**Apply**, Render demande deux valeurs, à taper directement : `ADMIN_EMAIL` et `ADMIN_PASSWORD` (super administrateur, créé au premier démarrage).
3. C'est tout : `JWT_SECRET` et les jetons `*_INGEST_TOKEN` sont générés par Render, les clés des notifications par le serveur lui-même (table `Setting`), et l'adresse publique (`RENDER_EXTERNAL_URL`) est fournie par Render.
4. Ouvrir l'adresse du service `supervision`, se connecter, installer l'appli sur l'écran d'accueil, puis Réglages › Activer les notifications.

Dépenses Claude (page « Claude ») : `ANTHROPIC_ADMIN_KEY` (clé Admin créée dans la Console Anthropic, Settings › Admin keys ; elle commence par `sk-ant-admin`) et, facultatif, `CLAUDE_MONTHLY_BUDGET_USD` (budget mensuel en dollars).

Rubriques « Backlog » : `GITHUB_TOKEN`, jeton GitHub à granularité fine (Settings › Developer settings › Fine-grained tokens) limité aux dépôts Mon-Garage-Auto, Procedia, JmDev, My-Family et Supervision, permission **Contents : Read-only** seulement.

À ajouter plus tard, au fil des besoins (Environment du service `supervision`) : `RENDER_API_KEY` (boutons Redémarrer / Redéployer ; services reconnus automatiquement), `<APPLI>_ADMIN_URL` / `<APPLI>_ADMIN_TOKEN` (voir [integration.md](integration.md)).

**Téléphone perdu (codes à 6 chiffres inaccessibles)** : ajouter `ADMIN_RESET_2FA` = `true` sur le service `supervision` et enregistrer ; au redémarrage, la double authentification est coupée. Se connecter, **retirer aussitôt la variable**, puis réactiver la double authentification dans Réglages.

Après le premier démarrage, `ADMIN_PASSWORD` peut être retirée (le compte existe en base). Ne pas supprimer la ligne `vapid` de la table `Setting` : les téléphones abonnés ne recevraient plus les notifications.

Coût : service Starter + petite base payante (la base gratuite expire après 30 jours).

### Hébergement des applis supervisées (constaté sur Render le 2026-11-12)

| Appli | Service web | Base de données |
|---|---|---|
| Supervision | Starter | `supervision-db` : offre `basic_256mb`, disque 15 Go |
| Procedia | API Starter (0,5 processeur, 512 Mo), **offre payante depuis le 2026-11-12** ; appli web et site de recette : sites statiques | `procedia-db` : offre 0,1 processeur · 256 Mo, disque 5 Go |
| MGA | voir Render | `garage-db` : offre 0,1 processeur · 256 Mo, disque 1 Go |

La page **« Facturation »** de la Supervision estime le coût mensuel de chaque appli d'après ces offres (tarifs publics de Render, table `backend/src/modules/billing/prices.ts` à remettre à jour si Render change ses prix) et y ajoute les dépenses Claude du mois par espace de travail. Les montants ne sont pas recopiés ici : la facture exacte se lit dans Render (Billing). La page « Ressources » de chaque appli indique l'offre et le disque de ses bases. À contrôler après un changement d'offre : l'intervalle de vérification de l'appli (`<PREFIXE>_INTERVAL_SEC`) et l'option `sleepsWhenIdle` du catalogue.

Alerte : la base de test `supervision-staging-db` (offre gratuite) expire le 2026-12-09 ; la supprimer si elle ne sert plus.

## En local

```bash
cd backend
cp .env.example .env            # puis compléter
DATABASE_URL=postgresql://…localhost… npx prisma migrate deploy
DATABASE_URL=postgresql://…localhost… npm run dev   # API sur le port 4100
cd ../frontend && npm install && npm run dev        # interface sur le port 5173 (/api relayé vers 4100)
```

Toujours passer `DATABASE_URL` explicitement : `dotenv` ne remplace pas une variable déjà présente dans l'environnement. `MONITOR_ENABLED=false` coupe la boucle de vérification.

Pour reproduire la production : `npm run build` dans `frontend` puis `backend`, et `node dist/index.js` dans `backend` : l'interface est servie sur le port 4100.

## Vérifications avant mise en ligne

```bash
cd backend && npx tsc --noEmit && npx vitest run
cd frontend && npx tsc -b --noEmit && npm run build
```

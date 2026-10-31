# Déploiement et développement

## Render

1. Dashboard Render › **New › Blueprint** › dépôt `Supervision` › **Apply**. Render crée le projet « Supervision » : un service web `supervision` (plan Starter, API + interface) et la base `supervision-db`.
2. Au moment de l'**Apply**, Render demande deux valeurs, à taper directement : `ADMIN_EMAIL` et `ADMIN_PASSWORD` (super administrateur, créé au premier démarrage).
3. C'est tout : `JWT_SECRET` et les jetons `*_INGEST_TOKEN` sont générés par Render, les clés des notifications par le serveur lui-même (table `Setting`), et l'adresse publique (`RENDER_EXTERNAL_URL`) est fournie par Render.
4. Ouvrir l'adresse du service `supervision`, se connecter, installer l'appli sur l'écran d'accueil, puis Réglages › Activer les notifications.

À ajouter plus tard, au fil des besoins (Environment du service `supervision`) : `RENDER_API_KEY` et `<APPLI>_RENDER_SERVICES` (boutons Redémarrer / Redéployer), `<APPLI>_ADMIN_URL` / `<APPLI>_ADMIN_TOKEN` (voir [integration.md](integration.md)).

Après le premier démarrage, `ADMIN_PASSWORD` peut être retirée (le compte existe en base). Ne pas supprimer la ligne `vapid` de la table `Setting` : les téléphones abonnés ne recevraient plus les notifications.

Coût : service Starter + petite base payante (la base gratuite expire après 30 jours).

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

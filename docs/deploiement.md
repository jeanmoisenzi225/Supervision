# Déploiement et développement

## Render

1. Dashboard Render › New › Blueprint › dépôt `Supervision` : crée le projet « Supervision » (API Starter, base PostgreSQL, site statique).
2. Variables à saisir (aucune valeur dans le dépôt) :
   - `supervision-api` : `CORS_ORIGIN` (adresse de supervision-web), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (un vrai `mailto:` ou une vraie URL, sinon Apple refuse), `RENDER_API_KEY`, `PROCEDIA_URLS`, les `*_RENDER_SERVICES`.
   - `supervision-web` : `VITE_API_URL` (adresse de supervision-api).
   Les jetons `*_INGEST_TOKEN` sont générés par Render : les recopier dans `SUPERVISION_INGEST_TOKEN` de chaque appli.
3. Clés VAPID : `npx web-push generate-vapid-keys` (une seule fois).
4. Après le premier démarrage, `ADMIN_PASSWORD` peut être retirée (le compte existe en base).

Coût : API Starter + petite base payante (la base gratuite expire après 30 jours) ; le site statique est gratuit.

## En local

```bash
cd backend
cp .env.example .env            # puis compléter
DATABASE_URL=postgresql://…localhost… npx prisma migrate deploy
DATABASE_URL=postgresql://…localhost… npm run dev   # API sur le port 4100
cd ../frontend && npm install && npm run dev        # appli sur le port 5173
```

Toujours passer `DATABASE_URL` explicitement : `dotenv` ne remplace pas une variable déjà présente dans l'environnement. `MONITOR_ENABLED=false` coupe la boucle de vérification.

## Vérifications avant mise en ligne

```bash
cd backend && npx tsc --noEmit && npx vitest run
cd frontend && npx tsc -b --noEmit && npm run build
```

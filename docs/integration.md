# Brancher une appli

Préfixes de variables : `MGA`, `SITE_AUTONOVA`, `YIRI`, `MY_FAMILY`, `PROCEDIA`.

## 1. Disponibilité (rien à toucher dans l'appli)

Adresses surveillées par défaut (`backend/src/config/apps.ts`) :

| Appli | Adresses | Intervalle |
|---|---|---|
| MGA | API `/health`, appli web | 1 min |
| Site Autonova | page d'accueil | 5 min |
| Yiri Invest | `/manifest.json`, `/app` | 1 min |
| My Family | aucune (pas encore en ligne) | 5 min |
| Procedia | aucune par défaut : renseigner `PROCEDIA_URLS` | 30 min |

Remplacer ou compléter avec `<PREFIXE>_URLS` : liste séparée par des virgules au format `id|libellé|adresse` (une adresse contenant `health` est lue comme une route de santé). `<PREFIXE>_INTERVAL_SEC` change l'intervalle.

**Procedia (offre gratuite Render)** : chaque vérification réveille le service, qui reste ensuite éveillé 15 minutes. Avec une vérification toutes les 30 min, il est éveillé environ la moitié du temps, soit ~360 h par mois sur les 750 h gratuites du compte (partagées entre tous les services gratuits). Ne pas descendre sous 30 min sans passer Procedia en Starter.

## 2. Journaux et alertes

1. Côté supervision : `<PREFIXE>_INGEST_TOKEN` (généré par Render pour MGA, Yiri, Procedia et My Family).
2. Côté appli : `SUPERVISION_URL` (adresse du service `supervision`) et `SUPERVISION_INGEST_TOKEN` (même valeur).
3. Copier le module :
   - Node : `clients/node/supervision.ts`
     ```ts
     export const supervision = createSupervision({ url: process.env.SUPERVISION_URL, token: process.env.SUPERVISION_INGEST_TOKEN, source: "backend" });
     supervision.mirrorConsole();          // tous les console.* partent aussi ("[module] …" → source)
     supervision.captureProcessErrors();
     app.use(supervision.expressErrorLogger); // avant errorHandler
     supervision.warn("Envoi push refusé", { garage, code });
     await supervision.alert("paiements-wave", "Paiements Wave en échec", "3 échecs en 10 min");
     ```
   - Python : `clients/python/supervision_client.py`
     ```python
     logging.getLogger().addHandler(SupervisionHandler(os.getenv("SUPERVISION_URL"), os.getenv("SUPERVISION_INGEST_TOKEN"), source="webhook"))
     supervision_alert("recap-brvm", "Récap BRVM non envoyé", detail)
     ```
   Sans ces variables, les modules ne font rien : l'appli tourne comme avant. Les envois sont groupés toutes les 5 s (immédiats pour une erreur) et gardés en mémoire si la supervision est injoignable.

**Ne jamais envoyer de données sensibles** dans les messages ou le contexte : mots de passe, jetons, numéros de carte, contenu de documents. Préférer des identifiants.

## 3. Actions super administrateur

L'appli expose trois routes protégées par `SUPERVISION_ADMIN_TOKEN` (en-tête `Authorization: Bearer …`) :

| Route | Réponse |
|---|---|
| `GET /supervision/actions` | `{ actions: [{ id, label, description?, danger?, params?: [{ name, label, type?, required? }] }] }` |
| `GET /supervision/summary` | `{ metrics: [{ label, value, hint? }] }` |
| `POST /supervision/actions/:id` corps `{ params, by }` | `{ ok, message?, data? }` |

Aides prêtes à l'emploi : `supervisionAdminRouter(express.Router, { token, actions, summary })` (Node) et `supervision_fastapi_router(actions, summary)` (Python).

Côté supervision : `<PREFIXE>_ADMIN_URL` (adresse de base de l'appli, sans `/supervision`) et `<PREFIXE>_ADMIN_TOKEN` (même valeur que `SUPERVISION_ADMIN_TOKEN` dans l'appli).

Chaque action est confirmée dans l'interface et tracée (qui, quand, paramètres, résultat). Une action marquée `danger` affiche un avertissement.

## 4. Render

`RENDER_API_KEY` (compte Render › Account Settings › API Keys) et `<PREFIXE>_RENDER_SERVICES` : identifiants `srv-…` des services de l'appli, séparés par des virgules. Donne l'état du dernier déploiement et les boutons Redémarrer / Redéployer.

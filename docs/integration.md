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
| Procedia | API `/api/health` (réveillée par la vérification, ~1 min), appli web | 30 min |

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

## 2 bis. Tâches planifiées

Envelopper chaque tâche avec le module Node, au moment de la programmer :

```ts
const run = supervision.job("rappels-veille", { label: "Rappels de RDV de la veille", cron: "0 20 * * *" }, runDayBeforeReminderCheck);
cron.schedule("0 20 * * *", () => run().catch(console.error), { timezone: "UTC" });
```

- `cron` : le même horaire que le planificateur, 5 champs, **UTC**. `graceMinutes` (15 par défaut) : délai avant d'alerter.
- La fonction enveloppée garde le même comportement (résultat, erreur). Un résultat numérique devient « N élément(s) traité(s) » ; `summarize` permet un message sur mesure.
- La tâche apparaît dans l'onglet Tâches dès sa première exécution.

## 3. Actions super administrateur

L'appli expose trois routes sous `/api/supervision`, **signées** par la Supervision : en-têtes `X-Supervision-Timestamp` (millisecondes) et `X-Supervision-Signature` = HMAC-SHA256(clé, `horodatage.MÉTHODE.chemin.corps`), chemin relatif à `/supervision` (ex. `/actions/deconnecter`), corps JSON compact (vide pour un GET). Refus si la signature est fausse ou l'horodatage à plus de 5 minutes.

**Clé** : `SUPERVISION_ADMIN_TOKEN` côté appli et `<PREFIXE>_ADMIN_TOKEN` côté supervision si l'on veut l'imposer ; sinon (cas normal) elle est **dérivée du jeton d'envoi des journaux** déjà partagé (HMAC-SHA256(jeton, "supervision-admin")) : rien à saisir.

| Route | Réponse |
|---|---|
| `GET /supervision/actions` | `{ actions: [{ id, label, description?, danger?, params?: [{ name, label, type?, required? }] }] }` |
| `GET /supervision/summary` | `{ metrics: [{ label, value, hint? }] }` |
| `POST /supervision/actions/:id` corps `{ params, by }` | `{ ok, message?, data? }` |

Aides prêtes à l'emploi : `supervisionAdminRouter(express.Router, { ingestToken, actions, summary })` à monter sur `/api/supervision` (Node, après `express.json()`) et `supervision_fastapi_router(actions, summary)` (Python/FastAPI). Une action qui lève une erreur renvoie 422 avec son message (refus lisible). Une valeur à montrer une seule fois (code, mot de passe temporaire) va dans `data.display` : jamais dans `message`, qui est tracé.

Côté supervision : adresse d'administration connue par défaut pour MGA, Yiri et Procedia (`<PREFIXE>_ADMIN_URL` pour la remplacer).

Chaque action est confirmée dans l'interface et tracée (qui, quand, paramètres, résultat). Une action marquée `danger` affiche un avertissement.

## 3 bis. Clients de l'appli

Option `tenants` de `supervisionAdminRouter` (Node) ou de `supervision_fastapi_router` (Python) : `{ label, list, detail }`.

- `GET /supervision/tenants` → `{ label: "Garages", items: [{ id, name, subtitle?, badges?, fields?: [{ label, value }] }] }`
- `GET /supervision/tenants/:id` → `{ name, subtitle?, sections: [{ title, items: [{ label, value }] }] }` (404 si inconnu)

**Règle** : caractéristiques, contacts professionnels, comptages et dates seulement. Jamais de montants (chiffre d'affaires, encaissements, factures), ni contenu de dossier, ni données des clients du client.

## 4. Render

Seule saisie : `RENDER_API_KEY` sur le service `supervision` (Render › Account Settings › API Keys › Create API Key). Donne l'état du dernier déploiement et les boutons Redémarrer (services web) / Redéployer.

Les services de chaque appli sont **reconnus automatiquement** dans la liste des services du compte (gardée 10 minutes en mémoire) :

| Appli | Reconnu par son nom | ou par son adresse |
|---|---|---|
| MGA | `garage-…`, `mga-…` | adresses surveillées, `garage-frontend-a7uv.onrender.com` |
| Site Autonova | contient `autonova` | adresse surveillée |
| Yiri Invest | contient `brvm` ou `yiri` | adresse surveillée |
| My Family | contient `family` | adresse surveillée |
| Procedia | `procedia-…` | adresses surveillées |

Le service `supervision` n'est rattaché à aucune appli. Pour imposer une liste précise : `<PREFIXE>_RENDER_SERVICES` (identifiants `srv-…` séparés par des virgules), prioritaire sur la reconnaissance automatique.

« Coupure du service » suspend tous les services reconnus pour l'appli (onglet Administration) : vérifier la liste affichée avant de confirmer.

La clé API Render donne accès à tout le compte Render : elle ne se saisit que dans l'onglet Environment du service `supervision`, jamais ailleurs.

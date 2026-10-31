# Modules d'envoi

Fichiers à copier dans chaque appli supervisée (voir `docs/integration.md`) :

- `node/supervision.ts` : applis Node/Express (MGA, Procedia, My Family). Copie en place dans MGA : `backend/src/utils/supervisionClient.ts` (v0.87.0).
- `python/supervision_client.py` : applis Python/FastAPI (Yiri Invest).

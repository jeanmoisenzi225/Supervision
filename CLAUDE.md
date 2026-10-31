# Supervision — consignes du dépôt

## Versioning (même règle que MGA, détail dans CHANGELOG.md)

- Format **v0.MINEUR.CORRECTIF** tant que l'appli n'est pas en production.
- Évolution livrée : MINEUR + 1, CORRECTIF remis à 0. Correction : CORRECTIF + 1.
- **Ne jamais passer en v1.0.0** sans décision explicite du propriétaire du produit.
- Documentation, backlog ou outillage de test seuls : pas de changement de version.
- À chaque évolution ou correction, dans le même commit : `frontend/src/version.ts`, `frontend/package.json`, `backend/package.json`, entrée datée en tête de `CHANGELOG.md`.

## Suivi

- `BACKLOG.md` : demandes et décisions, une section numérotée par chantier.
- `docs/` : documentation (index `docs/README.md`), à mettre à jour dans le même commit que le code.
- Jamais de secret dans le dépôt ni la documentation : noms de variables seulement.
- Échanges avec le propriétaire du produit en français.
- Variables d'environnement à saisir par le propriétaire (Render, etc.) : donner **chaque nom et chaque valeur dans son propre bloc de code**, jamais dans un tableau, pour qu'il puisse les copier un par un depuis son téléphone (demande du 2026-10-31). Proposer aussi un bloc unique au format `.env` pour le bouton « Add from .env » de Render.

## Tests

- Avant chaque mise en ligne : `npx tsc --noEmit` et `npx vitest run` (backend), puis `npx tsc -b --noEmit` et `npm run build` (frontend), et `python3 -m unittest clients/python/test_supervision_client.py` si le module Python change.
- Pas de workflow GitHub Actions automatique sans l'accord du propriétaire (quota de minutes).
- En local, toujours passer `DATABASE_URL` explicitement vers une base locale : l'environnement peut contenir une adresse de base de production.

## Git (décision du propriétaire du 2026-10-31)

- Branches de travail nommées **`njmdev/<sujet>`** (jamais `claude/…`).
- Messages de commit sans mention « Co-Authored-By: Claude » ni lien de session : seul le message lui-même.
- Le nom de ce fichier (`CLAUDE.md`) est conservé : c'est lui qui porte les consignes lues à chaque session.

# Supervision

Tableau de bord unique pour superviser tous nos projets :

| Appli | Ce qui est surveillé |
|---|---|
| **MGA · My Autonova** | API et appli web |
| **Site Autonova** | Site vitrine (alimenté par My Autonova) |
| **Yiri Invest** | Serveur de l'agent WhatsApp et appli web |
| **My Family** | À brancher dès la mise en ligne |
| **Procedia** | API (offre gratuite Render, vérifiée toutes les 30 min) et appli web |

## Ce que fait l'appli

- **Disponibilité en temps réel** : chaque adresse est interrogée (toutes les minutes pour MGA et Yiri), avec temps de réponse, taux de disponibilité sur 24 h et frise heure par heure.
- **Alertes** : une panne ouvre une alerte après 2 échecs de suite et la referme toute seule au retour ; les erreurs envoyées par les applis et leurs alertes métier aussi. Une même erreur répétée reste une seule alerte, avec un compteur. Notification push sur le téléphone.
- **Journaux** : chaque appli envoie ses journaux (petit module à copier, Node ou Python) ; consultation par appli ou toutes ensemble, filtre par niveau, recherche, mode « en direct ». Conservation 30 jours.
- **Ressources** : mémoire, processeur, trafic et temps de réponse des services, disque et expiration des bases (graphiques et alertes), crédit et clé Claude surveillés.
- **Couper la supervision** d'une ou plusieurs applis pendant une maintenance, **diagnostic complet** d'une appli en un clic (avec « Tout relancer »), et **coupure complète du service** d'une appli (mise hors ligne sur Render) avec remise en service.
- **Actions super administrateur** : redémarrer ou redéployer un service Render, et les actions propres à chaque appli (protocole `/supervision`), avec chiffres clés et historique de qui a fait quoi.
- **Appli installable (PWA)** sur téléphone et ordinateur.

## Organisation

| Dossier | Rôle |
|---|---|
| `backend/` | API Node/Express/Prisma (PostgreSQL) : vérifications, alertes, réception des journaux, actions ; sert aussi l'interface |
| `frontend/` | Appli web React/Vite installable |
| `clients/` | Modules d'envoi à copier dans les applis supervisées |
| `docs/` | Documentation (index `docs/README.md`) |

Statut : **v0.6.0** — socle complet ; branchement des applis à faire (voir `BACKLOG.md`).

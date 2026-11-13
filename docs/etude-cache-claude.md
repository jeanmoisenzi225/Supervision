# Étude : cache de prompts Claude (2026-11-13)

Déclencheur : notification de la Console Claude (« taux de succès du cache de prompt faible : 12 % sur 7 jours, jusqu'à 36 $ par mois, 17 % des dépenses directes d'API », hors Claude Code). Dépense directe implicite : environ 36 / 0,17 ≈ **210 $ par mois**, cohérente avec la Supervision (Procedia : 8,50 $ + 74,95 $ « Espace par défaut » au 13/11, soit ≈ 190 $ sur 30 jours).

## 1. Ce que dit le mécanisme

- Le cache est un **préfixe** (outils → consigne système → messages) : seul un début de requête **identique octet pour octet** est relu. Lecture ≈ 0,05 à 0,1 × le prix d'entrée ; **écriture 1,25 ×** (cache de 5 min) ou 2 × (1 h).
- Il ne rapporte que si le même préfixe revient **dans les 5 minutes** (ou 1 h). Seuil de rentabilité : environ **0,26 reprise par écriture** (Sonnet 5.5, lecture à 0,05 ×). En dessous, le cache **coûte plus** qu'il ne rapporte.
- Seuil minimal d'un préfixe cachable : 512 jetons (Sonnet 5.5, Opus 5.5), 1 024 (Sonnet 5).

## 2. Procedia (traitement des imports et analyses)

Aucun `cache_control` dans `askClaude`. Mesures de taille (estimation 3,3 caractères par jeton) :

| Appel | Consigne système | Schéma de sortie | Document / contenu |
|---|---|---|---|
| Import (Sonnet 5.5) | ≈ 1 260 jetons | ≈ 880 jetons | le document (variable, jusqu'à 100 000 jetons et plus) |
| Analyse (Opus 5.5) | ≈ 460 jetons | ≈ 230 jetons | la procédure (variable) |

- **Cacher la consigne et le schéma** (≈ 2 100 jetons) : gain ≈ 0,004 $ par import qui arrive dans les 5 minutes d'un autre. Même un lot de 20 documents ne rapporte que ≈ 0,07 $. **Négligeable** (≈ 2 $ par mois pour 500 imports).
- **Cacher le document** : le document est le gros du coût d'entrée, mais il est **différent à chaque import**. Écrire coûte 25 % de plus sur chaque document ; la relecture ne vaut que si le même document est renvoyé. Rentable seulement au-delà de ≈ 0,26 renvoi par document.
- **Cause probable de la notification** : les **boucles de redémarrage du 12 et 13/11**. Le même PDF volumineux a été renvoyé à l'identique des dizaines de fois (nouvelle tentative automatique 4 s après chaque arrêt, deux imports en parallèle), chaque envoi payant l'entrée complète (et une partie de la sortie) sans résultat. C'est exactement le « contenu répété » détecté par Anthropic. **La correction de fond est faite** (Procedia v0.59.0 à v0.60.0 : plus de renvoi automatique, limite par poids, mémoire réduite). Elle économise bien plus que n'importe quel cache.
- Une fois les arrêts terminés, le taux de renvoi redevient faible (nouvelle tentative manuelle seulement) : **ne pas cacher les documents**.
- Le coût estimé (`pricing.ts`) a deux écarts : lecture de cache de Sonnet 5.5 à 0,20 $ (tarif publié : 0,10 $) et jetons d'écriture de cache comptés au prix d'entrée (tarif réel : 1,25 ×). Sans effet tant qu'on ne cache rien ; à corriger si on active le cache.

## 3. Agent WhatsApp BRVM / Yiri Invest (dépôt jmdev) : hors périmètre

**Correction du 2026-11-13 (après vérification)** : le canal WhatsApp est coupé dans le code depuis la v0.39.0 du 17/09, et le service Render `Agent-brvm` est **suspendu depuis le 03/11/2026 (11:26 UTC)**, par le propriétaire. Il ne fait donc **aucun appel à Claude** depuis 10 jours : la notification du 13/11 (7 derniers jours) ne contient aucun trafic de l'agent, **tout vient de Procedia**. Le tableau ci-dessous décrit l'agent tel qu'il était, à titre d'archive ; ses recommandations ne s'appliquent plus tant qu'il reste suspendu.

Modèle par défaut `claude-sonnet-5`. Journalise déjà `cache_read_tokens` et `cache_creation_tokens` par tâche (commande admin `USAGE`).

| Tâche | Fréquence | Cache actuel | Verdict |
|---|---|---|---|
| Veille multi-sources | toutes les 45 min | consigne en **1 h** | **Bon** : chaque passage relit et prolonge l'entrée (une écriture, puis que des lectures) |
| Assistant conversationnel | rafales, faible volume | 4 blocs, dont le contexte BRVM et le statut d'abonnement | **À vérifier** : les blocs stables ne profitent que de deux messages à moins de 5 min d'écart ; le dernier bloc change toutes les ~15 min et selon l'abonné, donc il est surtout **écrit à 1,25 × sans être relu** |
| Quiz, digest, récap hebdomadaire, analyse de variations, chiffres clés, analyse fondamentale, import de portefeuille | 1 par jour à 1 par semaine, ou à la demande | aucun | Cache **inutile** : écart largement supérieur à 5 min et à 1 h |
| Veille du marché | toutes les 6 h | aucun | Idem |

## 4. Recommandations (par ordre d'intérêt)

1. **Ne rien changer sur les documents de Procedia** : la cause (renvois en boucle) est supprimée ; un cache de document augmenterait le coût des imports normaux.
2. **Mesurer avant de cacher** : la Supervision peut lire le rapport d'usage de l'API Admin (jetons non cachés, relus et écrits par espace de travail et par modèle) et afficher le **taux de cache par appli** sur la page Claude. C'est la preuve chiffrée manquante ; l'agent BRVM la fournit déjà par `USAGE`.
3. **Agent BRVM** : sans objet tant que le service est suspendu (voir § 3).
4. **Procedia, consigne et schéma** : possible mais sans enjeu (≈ 2 $ par mois). À faire seulement si on veut aligner la pratique, avec correction de `pricing.ts`.
5. **Leviers qui comptent davantage pour Procedia** : les jetons de **sortie** (10 $ par million sur Sonnet 5.5, un import long en produit des dizaines de milliers) et les imports **perdus** (échecs, arrêts). Piste produit : traitement différé par lot (API Batches, −50 %) pour les gros lots non urgents.

## 5. Limites de cette étude

Estimations de taille faites sur le code, sans mesure de jetons réelle (clé d'API non disponible en développement) ; dépense par appli lue sur la Supervision au 13/11. Les chiffres de rentabilité supposent les tarifs publiés (Sonnet 5.5 : entrée 2 $, lecture 0,10 $, écriture 2,50 $ par million).

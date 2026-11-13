# Journal des versions

## v0.26.0 — 2026-11-13

Demandé le 2026-11-13 (incident Procedia : arrêts « mémoire saturée »).

- **Alerte sur les arrêts du service signalés par Render.** Toutes les 10 minutes, la Supervision lit les événements « service arrêté » (`server_failed`) de chaque service Render d'une appli. Un arrêt pour **mémoire saturée** ouvre l'alerte « service arrêté : mémoire saturée » (avertissement, notification push) ; chaque nouvel arrêt incrémente son compteur ; elle se referme seule après 2 heures sans arrêt. Les autres arrêts (« par la plateforme ») sont signalés de la même façon. Render publie ces événements 15 à 30 minutes après l'arrêt réel : l'alerte est tardive mais rend visibles les boucles de redémarrage. Nécessite `RENDER_API_KEY` (déjà configurée).

- **Correction : espace de travail Claude non rattaché à son appli.** Sur la page Coûts, la carte Procedia n'affichait que « Espace par défaut » (74,95 $) : l'espace « Procedia » (8,50 $) restait à part. Le rattachement exigeait un nom **identique au caractère près** ; un espace en trop (fréquent à la saisie sur téléphone), une espace insécable, la casse ou un accent suffisaient à le faire échouer. Il est désormais **tolérant** : le nom de l'espace doit contenir le nom donné dans `<APPLI>_CLAUDE_WORKSPACE`, sans tenir compte de la casse, des accents ni des espaces en trop. Les noms des espaces s'affichent entre guillemets pour repérer ces écarts.

## v0.25.0 — 2026-11-13

Demandé le 2026-11-13 : « les deux montants concernent Procedia mais sont dissociés, comment les cumuler ? » (espace « Procedia » 8,50 $ et « Espace par défaut » 74,95 $).

- **Page Claude : section « Ce mois-ci, par appli »** : les espaces de travail d'une même appli sont cumulés (par exemple Procedia = « Procedia » + « Espace par défaut », avec le détail), le reste figure sous « Non rattaché à une appli ». Le rattachement se règle avec `<APPLI>_CLAUDE_WORKSPACE` (noms séparés par des virgules) sur le service supervision, comme pour la page Coûts.
- **Facture prévisionnelle : une seule ligne Claude par appli**, cumulant ses espaces de travail (au lieu d'une ligne par espace) ; le montant en dollars d'origine suit le taux comme les autres lignes importées.

## v0.24.1 — 2026-11-12

- **Correction : dépenses Claude du jour manquantes.** La page Claude (et Coûts, et l'alerte de budget) affichait 52,07 $ pour le mois et 0,00 $ « aujourd'hui », alors que la Console Anthropic indiquait 82,88 $ : le rapport de coûts d'Anthropic ne renvoie que les journées **terminées** quand on ne précise pas `ending_at`. La Supervision demande désormais jusqu'à la fin de demain, donc la **journée en cours est comptée** (avec le retard de quelques minutes d'Anthropic) ; si Anthropic refusait ce paramètre, elle revient à l'ancienne demande.

## v0.24.0 — 2026-11-12

Décidé le 2026-11-12 : « revenons aux vrais taux finalement, j'ajusterai moi-même ».

- **Retour au taux de marché (BCE) par défaut** pour convertir les coûts : le champ « taux » est prérempli avec le taux du jour (à la date du document), et reste modifiable à la main ; les lignes importées se recalculent toujours quand on le change. La parité commerciale 1 $ = 1 € (v0.22.0) reste disponible comme réglage dans Paramètres.
- Migration `20261112160000_billing_fx_market` : si le réglage avait déjà été enregistré, il repasse à « taux de marché ».

## v0.23.0 — 2026-11-12

Demandé le 2026-11-12 : « quand je modifie le taux après l'import, les montants doivent s'ajuster automatiquement en bas ».

- **Les lignes importées suivent le taux** : changer le taux (ou la devise) recalcule aussitôt leurs prix, et les totaux HT, TVA et TTC du bas suivent. Chaque ligne importée garde son montant d'origine en dollars, enregistré avec la facture : la facture rouverte se recalcule aussi.
- Une ligne dont on modifie le prix à la main n'est plus recalculée (mention « prix modifié à la main ») ; les lignes libres ne changent jamais.
- Changer de devise repart du taux retenu de la nouvelle devise.
- Migration `20261112150000_billing_usd_amount` (montant en dollars des lignes importées).

## v0.22.0 — 2026-11-12

Décidé le 2026-11-12 : « dans notre cas on va facturer 1 $ = 1 € ».

- **Parité commerciale 1 $ = 1 €** par défaut pour convertir les coûts d'hébergement et Claude d'une facture prévisionnelle : en euros, les montants de Render sont repris tels quels (13,30 $ → 13,30 €) ; en FCFA, au cours fixe de l'euro (1 $ = 655,957 FCFA). Aucun appel à un service de change dans ce mode.
- **Réglage** dans Paramètres : « Conversion des coûts », parité commerciale (par défaut) ou taux de marché (BCE, v0.21.0). Le taux reste modifiable sur chaque facture ; le garde-fou contre les taux hors d'unité s'applique au taux retenu.

## v0.21.0 — 2026-11-12

Demandé le 2026-11-12 : « la conversion crée une facture fausse, récupère les taux de conversion automatiquement ». Cause : un taux saisi dans la mauvaise unité (655,957, qui est le nombre de FCFA pour un euro, saisi comme « dollars pour un euro ») donnait 8 724 € au lieu d'environ 12 €.

- **Taux de change repris automatiquement** (BCE via Frankfurter, fichier de la BCE en secours), à la date du document ; FCFA déduit de l'euro (parité fixe 1 € = 655,957 FCFA). Le champ « taux » est prérempli, indique sa source et sa date, et reste modifiable (« Reprendre le taux du marché »). L'import fonctionne sans rien saisir.
- **Garde-fou** : un taux saisi à plus de 50 % du taux du marché est signalé en rouge à l'écran et refusé à l'import (« vérifie l'unité »).
- Route `GET /api/billing/fx` ; le résultat de l'import indique le taux et sa source.
- Une facture enregistrée avec un mauvais taux doit être réimportée (« Importer l'hébergement du client ») : les lignes importées sont remplacées.

## v0.20.1 — 2026-11-12

- **Import de l'hébergement d'un client** (cas d'Autonova Group) : le résultat s'affiche désormais **à côté du bouton** (le message d'erreur était en haut de page, hors de vue sur téléphone). Message explicite quand il n'y a rien à importer (postes gratuits, par exemple le site statique : rattacher aussi MGA au client), rappel des applis rattachées au client, et raison du bouton grisé (client ou taux manquant).
- Si Render limite ses demandes (429), la dernière liste de services et de bases connue est reprise au lieu d'échouer.

## v0.20.0 — 2026-11-12

Demandé le 2026-11-12 : « comme NJM Supervision, on crée un module NJM Facturation qui va gérer la facturation ».

- **Nouveau module « NJM Facturation »** dans le menu général de NJMDev, à côté de NJM Supervision (et de NJM Website, encore grisé) : carte avec le nombre de clients et de factures, cadre propre (en-tête « NJMDev | Facturation », retour au menu par le logo), adresse `/facturation`.
- La page Facturation quitte la navigation de NJM Supervision (qui garde « Coûts ») ; l'ancienne adresse `/supervision/facturation` redirige vers le nouveau module.
- Liste des factures en cartes (aperçu, PDF, modification, suppression accessibles sur téléphone sans défilement horizontal).

## v0.19.0 — 2026-11-12

Demandé le 2026-11-12 : « à partir du module facturation, on facture chaque client ; facture prévisionnelle d'après les coûts, la vraie facture une fois que Render nous a facturé ; lignes libres pour les coûts de développement, la main d'œuvre, l'e-mail… ; lignes d'hébergement récupérées telles quelles mais modifiables ».

- **Facture prévisionnelle** : nouvelle nature de document (par défaut), avec mois concerné ; aperçu A4 et PDF marqués « PRÉVISIONNELLE », mention que la facture définitive suivra la facturation de l'hébergeur.
- **Client ↔ applis** : la fiche client indique les applis dont l'hébergement lui est facturé.
- **Import des coûts** : un bouton reprend, tels quels, les postes d'hébergement (services, bases, stockage) et, au choix, les dépenses Claude du mois en cours des applis du client, convertis au taux saisi (1 dollar = …). Lignes modifiables, origine conservée ; offre inconnue signalée.
- **Lignes libres** (développement, main d'œuvre, messagerie e-mail, support) en un geste.
- Migration `20261112140000_billing_forecast` (applis du client, nature, mois, taux, origine des lignes).

## v0.18.0 — 2026-11-12

Demandé le 2026-11-12 : « rajouter le module de facturation sur la prod de la supervision ».

- **Module Facturation NJMDev** (branche `njmdev/facturation`, jusqu'ici sur le service de test `supervision-staging`) ajouté à la production : fiches clients, brouillons de facture (lignes, quantités, prix HT, remises, TVA), aperçu A4, PDF « BROUILLON » avec le logo NJMDev, calculs exacts côté serveur, devise XOF par défaut (XOF, EUR, USD). Émission officielle désactivée tant que le profil légal n'est pas renseigné. Nouvelles tables PostgreSQL (clients, factures, lignes), migration appliquée au démarrage.
- La page de coûts estimés par appli (v0.17.0, ex-« Facturation ») devient **« Coûts »** (`/supervision/couts`, route `GET /api/hosting-costs`) : le nom « Facturation » revient au module de facturation des clients.
- Historique de la branche fusionnée (numérotation propre à la branche, avant fusion) : voir ci-dessous.

## v0.17.0 — 2026-11-12

Demandé le 2026-11-12 : « intégrer la facturation par application ».

- **Page « Facturation »** : pour chaque appli (MGA, site Autonova, Yiri Invest, My Family, EDEN Supervision, Procedia) et pour NJMDev lui-même, le coût de l'**hébergement Render par mois** (estimation d'après l'offre de chaque service, base et disque, au tarif public de Render) et les **dépenses Claude du mois en cours** (réelles, par espace de travail), avec le total. Constat sur le compte au 12/11 : environ 52,55 $ par mois d'hébergement (dont Procedia 14,50 $, MGA 13,30 $, NJMDev 17,50 $).
- Render ne fournit pas sa facturation par l'API : c'est une **estimation** (hors bande passante, minutes de construction et forfait de l'espace de travail), la facture exacte reste dans Render › Billing. Une offre inconnue est signalée, jamais inventée ; un service suspendu ne compte plus son instance.
- Route `GET /api/billing` ; tarifs dans `backend/src/modules/billing/prices.ts` ; rattachement des espaces Claude par leur nom (ou `<PREFIXE>_CLAUDE_WORKSPACE`).

## v0.16.5 — 2026-11-12

- **Procedia en offre payante Render** (API Starter, base payante, constaté via l'API Render) : vérification **chaque minute** au lieu de 30 minutes, plus de délai de réveil (délai d'attente des appels ramené à 30 s, seuil de lenteur du diagnostic à 5 s, mentions « service gratuit mis en veille » retirées pour Procedia). Documentation mise à jour : hébergement des applis (offres Render constatées), règle de réveil de l'offre gratuite devenue historique.

## v0.16.4 — 2026-11-12

- **Icône de l'appli installée** : l'iPhone gardait l'ancienne icône (électrocardiogramme) en mémoire, sous le même nom de fichier. Les icônes NJMDev ont de nouveaux noms (`njmdev-*.png`), ce qui oblige le téléphone à les recharger à la réinstallation.

## v0.16.3 — 2026-11-12

- Onglet « Imports » de Procedia : avec Procedia v0.58.0, **tous les imports depuis le 3/11** sont comptés et rattachés à leur client par leur catégorie ; libellé des imports sans client ajusté (catégorie supprimée depuis l'import).

## v0.16.2 — 2026-11-12

- Onglet « Imports » de Procedia : nombre d'imports qui ne peuvent être rattachés à aucun client, sous le tableau « Par client » (avec Procedia v0.57.1, qui corrige le rattachement : « aucun import dans l'historique » en touchant BNI).

## v0.16.1 — 2026-11-12

- **Correction : jauge « Disque » des bases vide** (« — » sur procedia-db alors que le disque fait 5 Go). Render ne renvoie plus la ligne « taille de la base entière » : la taille est désormais calculée en additionnant les tables de la base (environ 1,1 Go sur 5 Go pour procedia-db). L'historique relevé toutes les heures reprend aussi.
- **Limite de demandes de Render (« 429 rate limit exceeded »)** : la dernière valeur connue de chaque mesure est réutilisée au lieu d'un trou, le message devient « Render limite le nombre de demandes : réessayer dans une minute », et l'actualisation par glissement ne relit pas Render plus d'une fois par minute.
- L'offre d'une base s'affiche lisiblement (« 0,1 processeur · 256 Mo de mémoire ») : ce n'est pas la taille du disque, qui se règle à part.

## v0.16.0 — 2026-11-12

Demandé le 2026-11-12 : « on rajoute un geste de glisser pour l'actualisation de la sup, du haut vers le bas » (la taille du disque de la base Procedia restait affichée à 1 Go après son agrandissement, faute d'actualisation).

- **Tirer pour actualiser** : en haut d'une page, glisser vers le bas puis relâcher recharge les données affichées (une pastille « Tirer pour actualiser » / « Relâcher pour actualiser » / « Actualisation… » accompagne le geste). Disponible partout dans l'appli, y compris sur l'appli installée sur téléphone. Un glissement court ne fait rien ; une zone qui défile déjà (liste, tableau) garde son défilement.
- **Données vraiment fraîches** : l'actualisation manuelle envoie `X-Refresh: 1` ; le serveur ignore alors ses mémoires tampons (ressources Render : 2 minutes, liste des bases Render : 10 minutes, dépenses Claude : 10 minutes) et relit les sources. L'actualisation automatique garde ses délais.

## v0.15.0 — 2026-11-11

Demandé le 2026-11-11 : « l'application globale s'appelle NJMDev ; en entrant, on arrive sur un menu général ; seule fonctionnalité disponible : NJM Supervision ; NJM Website grisé pour l'instant ; logo NJMDev ».

- **L'appli devient NJMDev** : nom (onglet, écran d'accueil du téléphone, notifications), **logo NJMDev** officiel (celui de MGA « Powered by NJMDev ») sur l'écran de connexion, dans l'en-tête et comme icône de l'appli installée.
- **Menu général** à l'ouverture : carte **NJM Supervision** (avec l'état d'ensemble : tout fonctionne ou applis en difficulté, alertes) et carte **NJM Website** grisée (« Bientôt »).
- Le module Supervision passe sous `/supervision/…` ; le logo de l'en-tête ramène au menu général. Les anciennes adresses et les notifications déjà reçues continuent de fonctionner (redirection).
- Sur iPhone, l'icône de l'appli installée ne change qu'en la réinstallant (supprimer l'icône, puis Partager › Sur l'écran d'accueil).

## v0.14.0 — 2026-11-11

- **Onglet « Imports » de Procedia : comparaison par client.** Demandé : « 291 procédures pour BNI dans l'outil, la sup n'en rapporte que 139, pourquoi ? ». L'onglet affiche maintenant les fichiers importés **et les procédures qu'ils ont créées**, la **date de début du suivi**, et un tableau **par client** : procédures dans l'outil, dont importées, autres (saisies, dupliquées ou importées avant la conservation de l'origine), imports suivis. Touchez un client pour filtrer l'historique (nécessite Procedia v0.57.0).

## v0.13.1 — 2026-11-10

- **Correction** : l'onglet « Imports » répondait « 401 Non autorisé » ; la signature des appels vers les applis ignore désormais les paramètres d'adresse (`?limit=…`), comme la vérification côté appli.

## v0.13.0 — 2026-11-10

- **Onglet « Imports » de Procedia** : historique de tous les imports de documents (réussis, en échec avec la cause classée, en cours), filtres et pagination, relayé depuis la route signée `reports/imports` de Procedia (v0.51.0). Alerte visuelle tant qu'un import est en cours, pour ne pas mettre en ligne à ce moment.

### Historique de la branche « facturation » avant fusion (numéros de version de la branche)

#### Branche facturation, v0.16.0 — 2026-11-09

- Génération PDF côté serveur à la demande pour les brouillons enregistrés NJMDev.
- Téléchargement direct depuis la liste des brouillons ; le PDF porte un marquage BROUILLON et ne reçoit aucun numéro officiel ni certification FNE.
- Aucun fichier PDF n’est enregistré sur le serveur ou dans un stockage externe ; l’aperçu A4 reste disponible séparément.

#### Branche facturation, v0.15.0 — 2026-11-09

- Aperçu A4 des brouillons NJMDev avec identité commerciale et informations client, lignes, remises, TVA et totaux.
- Export PDF de travail via la fonction d’impression du navigateur ; marquage permanent BROUILLON et rappel de l’absence de certification FNE.
- La génération PDF serveur et le stockage durable restent différés aux documents officiellement émis.

#### Branche facturation, v0.14.1 — 2026-11-09

- Correction de la conservation de la devise lors de la modification d’un brouillon et recalcul cohérent des montants selon XOF/EUR/USD.

#### Branche facturation, v0.14.0 — 2026-11-09

- Facturation adaptée au cadre NJMDev en Côte d’Ivoire : entreprise individuelle au nom propre, nom commercial distinct, RCCM/NCC.
- XOF/FCFA comme devise par défaut ; devises XOF, EUR et USD prises en charge sur les brouillons.
- Retrait des taux de TVA français préremplis : taux paramétrable, 0 % par défaut tant que le régime ivoirien n’est pas confirmé.
- Préparation documentaire au dispositif DGI/FNE ; aucune émission officielle ni certification simulée.

#### Branche facturation, v0.13.0 — 2026-11-09

- **Facturation NJMDev (première phase)** : nouvelle entrée Facturation dans la navigation, fiches clients (création, modification, archivage), brouillons de facture multi-lignes, remises et taux de TVA par ligne.
- Calculs HT, TVA et TTC effectués côté serveur avec des décimales exactes ; seules les factures en brouillon sont modifiables ou supprimables.
- Paramètres commerciaux NJMDev séparés de l'identité juridique ; émission officielle explicitement désactivée tant que le vendeur n'est pas juridiquement configuré.
- Nouvelle migration PostgreSQL ; routes `/api/billing` protégées par le super-administrateur.


## v0.12.1 — 2026-11-08

- **EDEN Supervision** : retrait du contrôle de disponibilité de l'ancien Gateway (`eden-sup-gateway`), désormais suspendu. Seuls l'API backend et l'application web active déterminent l'état opérationnel d'EDEN.
- Fermeture automatique des alertes de panne liées à des contrôles retirés du catalogue, sans effacer l'historique des vérifications.


## v0.12.0 — 2026-11-02

Demandé le 2026-11-02 : « des rubriques par application qui reprennent tout le backlog ; à chaque évolution, la tâche change de statut ».

- **Page « Backlog »** : une rubrique par appli (MGA, Procedia, Yiri Invest, My Family, Supervision) qui reprend tout son backlog, lu directement dans son dépôt GitHub (`BACKLOG.md`, ou `ROADMAP.md` pour Yiri).
- Chaque chantier avec son **statut** (terminé, en cours, en attente, à faire, abandonné, information), ses versions, l'avancement de ses cases à cocher et son texte complet. Filtres (« À traiter », par statut, tout) et recherche.
- **Suivi automatique** : relecture toutes les 15 minutes (et bouton « Actualiser ») ; à chaque évolution livrée, le statut mis à jour dans le backlog de l'appli change dans la Supervision et le changement est historisé (« Derniers changements », historique par chantier).
- Statut déduit des marqueurs du backlog : ✅ / « fait » → terminé, 🚧 / « en cours » → en cours, ⏸ / « en attente » → en attente, ❌ / « abandonné » → abandonné, ℹ️ → information, sinon d'après les cases cochées.
- À saisir sur Render : `GITHUB_TOKEN` (jeton GitHub en lecture seule sur les dépôts).

## v0.11.1 — 2026-11-02

- MGA présentée comme la plateforme multi-garages qu'elle est : « MGA » au lieu de « MGA · My Autonova » (My Autonova n'est que l'appli du premier garage client). Les nouvelles alertes s'intitulent « MGA — … ». Le site Autonova est « alimenté par MGA ».

## v0.11.0 — 2026-11-02

Demandé le 2026-11-02 : « avoir dans l'interface les différents garages ayant acheté l'outil, et pour chaque garage ses spécificités ; on reste trop en surface, pour toutes les applis — sans les infos confidentielles de chaque client (CA…) ».

- **Onglet « Clients »** dans la fiche de chaque appli : la liste de ses clients (recherche au-delà de 6), puis la fiche détaillée de chacun, en sections.
  - MGA : les **garages** (fiche, administrateurs et contacts, équipe par métier, clients et véhicules, activité en nombres, avis, site internet, écrans TV, paiement mobile configuré).
  - Procedia : **vue d'ensemble du cabinet** et **comptes** (rôle, périmètre, activité) ; clients du cabinet comptés par secteur, jamais nommés.
  - Yiri : **vue d'ensemble des abonnés** (par registre, mode, canal), **demandes en attente** et **abonnés** (statut, préférences, accès).
- Jamais de montant (chiffre d'affaires, encaissements, factures) ni de contenu de dossier : seulement des caractéristiques, des comptages et des dates.
- Protocole : `GET /supervision/tenants` et `/supervision/tenants/:id` (signés), option `tenants` des modules Node et Python.

## v0.10.0 — 2026-11-02

- **Actions d'administration pour tout le parc** (onglet Administration de chaque appli) : MGA (notification de test, déconnexion d'un compte, code de réinitialisation, reconstruction du site, rappels de RDV, RDV manqués, actualités), Procedia (désactiver, réactiver, mot de passe temporaire), Yiri (statut, approuver, refuser, renvoyer quiz ou digest, maintenance). Chiffres clés de chaque appli.
- **Protocole signé, sans aucune variable à saisir** : clé d'administration dérivée du jeton d'envoi des journaux déjà partagé ; chaque appel est signé (HMAC-SHA256) et daté, l'appli refuse un appel non signé, modifié ou de plus de 5 minutes. Adresses d'administration de MGA, Yiri et Procedia connues par défaut.
- Information sensible (code ou mot de passe temporaire) affichée une seule fois, jamais enregistrée dans l'historique des actions.
- Refus d'une appli (compte introuvable…) affiché tel quel ; appli pas encore à jour : « pas encore branchées » au lieu d'une erreur.
- Modules d'envoi Node et Python : `supervisionAdminRouter` et `supervision_fastapi_router` vérifient les signatures.

## v0.9.0 — 2026-11-01

- **Tâches planifiées** (« rendez-vous manqués ») : chaque appli signale l'exécution de ses tâches (rappels, récap, purges…) avec leur horaire attendu ; onglet **Tâches** dans la fiche de l'appli (horaire lisible, dernière exécution, résultat, prochaine échéance, historique).
- Alertes : tâche **non exécutée** à l'heure prévue (critique, vérifié toutes les 5 minutes, marge propre à chaque tâche), tâche **en échec**, tâche **exécutée plusieurs fois** pour une même échéance (tâches au plus toutes les 6 h : risque d'envois en double). Refermées à la prochaine exécution réussie.
- Diagnostic complet : ligne « Tâches planifiées ».
- Module d'envoi Node : `supervision.job(clé, { label, cron, graceMinutes, summarize }, fonction)`.
- Horaires lus sans dépendance (expressions cron à 5 champs, UTC).

## v0.8.0 — 2026-11-01

Retour du propriétaire : « c'est normal de n'avoir aucune donnée concernant la base ? » — non : Render refuse certaines mesures sur l'offre Hobby de l'espace de travail (« query is not allowed for plan: Hobby »).

- **Taille de chaque base et de ses plus grosses tables**, par une route Render autorisée sur toutes les offres. Historique construit par la Supervision elle-même (relevé toutes les heures, conservé 90 jours, nouvelle table `ResourceSample`), puisque Render ne le fournit pas sur Hobby.
- **Temps de réponse mesuré par la Supervision** (à chaque vérification de disponibilité) en tête de l'onglet Ressources, disponible quelle que soit l'offre Render.
- Mesures refusées par Render : plus de courbe vide ni de message technique, une phrase « réservé aux offres Render supérieures à Hobby ».

## v0.7.0 — 2026-11-01

- **Page « Claude »** : dépenses de l'organisation Anthropic (rapport de coûts de l'API Admin) : ce mois-ci, hier, aujourd'hui, courbe des 30 derniers jours, répartition par modèle et par espace de travail. Demande une clé Admin Anthropic (`ANTHROPIC_ADMIN_KEY`) ; sans elle, la page explique comment la créer.
- **Budget mensuel Claude** (facultatif, `CLAUDE_MONTHLY_BUDGET_USD`) : alerte à 80 % puis critique à 100 %, vérifiée toutes les heures.
- **Disque persistant des services** (ex. Yiri, qui garde ses données sur un disque Render) : jauge et courbe dans l'onglet Ressources, alerte au-delà de 80 % (critique à 95 %), ligne dans le diagnostic complet.
- `ANTHROPIC_ADMIN_API_URL` (facultative) : adresse de l'API Admin Anthropic, remplaçable pour les essais locaux uniquement.

## v0.6.0 — 2026-11-01

- **Onglet « Ressources »** dans la fiche de chaque appli (mesures Render, sur 24 h, 7 jours ou 30 jours) : pour chaque service web, mémoire utilisée face à la limite du plan, processeur, requêtes, erreurs serveur (5xx), temps de réponse (95 % des requêtes) ; pour chaque base de données, espace disque face à sa taille, connexions actives et date d'expiration des bases gratuites. Jauges, courbes avec limite et seuil d'alerte en pointillés, valeur exacte au toucher ou au survol.
- **Alertes de ressources** (vérifiées toutes les 15 minutes) : mémoire au-delà de 85 % de la limite (critique à 95 %), disque d'une base au-delà de 80 %, base gratuite qui expire dans 7 jours ou moins (critique à 2 jours). Refermées seules quand la situation revient à la normale.
- **Incidents Claude reconnus dans les journaux** des applis : crédit épuisé, clé refusée ou absente (critiques), saturation ou limite de débit. Une alerte dédiée par incident, sans alerte d'erreur en double.
- **Diagnostic complet** enrichi : mémoire de chaque service, remplissage et expiration de chaque base.

## v0.5.0 — 2026-10-31

- **Coupure complète du service** par appli (onglet Administration › Coupure du service) : tous les services Render de l'appli sont suspendus, l'appli est hors ligne. Confirmation en retapant le nom de l'appli, motif facultatif. La supervision de l'appli est coupée en même temps (pas d'alerte de panne pour une coupure voulue).
- **Remettre en service** : services suspendus relancés et supervision reprise.
- Coupures et remises en service tracées dans l'historique des actions ; la fiche de l'appli se met à jour aussitôt.
- `RENDER_API_URL` (facultative) : adresse de l'API Render, remplaçable pour les essais locaux uniquement.

## v0.4.0 — 2026-10-31

- **Couper la supervision** d'une ou plusieurs applis (maintenance) : depuis les Réglages (plusieurs applis cochées) ou l'onglet Administration d'une appli ; pendant 1 h, 4 h, 24 h ou jusqu'à réactivation, avec un motif facultatif. Pendant la coupure : ni vérifications, ni alertes, ni notifications ; les journaux continuent d'arriver. Reprise automatique à l'échéance. Carte « Supervision coupée » sur le tableau de bord. Coupures et reprises tracées dans l'historique des actions.
- **Diagnostic complet** par appli (bouton en tête de la fiche) : adresses vérifiées à l'instant et temps de réponse, disponibilité 24 h, services Render et dernier déploiement, erreurs des dernières 24 h regroupées par message, alertes en cours, réception des journaux, actions de l'appli joignables. Compte-rendu point par point en vert, orange ou rouge.
- **Tout relancer** (depuis le diagnostic) : redémarre d'un coup tous les services web Render de l'appli ; tracé dans l'historique.

## v0.3.1 — 2026-10-31

- Activation de la double authentification : explications corrigées après le premier essai réel sur iPad (le bouton ouvre une fiche « Nouveau mot de passe » à compléter et valider ; chemin pour saisir la clé à la main).

## v0.3.0 — 2026-10-31

- **Double authentification** du super administrateur : un code à 6 chiffres (changeant toutes les 30 s, généré par le téléphone) est demandé après le mot de passe. Activation dans Réglages : bouton « Ajouter sur cet appareil » (ouvre l'appli Mots de passe sur iPhone), QR code ou clé à saisir, puis un premier code pour confirmer. Désactivation avec mot de passe et code.
- Un code ne sert qu'une fois ; 10 essais par 15 minutes au plus (connexion et réglages).
- Secours en cas de téléphone perdu : variable `ADMIN_RESET_2FA=true` sur le service `supervision`, à retirer après redémarrage.

## v0.2.0 — 2026-10-31

- Boutons Redémarrer / Redéployer : les services Render de chaque appli sont reconnus automatiquement (par leur nom ou leur adresse) ; seule la clé API Render est à saisir, plus aucun identifiant `srv-…`. `<PREFIXE>_RENDER_SERVICES` reste possible pour imposer une liste.
- « Redémarrer » n'est proposé que pour les services web (un site statique se redéploie seulement) ; type de service affiché en français ; message clair si aucun service n'est reconnu ou si Render refuse la clé.

## v0.1.5 — 2026-10-31

Module d'envoi Python (`clients/python/supervision_client.py`), utilisé par Yiri Invest 0.47.0 :

- Numéros de téléphone masqués par défaut (`22507••••••56`), fonction de masquage remplaçable (`redact`).
- Bibliothèques bavardes (uvicorn.access, httpx, httpcore, urllib3, apscheduler…) : seuls leurs avertissements et erreurs sont envoyés ; les lignes httpx contiennent les adresses appelées, jetons compris.
- Source courte tirée du nom du logger (`brvm_agent.jobs` → `jobs`, serveur → `serveur`).
- Tests du module : `python3 -m unittest clients/python/test_supervision_client.py`.

## v0.1.4 — 2026-10-31

- Procedia surveillé : API (`procedia-backend`, route de santé) et appli web (`procedia-frontend`), toutes les 30 minutes. L'API, en offre gratuite Render, se réveille en une minute environ (mesuré : 52 s) : délai de 90 s avant de la déclarer en panne. Plus besoin de `PROCEDIA_URLS`.

## v0.1.3 — 2026-10-31

Journaux, retours après les premiers journaux réels de MGA :

- Taille du texte identique sur toutes les lignes sur iPhone (iOS agrandissait de lui-même certains messages, surtout en paysage).
- Le préfixe « [module] » n'est plus répété dans le message quand le module est déjà affiché à côté (ex. « news »).

## v0.1.2 — 2026-10-31

Module d'envoi Node (`clients/node/supervision.ts`), utilisé par MGA v0.87.0 :

- `mirrorConsole()` : recopie `console.log` / `info` / `warn` / `error` vers la supervision, le préfixe « [module] » devenant la source du journal.
- `captureProcessErrors()` : une promesse rejetée non gérée arrête désormais le processus comme le fait Node par défaut (au lieu de le laisser tourner), après envoi du journal ; l'arrêt demandé par l'hébergeur (SIGTERM) est journalisé.
- Tests du module (envoi par lots, silence sans configuration, conservation si la supervision est injoignable).

## v0.1.1 — 2026-10-31

Mise en ligne simplifiée : plus aucune clé à copier dans Render.

- L'interface est servie par l'API elle-même : un seul service Render, une seule adresse, plus de `VITE_API_URL` ni de `CORS_ORIGIN` à recopier entre deux services.
- Les clés des notifications sont générées au premier démarrage et gardées en base (nouvelle table `Setting`) : plus de `VAPID_*` à saisir. Le sujet des notifications est l'adresse publique Render (https) ou, à défaut, l'e-mail du super administrateur.
- Un problème de notifications n'empêche plus jamais le serveur de démarrer.
- Seules valeurs demandées à la création du Blueprint : `ADMIN_EMAIL` et `ADMIN_PASSWORD`.

## v0.1.0 — 2026-10-27

Première version de la Supervision.

- Tableau de bord des cinq projets (MGA · My Autonova, site Autonova, Yiri Invest, My Family, Procedia) : état, temps de réponse, disponibilité sur 24 h, alertes et erreurs du jour.
- Vérification automatique des adresses (1 min pour MGA et Yiri, 5 min pour le site, 30 min pour Procedia en offre gratuite), bouton « Vérifier maintenant ».
- Alertes : panne après 2 échecs consécutifs, fermeture automatique au retour, erreurs et alertes métier envoyées par les applis, regroupement des répétitions, prise en compte et résolution manuelles.
- Notifications push des alertes sur le téléphone (PWA).
- Réception des journaux par appli (jeton propre à chaque appli), consultation avec filtres, recherche et mode en direct ; conservation 30 jours.
- Administration : redémarrage et redéploiement des services Render, protocole d'actions propres à chaque appli avec chiffres clés, historique des actions.
- Modules d'envoi à copier : Node (`clients/node`) et Python (`clients/python`).

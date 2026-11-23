# Journal des versions

## v0.52.0 — 2026-11-23

- **Notifications : de vraies icônes à la place des émojis.** Les titres ne contiennent plus d'émoji (🔴 🟠 🟢 ✍️ ✅). La notification affiche à la place une **icône classique, sans fond**, selon sa nature : disque rouge « ! » (critique), triangle ambre (avertissement), disque vert avec coche (résolu, test), feuille signée (signature) ; PNG transparents, lisibles sur fond clair comme sur fond sombre. Fichiers dans `frontend/public/notif/`. Les titres commencent par un mot (« Critique : », « Attention : », « Résolu : ») pour les appareils qui n'affichent que l'icône de l'appli, comme l'iPhone. Un test garantit qu'aucun titre de notification ne contient d'émoji.
- **Lien de signature : accès direct depuis la Supervision.** Dans l'onglet Signatures, chaque lien généré (bloc « À transmettre maintenant » et lien d'un signataire) a un bouton **« Ouvrir le lien »** qui ouvre la page de signature dans un nouvel onglet ; le code, affiché juste au-dessus, reste à saisir (procédure normale conservée).

## v0.51.2 — 2026-11-23

- **Plus aucun émoji dans l'interface.** Les triangles d'avertissement ⚠️ deviennent une icône au trait (même épaisseur que la loupe et l'engrenage) ; les pastilles 🔴 🟠 🟢 ⚪ deviennent de petits points colorés (critique, avertissement, ok, information) ; les coches et cercles ✓ ○ des signataires deviennent des icônes. Concerne : chronologie des incidents, tâches planifiées, page Claude, ressources, coûts, backlog, administration d'appli, facturation, onglet Signatures et page de signature. Les fenêtres de confirmation du navigateur, qui ne peuvent pas contenir d'icône, utilisent « Attention : » ou « Action sensible. ».
- Composant `Icon.tsx` étendu (`Warning`, `Circle`, `Dot`, `CheckMark`, `Hourglass`).
- Inchangés : les titres des notifications envoyées au téléphone, et les signes typographiques ✓ et ✕ dans les boutons de fermeture et les phrases.

## v0.51.1 — 2026-11-23

- **Sablier et coche : vraies icônes au trait à la place des émojis.** L'émoji ⏳ (qui change d'aspect selon l'appareil et détonne avec l'interface) est remplacé par un sablier dessiné au même trait que la loupe et l'engrenage ; la coche verte ✅ « Signé par tous » devient aussi une coche au trait. Concerne l'onglet Signatures (titre et lignes), le compteur d'attente et l'indicateur d'import en cours. Composant `Icon.tsx` réutilisable.

## v0.51.0 — 2026-11-23

Demandé le 2026-11-23 : le lien du client n'existe qu'après la signature de l'émetteur, et la case « lu et approuvé » inscrit la mention dans le cadre de signature.

- **Signature en deux temps.** À la création d'une demande, **seul le lien du prestataire est créé**. Le client est « en attente » : aucun lien ni code n'existe pour lui. Dès que le prestataire a signé, l'onglet Signatures propose **« Générer le lien et le code de Client »**, et l'émetteur reçoit une notification (« Vous avez signé : générez le lien du client »). Impossible de générer ce lien avant la signature du prestataire. Les demandes créées avant cette version gardent leurs deux liens.
- **« Lu et approuvé » sur le document.** La case de la page de signature devient « **Lu et approuvé** : je déclare avoir lu le document… » ; une fois signé, la mention **« Lu et approuvé »** est inscrite en gras dans le cadre de signature, au-dessus de « Signé électroniquement le … par … » et du tracé. Le certificat indique pour chaque signataire « Mention : « Lu et approuvé » (case cochée par le signataire) ».
- Après sa signature, la page du prestataire indique la prochaine étape : générer le lien du client depuis la Supervision.

## v0.50.1 — 2026-11-23

Retour du propriétaire : après la signature de l'émetteur, le client ne voyait ni sa signature ni le certificat en ouvrant son lien ; et l'émetteur ne les voyait pas non plus dans la Supervision tant que le client n'avait pas signé.

- **Le document signé à ce jour est assemblé après CHAQUE signature**, plus seulement à la dernière : la signature de chacun est posée dans son cadre et une page de certificat est ajoutée (« Document en cours de signature : 1 signature(s) sur 2 », avec « En attente de signature » pour la partie qui n'a pas encore signé).
- **Le client voit ce document en ouvrant son lien** : sa page indique « Ce document comporte déjà la signature de … avec son certificat (dernière page) ».
- **À la fin de sa signature**, chaque signataire peut télécharger le document avec les signatures à ce jour ; le dernier voit le message « Toutes les parties ont signé » et télécharge le document final avec les deux signatures et le certificat complet.
- **Dans la Supervision (onglet Signatures)** : dès qu'une signature est posée, boutons « Voir le document signé à ce jour » et « Télécharger (signatures à ce jour) » ; une fois tout le monde signé : « Voir le PDF signé » et « Télécharger le PDF signé ».
- Assemblage protégé par un verrou par demande : deux signatures simultanées ne se perdent pas.

## v0.50.0 — 2026-11-23

- **Logo du client sur les documents de prestation.** La demande de règlement et la convention affichent le logo du client en haut à droite du titre de la première page, en PDF comme en Word (le titre se replie pour lui laisser la place). Logos fournis : **Catalys Consulting** (site officiel du client) et **Autonova Group** (dépôt `site-autonova`, identique à celui de la Supervision), retrouvés d'après le nom du client, y compris l'orthographe « Antonova ». Un client sans logo n'a rien de plus sur son document.
- Logos dans `backend/assets/clients/` (PNG) ; registre dans `client-logos.ts`. Un logo se fige avec le document à la création d'une demande de signature.

## v0.49.6 — 2026-11-23

- **L'import des coûts génère maintenant des intitulés compréhensibles par le client**, sans rien retaper. Hébergement : « Serveur de l'application (fonctionnement et traitements) », « Base de données (conservation des données de l'application) », « Espace de stockage de la base de données (5 Go) », « Espace de stockage de l'application (… Go) ». Intelligence artificielle : « traitements automatisés (consommation du mois en cours) », sans nommer le fournisseur. S'applique à tous les dossiers de prestation et aux factures prévisionnelles.
- **Le détail technique n'est plus imprimé** : le nom du service, de la base et de l'offre (par exemple « procedia-backend, offre 0.5c-512mb ») reste visible dans l'application sous chaque ligne (« Détail technique (non imprimé) »), mais ne figure plus sur les documents du client.
- **Documents** : le préfixe de l'appli est retiré des lignes hors hébergement quand il s'agit de l'appli du dossier (« Intelligence artificielle : … » au lieu de « Procedia — Intelligence artificielle : … »). Dans la convention, l'hébergement se lit « Hébergement Procedia : 13,19 €, dont serveur de l'application … 6,37 € ; … » au lieu de parenthèses imbriquées.
- Les dossiers déjà enregistrés gardent leurs intitulés (dont ceux modifiés à la main) ; seul un nouvel import utilise les nouveaux.

## v0.49.5 — 2026-11-23

- **Demande de règlement et convention : l'hébergement tient sur une seule ligne.** Les postes d'hébergement d'une appli (service, base de données, stockage…) ne sont plus listés ligne par ligne : ils forment **une ligne « Hébergement <appli> » avec le total**, et le détail des postes et de leurs montants figure **dans cette ligne**, en plus petit. L'intelligence artificielle et les lignes libres restent chacune sur leur ligne. Dans la convention (article 4), l'hébergement est aussi une seule entrée avec son détail entre parenthèses. Le total est la somme des montants arrondis, comme avant.
- Les lignes importées des coûts gardent leur origine (`source`), mémorisée dans le dossier ; à défaut (dossiers existants), elle est déduite de l'intitulé, **y compris d'intitulés réécrits à la main** (serveur, base de données, stockage). Le titre du groupe reprend le nom de l'appli du dossier (« Hébergement Procedia »).
- **Nouveau sélecteur « Hébergement / Autre ligne »** sur chaque ligne du dossier : il force le regroupement ou l'empêche, quel que soit l'intitulé.
- **Titre « Montant demandé » jamais seul en bas de page** : il suit désormais son tableau sur la page suivante.

## v0.49.4 — 2026-11-23

- **Demande de règlement : mention de nature du document plus sobre.** L'encadré à fond crème et filet orange, qui faisait « document généré », est remplacé par une mention discrète entre deux filets fins, sous un petit titre « NATURE DU DOCUMENT », en PDF comme en Word. Le texte est reformulé plus simplement : « La présente demande de règlement n'est pas une facture fiscale et n'en tient pas lieu : elle ne comporte ni numéro de facture ni TVA. Elle ne vaut pas, à elle seule, reconnaissance de dette ni titre de créance exigible. » La phrase sur l'accord écrit des parties est retirée (aucun accord écrit n'existe à ce jour) ; le reste du fond juridique est inchangé.

## v0.49.3 — 2026-11-22

- **Audit de tous les écrans** : chaque écran qui charge des données a été passé en revue. Seule la liste des **journaux** (page Journaux et journaux d'une appli) ignorait aussi le geste ; elle recharge maintenant avec les filtres en cours. L'état de la double authentification (Réglages) l'écoute aussi. Les autres écrans (accueil, tableau de bord, fiches d'applis et leurs onglets, alertes, coûts, Claude, backlog, objectifs) passaient déjà par le mécanisme commun ; la palette de commandes recharge à chaque ouverture, et les panneaux d'actions ne chargent rien.
- **Garde-fou automatique** : un test (`refreshCoverage`) échoue si un fichier de l'interface appelle l'API sans écouter le geste, sauf exception justifiée dans le test. Un futur écran ne pourra donc plus oublier l'actualisation.
- **Facturation : « glisser pour actualiser » fonctionne enfin partout.** L'onglet Signatures, le compteur « ⏳ » du titre, les dossiers de Prestations, les clients, les factures et le profil ignoraient le geste d'actualisation (ils ne se rafraîchissaient que par minuterie). Ils l'écoutent maintenant, comme le reste de la Supervision.
- L'onglet Signatures et son compteur se rafraîchissent aussi **au retour sur l'application** (par exemple après avoir signé dans un autre onglet ou une autre fenêtre), sans attendre la minuterie de 15 secondes.

## v0.49.2 — 2026-11-22

- **Retrait des raccourcis de signature** ajoutés en v0.49.1 (demande du propriétaire : on garde la procédure normale, lien et code pour chaque signataire, y compris pour l'émetteur) : plus de bouton « Signer maintenant », plus de code dans l'adresse, plus de « Utiliser ma dernière signature » ni de tracé mémorisé sur l'appareil.
- Conservé : le bouton **« Supprimer »** de l'onglet Signatures (avec confirmation), qui supprime définitivement une demande et ses preuves.

## v0.49.1 — 2026-11-22

Retour du propriétaire : le document signé n'avait que la signature du prestataire, sans lien pour le client, et le cadre de signature du document restait vide alors que le certificat était rempli.

- **La demande de règlement est maintenant signée par les deux parties**, comme la convention : le prestataire et le client (« bon pour accord »). Deux liens et deux codes sont créés, dans les deux cas. Le bouton devient « Demande : vous + client ».
- **Les signatures sont posées dans les cadres du document** : à la finalisation, chaque cadre reçoit « Signé électroniquement le … », le nom et le tracé de la signature, en plus de la page de certificat. Le document soumis aux signataires, et son empreinte SHA-256, ne changent pas (le certificat indique « empreinte du document soumis »). Emplacements mémorisés à la création de la demande (colonne `boxes`, migration `20261122200000_signature_cadres`).
- Une valeur sans lettre ni chiffre (par exemple une échéance réduite à « . ») est traitée comme absente dans les documents.
- Une demande déjà signée avant cette version reste telle quelle : elle atteste du document tel qu'il était (empreinte comprise), donc sa signature ne peut pas être reportée sur la nouvelle version. Pour obtenir le document à deux signatures : **supprimer** l'ancienne demande, puis en créer une nouvelle.
- **Bouton « Supprimer »** (onglet Signatures, avec confirmation) : supprime définitivement une demande et ses preuves (`DELETE /api/billing/signature-requests/:id`).
- **« Signer maintenant »** : l'émetteur signe depuis la Supervision en un geste, sans lien ni code à saisir (le code passe dans le fragment de l'adresse, jamais envoyé au serveur).
- **« Utiliser ma dernière signature »** : le dernier tracé et le dernier nom saisis sont mémorisés sur l'appareil du signataire seulement (stockage du navigateur) pour être réutilisés en un geste.

## v0.49.0 — 2026-11-22

Retour du propriétaire : après avoir signé, aucune confirmation visible ; et dans la Supervision, aucune trace des signatures, avec trop d'informations en cascade.

- **Page de signature : écran de confirmation plein écran**, en haut de page : « ✓ Votre signature est enregistrée », titre du document, date et heure, qui reste à signer, et, quand tous ont signé, bouton « Télécharger le PDF signé ». Auparavant le message se perdait sous l'aperçu du PDF.
- **Nouvel onglet « Signatures »** dans NJM Facturation : une liste claire de toutes les demandes, avec l'état d'un coup d'œil (« ⏳ 1/2 signé · attend : Client », « ✅ Signé par tous », « Annulé »). Le détail (signataires, téléchargements, journal de preuve, annulation) n'apparaît que si l'on ouvre une ligne. Le nombre de signatures en attente s'affiche dans le titre de l'onglet.
- **Moins de cascade** : dans Prestations, deux boutons simples (« Convention : vous + client », « Demande : vous ») créent la demande et amènent directement à l'onglet Signatures, où un seul bloc « À transmettre maintenant » donne le lien et le code de chaque signataire. Le panneau déroulant par dossier est supprimé.
- **Notification** : à chaque signature, l'émetteur reçoit une notification de l'application installée (« ✍️ Nom a signé », puis « ✅ Document signé par tous »).

## v0.48.2 — 2026-11-22

- **Signature électronique : les traces techniques sont de nouveau conservées, sans jamais figurer sur les documents.** L'adresse IP et le navigateur du signataire sont enregistrés en base au moment de la signature (colonnes `ip` et `userAgent`, migration `20261122180000_signature_traces`) ; ils n'apparaissent ni dans le certificat ni dans le PDF signé. Le texte de consentement de la page de signature en informe le signataire. Nouveau bouton **« Journal de preuve »** dans l'administration : fichier JSON avec, pour chaque signataire, les dates d'ouverture et de signature, le nom saisi, l'IP, le navigateur et les essais de code ratés.
- Rectifie la v0.48.1, qui avait supprimé la collecte au lieu de seulement masquer l'affichage.

## v0.48.1 — 2026-11-22

- **Signature électronique : l'adresse IP du signataire n'est plus collectée** ni affichée (certificat, texte de consentement, administration). La preuve repose sur la date et l'heure, le nom saisi, le tracé de la signature, le lien personnel, le code et l'empreinte du document. La colonne `ip` est supprimée (migration `20261122100000_signature_sans_ip`).

## v0.48.0 — 2026-11-21

Demandé le 2026-11-21 : envoyer les documents de prestation à signer électroniquement, sans service d'e-mail.

- **Signature électronique des documents de prestation** (onglet Prestations › « Signature électronique »). La convention est signée par le prestataire et le client, la demande de règlement par le prestataire seul. Le document est **figé** (PDF et empreinte SHA-256) à la création de la demande.
- **Sans e-mail** : l'application produit, pour chaque signataire, un **lien personnel** et un **code à 6 chiffres** à transmettre soi-même par deux messages distincts (WhatsApp, SMS…). Lien perdu ou code bloqué : « Nouveau lien et code ».
- **Page de signature publique** (`/signer/…`, sans connexion) : saisie du code, lecture du PDF, nom complet, tracé de la signature au doigt ou à la souris, case de consentement.
- **Preuve** : date, nom saisi et tracé sont conservés. Quand tout le monde a signé, le **PDF signé** reçoit une **page de certificat** (signataires, horodatage, empreinte). Téléchargement du PDF signé ou d'origine depuis l'administration.
- **Garde-fous** : code bloqué après 5 essais, lien valable 30 jours, demande annulable, jetons et codes jamais stockés en clair, dossier avec preuves non supprimable, limitation des appels sur la page publique.
- Signature électronique « simple » : sa force probante est moindre que celle d'une signature qualifiée d'un prestataire agréé. Nouvelles tables `BillingSignRequest` et `BillingSigner` (migration `20261121230000_signature_electronique`), bibliothèque `pdf-lib`.

## v0.47.0 — 2026-11-21

Demandé le 2026-11-21 : des documents finaux, sans champs surlignés ni zones à compléter.

- **Documents finaux** : une information non renseignée (RCCM, NCC, forme juridique, paiement, lieu, description…) fait disparaître sa ligne ou sa phrase. Plus de surlignage jaune, plus de mentions « à faire valider » ni de bandeau de projet dans les documents.
- **Convention : clauses dans le formulaire** (loi applicable, juridiction, licence ou cession, exclusivité, territoire, durée, rémunération de la cession, pénalités, frais bancaires, code source). Valeurs par défaut quand elles existent (licence non exclusive, Côte d'Ivoire, durée d'exploitation, réserves sous 15 jours, confidentialité 5 ans, litige amiable 30 jours, deux exemplaires) ; la clause de pénalités n'apparaît que si un taux est donné.
- **Montant en lettres** généré automatiquement dans la convention.
- **Informations indispensables** : le téléchargement est refusé, avec un message clair, s'il manque l'identité du prestataire, le montant, et pour la convention la loi applicable, la juridiction ou la rémunération d'une cession. Colonne `terms` (migration `20261121200000_service_docs_terms`).

## v0.46.3 — 2026-11-21

- **Profil prestataire** : la variable `BILLING_PROFILE_SEED` (JSON : `legalName`, `legalForm`, `businessAddress`, `contactEmail`, `phone`) complète le profil de facturation au démarrage, sans jamais écraser une valeur déjà saisie. Sert à renseigner l'identité sans la mettre dans le dépôt ; la variable peut être retirée ensuite.

## v0.46.2 — 2026-11-20

- **Prestations : total automatique.** Les coûts des applis du client sont repris dès l'ouverture d'un nouveau dossier (et au changement de client), puis reconvertis quand on change la devise (euro ou FCFA). Tant qu'aucun montant n'est saisi à la main, le **total des documents est la somme des lignes** : plus de « montant à compléter » quand le détail est connu. Un montant saisi à la main reste prioritaire, avec une zone « expliquer l'écart » s'il diffère.
- **Arrondis** : chaque ligne est arrondie comme elle est affichée (0 décimale en FCFA) avant d'être additionnée : le total est toujours la somme des lignes lues.

## v0.46.1 — 2026-11-20

- **Accueil** : les alertes résolues ne restent plus affichées. Les réponses de l'API ne sont plus gardées en cache par le navigateur (cause probable sur iPhone), et l'accueil ne montre que les alertes ouvertes d'avertissement ou critiques ; les alertes d'information (redémarrage pour une mise en ligne) restent dans la page Alertes.
- **Redémarrage pour une mise en ligne** : cette alerte d'information se ferme désormais d'elle-même au bout d'une heure (elle restait ouverte indéfiniment), sans notification.
- **Dates des alertes** : l'accueil affiche l'heure locale au lieu des repères `⟦2026-11-20T13:21:34Z⟧`.

## v0.46.0 — 2026-11-20

Demandé le 2026-11-20 : reprendre dans les documents de prestation les coûts et intitulés des composants des applis, comme pour la facture prévisionnelle.

- **Prestations** : bouton « Importer les coûts des applis du client » (mêmes lignes que la facture prévisionnelle : hébergement par service, base de données, stockage, et dépenses Claude, convertis dans la devise du dossier). Les lignes restent modifiables ; on peut en ajouter ou en retirer, et reprendre leur total comme montant convenu.
- **Documents** : le détail apparaît dans la demande de règlement (lignes et total) et dans l'article 4 de la convention (4.4). Si le montant convenu diffère du total du détail, une zone « expliquer l'écart » est ajoutée.
- Tableau des montants du PDF : les intitulés longs passent à la ligne sans être coupés. Nouvelle colonne `lines` (migration `20261120150000_service_docs_lines`).

## v0.45.0 — 2026-11-20

Demandé le 2026-11-20 : suivre l'évolution **réelle** de la base en direct. Sur Procedia, la taille mesurée par Render restait à 1,5 Go alors que les documents conservés n'en représentaient plus que 1,2 : PostgreSQL ne rend pas au disque la place des lignes supprimées (il la réutilise pour les prochains imports).

- **Taille réelle des données** : la Supervision relève toutes les 5 minutes le rapport signé `GET /supervision/reports/database` de l'appli (disque occupé, données encore utiles, place libérée réutilisable) et en trace la courbe, sans jamais compacter la base. Elle baisse dès qu'un document est supprimé.
- **Ressources, base** : nouvelle carte « Données réelles » (avec la place libérée non rendue) et courbe « Taille réelle des données (en direct) » avec, en pointillé, l'espace disque occupé. La jauge de disque Render reste affichée.
- **Repères de suppression sur la courbe** : chaque moment où des documents ont été supprimés (à la validation ou automatiquement, regroupés par 10 minutes) s'affiche en direct sur la courbe par un trait rouge et un « −N » ; l'infobulle donne le détail et l'heure. Les suppressions sont lues dans le rapport de l'appli à chaque affichage (jamais de nom de fichier).
- Une appli qui ne propose pas ce rapport (404) est laissée tranquille une heure. Aucun changement de base de données : les relevés vont dans `ResourceSample` (clés `dbreal:<appli>` et `dbdisk:<appli>`, gardées 90 jours).
- Procedia v0.64.0 fournit le rapport.

## v0.44.0 — 2026-11-20

Demandé le 2026-11-20 : formaliser une prestation de développement réalisée pour une entreprise ivoirienne, depuis NJM Facturation.

- **Onglet « Prestations »** dans NJM Facturation : une saisie (client, application, travaux, montant, devise, paiement) produit la **demande de règlement** (ce n'est pas une facture) et la **convention de constatation des travaux**, en **PDF** et en **Word** modifiable, avec le logo NJMDev, en-tête, pagination et espaces de signature.
- **Prudence juridique intégrée** : aucun SIRET, RCCM, NCC ni TVA inventé (zones « à compléter » surlignées), NJMDev présenté comme identité visuelle et non comme société, convention sans effet rétroactif ni antidatage, licence et cession de droits distinguées, points « ⚠ Validation » signalés.
- **Profil de facturation** : nouveau statut « Personne physique (aucune structure) » pour le prestataire.
- Génération côté serveur (bibliothèques `pdfkit` et `docx`, police Inter embarquée), à la demande, sans stockage. Nouvelle table `BillingServiceDoc` (migration `20261120100000_service_docs`).

## v0.43.0 — 2026-11-19

Demandé le 2026-11-19 : le logo de Famille N'ZI n'apparaissait pas et peu d'informations remontaient.

- **Logo** : My Family affiche le portrait de Famille N'ZI (chargé depuis l'adresse publique de son application, sans copie dans ce dépôt public).
- **État en direct** : les applis en offre gratuite sont désormais interrogées (toutes les 5 minutes) ; avant, elles ne l'étaient jamais. Le module Node accepte l'option `reports` (`GET /supervision/reports/:name`).

## v0.42.0 — 2026-11-19

Demandé le 2026-11-19 : brancher Famille N'ZI (My Family) à la Supervision, dont on ne voyait que les déploiements.

- **Disponibilité** : l'API (`/api/health`) et l'appli web de Famille N'ZI sont vérifiées toutes les 5 minutes (offre gratuite Render : délai de réveil de 90 s). Les temps de réponse, la disponibilité et les alertes apparaissent comme pour les autres applis.
- **Administration** : adresse de base des routes `/api/supervision` connue par défaut (résumé des effectifs ; aucune donnée personnelle).
- Journaux et alertes : l'appli envoie ses journaux avec `SUPERVISION_URL` et `SUPERVISION_INGEST_TOKEN` (valeur de `MY_FAMILY_INGEST_TOKEN`).

## v0.41.2 — 2026-11-17

- **Backlog My Family** : la Supervision lit désormais `docs/BACKLOG.md` sur la branche `njmdev/my-family` (au lieu de `main`).

## v0.41.1 — 2026-11-16

- **En-tête par niveaux** : le niveau le plus proche du contenu reste désormais toujours affiché. Avec un seul niveau (accueil), il reste figé ; avec deux, seul le premier se retire au défilement, et ainsi de suite.

## v0.41.0 — 2026-11-16

Demandé le 2026-11-16 : un accueil épuré, les informations d'une appli seulement quand on clique sur son logo, une constellation plus grande et plus lumineuse, le thème rangé dans un bouton Paramètres.

- **Accueil épuré** : il ne montre plus que la **constellation**, le **brief** (état global, alertes ouvertes), les **objectifs de la semaine** et le **rejeu**. Plus de pastilles par appli, plus de phrases propres à Procedia, plus de cartes de modules.
- **Fenêtre d'appli à fond transparent** : un clic sur un logo de la constellation ouvre une fenêtre en verre dépoli avec les informations clés de l'appli (état, disponibilité 24 h, temps de réponse, alertes, dernier journal, vérifications, lien vers la fiche). Pour **Procedia**, la fenêtre ajoute ce qui lui est propre : documents supprimés et conservés, dernier import (pic de mémoire, retour au repos), incohérences. Fermeture : clic à côté, ✕ ou Échap.
- **Constellation plus grande et plus lumineuse** : nœuds et logos agrandis, halo qui respire, anneaux et liaisons qui brillent, plus de place dans la page.
- **Bouton « Paramètres »** dans tous les en-têtes : thème clair ou sombre, Réglages, Mesurer l'écran, Se déconnecter. Les liens Supervision et Facturation de l'accueil passent dans l'en-tête.

## v0.40.0 — 2026-11-16

Refonte visuelle, lots 2 bis, 3 et 4 : les pages existantes prennent le nouveau style et l'accueil raconte Procedia.

- **Brief de l'accueil enrichi** avec les rapports de Procedia : documents supprimés cette semaine (à la validation et automatiques), documents encore conservés et ceux à supprimer sous 3 jours ouvrés, dernier import (pic de mémoire et temps de retour au repos), nombre d'incohérences relevées. Les phrases n'apparaissent que si le rapport est disponible.
- **Coûts : carte à cases** (taille = coût estimé de chaque appli, clic = ressources de l'appli) au-dessus des tableaux.
- **Titres de pages** harmonisés (repère de module, grand titre) : Alertes, Journaux, Backlog, Claude, Coûts, Réglages, Facturation. **Fiche d'appli** avec le logo du projet. **Alertes** avec un liseré de couleur selon l'état (ouverte, prise en compte, résolue). Tableaux, compteurs et cartes alignés sur les nouvelles couleurs.
- **Réglages : choix du thème** clair ou sombre.
- Les pages de la Facturation (clients, factures, aperçu A4) gardent leurs fonctions ; elles prennent les nouveaux titres et couleurs.

## v0.39.0 — 2026-11-16

Refonte visuelle, lot 2 : tableau de bord, rejeu, recherche et diagnostic.

- **Rejeu des 6 dernières heures** sur l'accueil, à partir des **vraies mesures** : une ligne par appli, une case toutes les 5 minutes (vert = nominal, ambre = dégradé, rouge = arrêt, gris = pas de relevé), les événements (alertes, redémarrages, mises en ligne Render) en points sur la ligne. On fait glisser le curseur ou on lance la lecture (×240, ×900) : la **constellation** prend l'état de chaque appli à ce moment-là (couleur, temps de réponse) et le **titre du brief** se réécrit d'après l'événement le plus proche. « Revenir à maintenant » remet l'état en direct.
- **Tableau de bord refait** : titre et compteurs, **liste** (logo, état, disponibilité 24 h, temps de réponse, alertes, dernier journal) ou **constellation**, et grille de disponibilité des 24 dernières heures pour toutes les applis (une case = 15 minutes).
- **Recherche Ctrl ou ⌘ + K** sur toutes les pages (et bouton « Rechercher » dans l'en-tête) : aller à une page, à une appli, changer de thème, se déconnecter.
- **Diagnostic replié** sur la fiche d'une appli : après le lancement, un résumé (« 5 ok · 1 à regarder ») et un bouton « Voir le détail ».
- Technique : route `GET /api/replay?hours=6&step=5` (cases d'état par appli d'après les vérifications et les relevés en direct, événements de la chronologie ; calcul mis en cache 60 s), `buildCells` testé (`tests/replay.test.ts`). Détail dans `docs/architecture.md`.

## v0.38.1 — 2026-11-16

- **En-tête par niveaux.** Les rangées de l'en-tête se retirent **l'une après l'autre** quand on descend dans la page (barre NJMDev, puis navigation du module, puis onglets d'une fiche d'appli) et reviennent **par niveau** quand on remonte, en commençant par celui qui touche le contenu. Environ 70 px de défilement retirent un niveau, 40 px en font revenir un ; en haut de page, tout est visible. Avant, l'en-tête partait d'un bloc.
- La barre NJMDev (marque, thème, déconnexion) et la navigation du module (Tableau de bord, Alertes…) sont maintenant deux rangées distinctes ; les onglets d'une fiche d'appli deviennent un niveau de plus.

## v0.38.0 — 2026-11-16

Refonte visuelle, lot 1 (maquette validée le 2026-11-16). Les autres pages gardent leur disposition ; elles prennent les nouvelles couleurs.

- **Nouvelle identité visuelle** : fond graphite chaud, texte blanc cassé, vert menthe pour le nominal, ambre pour ce qui demande attention ; plus de bleu nuit ni d'accent violet. **Thème clair ou sombre** (bouton « Clair / sombre » dans l'en-tête, choix mémorisé sur l'appareil, appliqué avant l'affichage pour éviter tout flash).
- **En-tête qui ne reste plus figé** : il se retire quand on descend dans la page et revient dès qu'on remonte (accueil, Supervision, Facturation) ; plus de hauteur utile, surtout sur téléphone.
- **Accueil refait** : le **brief du jour** (titre écrit d'après l'état réel des applis, alertes ouvertes en encadré, disponibilité sur 24 h de chaque appli), les **objectifs de la semaine**, les modules, et à droite la **constellation** : NJMDev au centre, une application par nœud (anneau = disponibilité 24 h, couleur = état, temps de réponse), liaisons animées. Survoler ou toucher un nom ou un nœud met l'application en évidence ; la fiche s'ouvre d'un clic.
- **Logos des projets** (MGA, Autonova, Yiri Invest, EDEN Supervision, Procedia) ; My Family a une pastille « MF » en attendant son logo.
- Les animations sont coupées pour les personnes qui ont demandé moins de mouvement dans leur système.

## v0.37.0 — 2026-11-16

Demandé le 2026-11-16 : superviser les documents supprimés, voir la descente de la mémoire, remonter les procédures cibles par personne et les incohérences. Nécessite **Procedia v0.63.0** (nouveaux rapports signés) ; avant sa mise en ligne, les panneaux indiquent que le rapport n'est pas encore disponible.

- **Onglet « Qualité » de Procedia** (3 vues) :
  - **Documents** : documents supprimés (à la validation ou automatiquement) avec le cumul et le détail par jour sur 7, 30 ou 90 jours, documents encore conservés (nombre, taille, échéances), répartition par client et dernières suppressions (fichier, personne) ;
  - **Procédures cibles** : actuelles, validées, cibles créées et validées, avec l'avancement ; **par personne**, par client et par catégorie ;
  - **Incohérences** : compteurs par type et gravité (document importé plusieurs fois, même document dans plusieurs catégories, cible sans actuelle validée, numéro de fichier qui ne correspond pas à la catégorie, brouillon dont le document va expirer, anomalies de structure), liste filtrable par gravité ou par type, bouton « Recalculer ».
- **Onglet « En direct » : retour de la mémoire au repos.** Les périodes d'import sont teintées en bleu sur la courbe de mémoire, et un tableau donne pour chaque import le niveau de base, le pic et le **temps mis par la mémoire pour redescendre** (à moins de 15 %, 30 Mo au minimum, au-dessus du niveau d'avant l'import). Un import lancé avant le retour au repos garde le niveau de base du précédent.
- **Nouvelle alerte** « la mémoire ne redescend pas après un import » : si 15 minutes après la fin d'un import la mémoire est toujours au-dessus du niveau de base + 15 % (signe possible d'une fuite).
- Technique : routes `GET /api/apps/:key/qualite/{documents,cibles,incoherences}` (relais des rapports signés de Procedia), `episodes` dans `GET /api/apps/:key/runtime` (`backend/src/modules/runtime/rest.ts`), tests `tests/rest.test.ts`. Détail dans `docs/architecture.md`.

## v0.36.1 — 2026-11-16

- **Correction : fausse alerte « Actions de l'appli : l'appli a répondu 401 ».** Le diagnostic d'une appli envoyait encore l'ancienne requête (jeton seul) ; les applis n'acceptent plus que le protocole signé et répondaient donc 401 à chaque fois, alors que les actions elles-mêmes fonctionnaient. Le diagnostic signe maintenant sa requête comme les vraies actions.
- **Correction : voyant « Journaux » orange à tort.** Une appli n'envoie un journal que lors d'un événement (démarrage, erreur, import) : un silence de plus de 24 h n'est plus un avertissement mais une information (« ce silence est normal si elle fonctionne »). L'avertissement reste pour l'appli qui n'a jamais envoyé de journal (lien non branché).

## v0.36.0 — 2026-11-16

Demandé le 2026-11-16 : une section d'objectifs de la semaine sur la page d'accueil, avec report sur la semaine suivante.

- **Objectifs de la semaine** (page d'accueil NJMDev, sous les modules) : on ajoute autant d'objectifs que l'on veut, on les **valide au fur et à mesure** d'une case à cocher (et on peut les rouvrir dans la semaine), on modifie leur texte d'un appui, on les supprime. Une **barre de progression** montre les objectifs validés sur le total de la semaine.
- **Report automatique** : un objectif non validé passe **sur la semaine suivante** (pastille « reporté », « reporté ×2 »…). Une semaine va du lundi au dimanche (heure d'Abidjan = UTC).
- **Historique** : les flèches ‹ › parcourent les semaines passées (lecture seule, avec leur progression) ; « Cette semaine » ramène à la semaine en cours. Un objectif validé une semaine passée reste validé.
- Technique : table `Objective` (migration `20261116100000_objectives`), routes `GET/POST /api/objectives`, `PATCH/DELETE /api/objectives/:id` réservées au super administrateur ; test des semaines et du report (`tests/objectives.test.ts`). Détail dans `docs/architecture.md`.

## v0.35.7 — 2026-11-13

- **iPhone Duo, écran intérieur : plus de défilement parasite de 82 px.** Les mesures de l'appareil (iOS 27.2.1, application installée) montrent que la zone de mise en page de la page (`100svh` = `clientHeight`, 869 px en portrait, 587 en paysage) est 82 px plus courte que l'écran (`100vh` = `100dvh` = `100lvh`, 951 et 669 px). Une page haute de 100vh dépassait donc la zone de mise en page et défilait pour rien. La page est calée sur `100svh` (sans effet sur les autres appareils) ; un élément fixe, lui, couvre bien tout l'écran. Détail dans `docs/iphone-duo.md`.

## v0.35.6 — 2026-11-13

- **Mesure de l'écran : hauteurs des unités CSS.** La page `/ecran` affiche aussi la hauteur réelle de `100vh`, `100dvh`, `100svh`, `100lvh`, d'un élément fixe plein écran et le décalage de la zone visible, pour comprendre l'écart de 80 px mesuré sur l'écran intérieur entre `innerHeight` et `clientHeight`. Les mesures de l'appareil (iOS 27.2.1) sont consignées dans `docs/iphone-duo.md`.

## v0.35.5 — 2026-11-13

- **Accès à la mesure de l'écran depuis l'application installée** : bouton « Mesurer l'écran » dans Réglages › Affichage (l'application installée n'a pas de barre d'adresse). Un lien direct `/ecran` reste utilisable dans Safari.

## v0.35.4 — 2026-11-13

- **Page de mesure de l'écran : `/ecran`.** Pour comprendre pourquoi la fenêtre ne prend pas tout l'écran de l'iPhone Duo (colonne laissée à droite, côté barre d'état), cette page, ouverte sans connexion et sans aucune donnée, affiche la taille réellement donnée à la page (largeur, hauteur, zone visible, écran), les **marges de sécurité** haut, droite, bas et gauche, le mode « application installée », l'orientation, la posture du pliage et les segments d'écran. Un **cadre rouge** marque le bord de la page et un **cadre vert en pointillés** la zone sûre. À ouvrir dans l'application installée (Réglages › Affichage › Mesurer l'écran, v0.35.5) puis dans Safari (adresse `/ecran`), et à comparer.

## v0.35.3 — 2026-11-13

- **Correction : bande d'une autre teinte en bas de la page de démarrage.** Sur l'iPhone Duo (application installée), la page de démarrage laissait voir en bas une bande plus claire (≈ 80 px) : l'écran n'était pas couvert jusqu'au bord. La page de démarrage **déborde maintenant de 200 px sous l'écran** (son contenu reste centré sur la partie visible : écart mesuré 0 px) et le **fond de la page prend sa couleur** pendant son affichage, de sorte qu'aucune bande d'une autre teinte ne puisse apparaître.

## v0.35.2 — 2026-11-13

Demandé le 2026-11-13 : « en PWA, le zoom ne doit absolument pas être possible, aucune action qui ressemble à du web ne doit être possible. »

- **Application installée : plus aucun réflexe de navigateur web.** Quand la Supervision est ouverte comme application installée : pas de zoom (pincer, double toucher, Ctrl + molette), pas de sélection de texte (sauf les champs de saisie et les codes à copier : mot de passe temporaire, secret de double authentification), pas de menu contextuel ni d'aperçu de lien à l'appui long, pas de glisser d'images ni de liens, pas de rebond de défilement du navigateur. Dans un navigateur, rien ne change.

## v0.35.1 — 2026-11-13

Suite de la demande « optimisons pour l'iPhone Duo », après lecture des sources Apple et WebKit (tailles réelles d'écran : Safari 27.1, session « Prepare your app for iPhone Duo »).

- **Contrôle aux vraies tailles** (pixels CSS annoncés par WebKit : écran extérieur 382 × 618 portrait et 594 × 406 paysage, écran intérieur 669 × 902 portrait et 951 × 620 paysage, deux fenêtres côte à côte 385 × 609) : aucun débordement horizontal, le découpage de v0.35.0 (≤ 640 px, 641–960 px, > 960 px) tombe bien sur ces tailles.
- **Écran extérieur tourné (594 × 406)** : la barre du haut prenait 25 % de la hauteur et restait fixe. Sous 520 px de hauteur, elle défile maintenant avec la page.
- Aucun changement nécessaire côté orientation ni marges : la Supervision ne se sert d'aucune requête d'orientation (l'écran intérieur ne respecte pas l'orientation de l'interface) et traite les marges de sécurité gauche et droite séparément (elles sont asymétriques sur l'iPhone Duo).

## v0.35.0 — 2026-11-13

Demandé le 2026-11-13 : « optimisons Procedia et la Supervision pour l'iPhone Duo » (appareil pliable : écran fermé étroit, écran ouvert large).

- **Écran ouvert (largeur intermédiaire, 641 à 960 px).** Le menu du haut passe sur sa propre ligne (il était coupé après « Backlo… ») et les onglets d'une appli se répartissent sur plusieurs lignes au lieu d'être coupés (« Administratio… »).
- **Écran fermé / iPhone.** Le menu tient sur **une seule ligne défilante**, avec un dégradé qui montre la suite : la barre du haut, toujours visible, perd ≈ 40 px de hauteur. Même dégradé sur les onglets.
- **Tactile.** Zones d'au moins **44 px** (boutons, menu, onglets) ; champs de saisie à **16 px** (en dessous, iOS zoome sur la page à chaque saisie) ; suppression du délai de double-toucher et de la surbrillance au toucher.
- **Encoche et écran tourné.** Marges de sécurité à gauche et à droite ; hauteur d'écran dynamique (`dvh`) pour que la barre d'adresse de Safari ne masque pas le bas.
- Vérifié sur trois largeurs (393, 744 et 1 000 px) : aucun débordement horizontal.

## v0.34.0 — 2026-11-13

Demandé le 2026-11-13 : « j'ai l'impression qu'on a 2 types d'horaires dans l'application ? Pas juste UTC ? » → **une seule heure : celle de l'appareil.**

- **Une seule heure partout : celle de votre appareil.** Jusqu'ici l'interface affichait l'heure de l'appareil (ex. 18:55) alors que les textes écrits par le serveur donnaient l'heure UTC (ex. 17:55 UTC) : détails d'alertes (redémarrage, mémoire élevée, arrêt Render, tâche non exécutée ou en double), pause de la supervision dans le diagnostic. Ces textes portent désormais la date sous forme de repère (`⟦…⟧`) que l'interface (alertes, diagnostic, chronologie) et les **notifications** convertissent à l'heure de l'appareil : plus aucun « UTC » mélangé aux heures de l'écran. Les alertes déjà ouvertes gardent leur ancien texte en UTC.
- Reste en UTC, et c'est écrit à l'écran : les **horaires de tâches planifiées** (« Horaires en UTC (= heure d'Abidjan) »), qui sont des définitions de planification, et les jours des coûts Claude (découpés par jour UTC par Anthropic).

## v0.33.3 — 2026-11-13

- **Correction : fausse alerte « redémarrage après saturation de la mémoire » après une mise en ligne.** Le 13/11 à 17:55 UTC (18:55 sur l'écran), la mise en ligne de Procedia v0.62.2 a ouvert une alerte critique de saturation alors que la mémoire valait 258 Mo (290 Mo au dernier relevé) et que Render n'avait signalé aucun arrêt, seulement le déploiement. Cause : la Supervision gardait le **pic de toute la vie du processus** (405 Mo vus plusieurs heures plus tôt pendant des imports) au lieu de la mémoire juste avant l'arrêt. Désormais : le pic ne porte que sur **les 2 dernières minutes** avant le redémarrage, et un redémarrage qui suit une mise en ligne n'est **jamais** une saturation (la mise en ligne coupe le processus quelle que soit sa mémoire). Une vraie saturation (mémoire élevée juste avant l'arrêt, sans mise en ligne) reste une alerte critique.

## v0.33.2 — 2026-11-13

Demandé le 2026-11-13 : « pas d'animation, on pose le logo et on affiche juste le chargement en bas ».

- **Page de démarrage : logo posé, sans animation.** Le logo s'affiche tel quel dès l'ouverture et seule la barre de chargement, juste dessous, se remplit pendant 4 secondes (durée de Procedia), puis fondu de 0,4 s. Le tracé trait par trait de la v0.33.1 est retiré.

## v0.33.1 — 2026-11-13

Demandé le 2026-11-13 : plus de « rideau » en balayage ; le logo se dessine progressivement, trait après trait.

- **Page de démarrage : le logo se dessine trait par trait.** On commence par le trait du bas, puis celui juste au-dessus en partant de sa droite, et on fait le tour du logo (côté gauche, diagonale du N, côté gauche du carré, haut, côté droit, bas, diagonale) jusqu'à la fin, tout à droite. Seule une **barre de chargement** s'affiche sous le logo : plus de nom, de légende ni d'éclat. Durée inchangée : 4 s. Le logo final est identique à l'original (vérifié pixel à pixel : 0 pixel manquant, 0 en trop).

## v0.33.0 — 2026-11-13

Demandé le 2026-11-13 : « une petite animation pour l'entrée dans NJMDev, de même durée que Procedia ».

- **Page de démarrage NJMDev.** À chaque ouverture de l'application installée (écran d'accueil, fenêtre dédiée), le logo se dessine en trois balayages (le N, le JM, puis le soulignement), un éclat le traverse, puis le nom « NJMDev », « Supervision · Facturation » et une barre de chargement apparaissent. **Durée : 4 secondes** (celle de l'animation du logo de Procedia), puis fondu de 0,4 s. Elle se joue aussi quand les animations sont réduites (version fixe). `?splash=1` à la fin de l'adresse la force dans un navigateur pour la voir. Une sortie de veille n'est pas une ouverture.

## v0.32.1 — 2026-11-13

- **Correction : un redémarrage dû à une mise en ligne n'est plus une alerte.** Le 13/11 à 12:47:58 UTC, l'alerte « Procedia — redémarrage du service » s'est ouverte alors que le service venait d'être redéployé (Procedia v0.62.0, déploiement lancé à 12:47:14, mémoire normale : 221 Mo). La Supervision recoupe maintenant chaque redémarrage avec les déploiements Render : s'il suit un déploiement (lancé dans les 15 minutes précédentes), il est classé « redémarrage pour une mise en ligne », en information, sans notification, et ne compte pas dans les « redémarrages en boucle ». La chronologie le marque de la même façon. Un redémarrage avec mémoire élevée reste une alerte critique, déploiement ou non.

## v0.32.0 — 2026-11-13

- **Alertes de tendance.** Sur le relevé en direct (toutes les 15 secondes) : **mémoire élevée** (avertissement dès 400 Mo, critique dès 460 Mo sur 512, refermée sous 330 Mo), **service saturé** (boucle d'événements en retard de plus d'une seconde, deux relevés de suite) et **redémarrages en boucle** (3 en une heure, critique). Sur Render, toutes les 5 minutes : **taux d'erreurs serveur** (au moins 20 requêtes et 5 % de réponses 5xx sur 15 minutes ; critique dès 20 %), refermée sous 2 %.
- **Page Ressources : bande passante sortante et nombre d'instances** de chaque service (mesures Render jusque-là non utilisées).
- **Onglet « En direct » : imports en cours** (numéro court, taille du document, durée) et part du budget mémoire des imports réservée (avec Procedia v0.62.0 ; sans nom de document ni client).

## v0.31.0 — 2026-11-13

- **Onglet « Chronologie » par appli.** Une seule frise, du plus récent au plus ancien et groupée par jour, qui réunit : les alertes de la Supervision, les **arrêts et reprises du service signalés par Render** (dont « mémoire saturée »), les **déploiements** (lancés, terminés, en échec) et les **redémarrages détectés en direct**. Périodes de 6 h, 24 h, 7 jours et 30 jours, filtre « problèmes seulement ». En tête : **disponibilité** (vérifications réussies / faites) et nombre d'incidents graves.

## v0.30.0 — 2026-11-13

- **Journaux de la plateforme Render dans la page Journaux (quasi-direct).** Toutes les 15 secondes, la Supervision lit la sortie standard de chaque service Render rattaché à une appli (lignes `[mémoire]` de Procedia, démarrage et déploiement, erreurs que l'appli n'a pas transmises, traces d'arrêt) et les range avec la source « render » (filtre « source » de la page). Niveau déduit du texte (erreur, saturation mémoire → fatal, ALERTE → avertissement). Les codes de couleur sont retirés. Conservation : durée habituelle des journaux. Les journaux envoyés par les applis restent inchangés : une même ligne peut apparaître deux fois (une fois par l'appli, une fois par Render).

## v0.29.0 — 2026-11-13

Demandé le 2026-11-13 : « une supervision la plus complète possible, avec du temps réel » (1ʳᵉ étape).

- **Onglet « En direct » par appli.** La Supervision interroge toutes les **15 secondes** le rapport signé `runtime` de l'appli (Procedia v0.61.0 : mémoire réelle du processus, date de démarrage, retard de la boucle d'événements, imports en cours) et trace la **mémoire réelle** sur 15 minutes, 1 h, 6 h ou 24 h, page actualisée toutes les 5 secondes. Relevés conservés 7 jours.
- **Redémarrage détecté à la seconde près.** Un changement de date de démarrage ouvre l'alerte « redémarrage du service » (critique si la mémoire dépassait 400 Mo juste avant : « redémarrage après saturation de la mémoire », avec la dernière mémoire vue), alors que Render ne le publie que 15 à 30 minutes plus tard. Refermée après 2 h sans redémarrage. Les redémarrages sont aussi repérés par un ▲ sur les courbes.
- Les applis qui n'ont pas encore le rapport (réponse 404) sont réessayées toutes les heures, sans bruit ; les applis qui s'endorment (offre gratuite) ne sont jamais interrogées pour ne pas les réveiller.

## v0.28.0 — 2026-11-13

Demandé le 2026-11-13 : « beaucoup des infos de supervision dans Render ne remontent pas dans notre sup : on ne voit à aucun moment la mémoire saturée ».

- **Les pics de mémoire et de processeur ne sont plus lissés.** Mesuré le 13/11 : sur la même période, Render donnait 403 Mo de pic avec un pas de 30 s, mais seulement 190 Mo avec un pas de 10 minutes (celui de la page Ressources sur 24 h) : le « maximum » demandé à Render n'est pas conservé aux pas larges. La Supervision demande maintenant un pas fin (1 min sur 24 h, 5 min sur 7 jours, 15 min sur 30 jours) et garde le **maximum de chaque pas d'affichage**.
- **Les arrêts du service apparaissent sur les graphiques.** Les événements Render « service arrêté » (dont « mémoire saturée ») sont repérés par un trait vertical rouge (▲) sur les courbes Mémoire et Processeur, avec un décompte sous le graphique. Explication notée à l'écran : Render arrête le service entre deux mesures, la courbe n'atteint donc jamais la limite de 512 Mo (pic mesuré 403 Mo malgré les arrêts) ; seuls ces repères montrent la saturation.

## v0.27.0 — 2026-11-13

- **Imports Procedia : taille du document.** Chaque import affiche désormais la taille du document (ex. « 16 Mo ») sous le nom du fichier, pour repérer les gros documents derrière les arrêts de mémoire. La taille est fournie par Procedia à partir de sa v0.60.0 : les imports plus anciens n'en ont pas.

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

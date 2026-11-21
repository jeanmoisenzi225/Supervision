# Étude : un outil de signature électronique et de GED (nouveau projet NJMDev)

> Étude du 2026-11-22, demandée par le propriétaire du produit après la livraison de la signature électronique « simple » des documents de prestation (Supervision v0.48.0). Elle précède toute décision : aucun développement n'est engagé.
>
> **Avertissement.** Ce document n'est pas un avis juridique. Les points de droit s'appuient sur des recherches web, en grande partie sur des sources secondaires (articles de presse spécialisée, commentaires, sites d'éditeurs) ; les textes officiels n'ont pas tous été relus. Chaque point est donc accompagné d'un **niveau de confiance** (✅ recoupé par plusieurs sources, 🟡 une source secondaire, ❓ à vérifier dans le texte officiel). Toute décision de lancement commercial doit passer par un juriste connaissant le droit français, le droit ivoirien et le droit OHADA.

## 1. Résumé

**L'idée.** Un produit à part de la Supervision : faire signer des documents en ligne (contrats, devis, conventions, bons de commande) et les conserver, les classer et les retrouver (GED : gestion électronique des documents). Cible naturelle : les PME et indépendants ivoiriens et francophones d'Afrique de l'Ouest, avec une expérience pensée pour le téléphone et le partage par WhatsApp.

**Ce qu'on a déjà** (v0.48.0, dans la Supervision) : un parcours complet de signature « simple » à deux signataires, avec document figé et empreinte SHA-256, lien personnel et code transmis à part, certificat, PDF signé. C'est un excellent prototype, pas un produit : pas de vérification d'identité, pas d'horodatage par un tiers, pas d'archivage probant, pas de comptes multi-clients, PDF stockés dans la base principale.

**Verdict.**
1. **Techniquement faisable** avec la pile actuelle, et la partie GED (classement, versions, recherche, partage, journal) est à notre portée.
2. **Juridiquement, tout dépend du niveau de signature.** La signature « simple » est recevable mais fragile ; en France, seule la signature **qualifiée** bénéficie d'une présomption de fiabilité ; en Côte d'Ivoire, la loi de 2013 reconnaît la signature électronique « sécurisée », et des prestataires y sont agréés. Devenir soi-même prestataire de confiance qualifié est hors de portée (audit, supervision, coûts).
3. **Recommandation : construire la GED et le parcours de signature, déléguer la cryptographie probante** (signature avancée ou qualifiée, horodatage) à un prestataire agréé via une interface remplaçable. La signature « maison » reste un niveau d'entrée pour les usages à faible enjeu, clairement étiqueté comme tel.
4. **Préalable non technique** : vendre un service à des tiers suppose une **structure juridique** (aujourd'hui NJMDev n'est pas une société), des conditions générales, une assurance de responsabilité professionnelle et une conformité « données personnelles ». C'est le vrai chemin critique, bien avant le code.

**Prochaine décision proposée** : valider la phase 0 (section 12), peu coûteuse, avant d'engager du développement.

## 2. Périmètre produit

### 2.1 Utilisateurs
- **Émetteur** : un indépendant ou une PME qui envoie des documents à signer (lui-même propriétaire du compte).
- **Signataire** : une personne qui reçoit un lien, lit, signe depuis son téléphone, sans créer de compte.
- **Administrateur / archiviste** : retrouve, classe, exporte, prouve.
- **Auditeur / juge** (indirect) : doit pouvoir vérifier qu'un document n'a pas changé et qui l'a signé.

### 2.2 Fonctions, par ordre de valeur

| Bloc | Fonction | Phase |
|---|---|---|
| Signature | Envoi d'un PDF à 1 à N signataires, ordre éventuel, champs de signature placés sur la page | MVP |
| Signature | Lien personnel + code (existant) ; code par SMS ou WhatsApp en V1 | MVP / V1 |
| Signature | Certificat de signature, PDF signé, vérification publique de l'empreinte | MVP |
| Signature | Signature avancée ou qualifiée via un prestataire agréé | V1 |
| Signature | Rappels automatiques, expiration, refus motivé, annulation | V1 |
| GED | Dossiers, étiquettes, métadonnées (client, contrat, échéance), recherche plein texte | MVP |
| GED | Versions d'un document, historique, verrouillage après signature | MVP |
| GED | Droits par dossier, partage externe limité dans le temps, journal d'accès | V1 |
| GED | Modèles de documents avec champs à remplir (extension de ce que fait déjà « Prestations ») | V1 |
| GED | Règles de conservation et d'échéance, alertes (fin de contrat, renouvellement) | V1 |
| Preuve | Horodatage par un tiers (RFC 3161), journal chaîné, export d'un dossier de preuve | V1 |
| Archivage | Archivage à valeur probante, coffre-fort, destruction encadrée | V2 |
| Intégration | API et webhooks, envoi par e-mail (chantier 18), connecteurs (facturation NJMDev) | V1 / V2 |
| Mobile | Signature au doigt, scan d'un papier, partage WhatsApp | MVP |

### 2.3 Ce que le produit ne ferait **pas** (hors périmètre volontaire)
- Vérification d'identité à distance (pièce d'identité, reconnaissance faciale) : service réglementé, à déléguer.
- Signature qualifiée « maison » : impossible sans devenir prestataire qualifié.
- Actes pour lesquels la loi impose un écrit papier ou un notaire (voir 4.2).

## 3. Ce que la version actuelle apporte, et ses limites

| Point | État v0.48.0 | Limite |
|---|---|---|
| Intégrité | PDF figé + SHA-256, page de certificat | Pas de signature cryptographique dans le PDF (type PAdES) : l'empreinte vit en base et dans le certificat |
| Identification | Lien personnel + code à 6 chiffres transmis à part | Pas de vérification d'identité ; la sécurité dépend du canal choisi par l'émetteur |
| Horodatage | Date serveur | Pas d'horodatage par un tiers de confiance |
| Preuve | Date, nom saisi, tracé (ni IP ni navigateur, par choix du 2026-11-22) | Moins d'éléments en cas de contestation |
| Conservation | PDF en base PostgreSQL | Pas d'archivage probant ; taille de la base ; sauvegardes liées à celles de la Supervision |
| Multi-client | Un seul propriétaire | Pas de comptes ni de cloisonnement |
| Envoi | Lien copié à la main | Pas d'e-mail ni de WhatsApp intégré |

## 4. Cadre juridique

### 4.1 Union européenne : le règlement eIDAS
- **Trois niveaux.** Signature **simple** (aucune exigence spécifique), **avancée** (art. 26 : liée au signataire, l'identifie, créée sous son contrôle exclusif, toute modification ultérieure détectable), **qualifiée** (art. 3 point 12 : avancée + dispositif qualifié de création de signature + certificat qualifié). ✅ ([ANSSI](https://cyber.gouv.fr/reglementation/reglementation-identite-confiance-numerique/securite-echanges-voie-electronique/reglement-eidas/reglement-eidas-n9102014/), [texte de l'art. 25](https://legislation.gov.uk/eur/2014/910/article/25/adopted/data.pdf))
- **Effets (art. 25).** Aucune signature ne peut être refusée en justice **au seul motif** qu'elle est électronique ou non qualifiée ; seule la **qualifiée** a l'effet d'une signature manuscrite dans toute l'Union. ✅
- **Horodatage (art. 41).** Un horodatage non qualifié ne peut être rejeté au seul motif qu'il n'est pas qualifié ; un horodatage **qualifié** renverse la charge de la preuve en faveur de celui qui s'en prévaut. 🟡 ([DocuSign](https://www.docusign.com/fr-fr/blog/horodatage-electronique-definition))
- **eIDAS 2 (règlement 2024/1183)**, en vigueur depuis le 20 mai 2024 : surtout le portefeuille européen d'identité numérique ; la hiérarchie des niveaux de signature n'aurait pas changé. 🟡 ([Certyneo](https://certyneo.com/en/blog/eidas-2-nouveau-reglement-2026)) ❓ à confirmer sur le texte consolidé.

### 4.2 France
- **Code civil, art. 1366 et 1367** : l'écrit électronique vaut preuve s'il identifie la personne et est établi et conservé dans des conditions qui en garantissent l'intégrité ; la signature électronique manifeste le consentement. L'art. 1367, 2ᵉ alinéa, **présume fiable** le procédé conforme à un décret. ✅
- **Décret n° 2017-1416 du 28 septembre 2017** : la présomption de fiabilité est **réservée à la signature qualifiée** au sens d'eIDAS ; elle est **réfragable** (preuve contraire possible). ✅ ([Centre Inffo](https://www.centre-inffo.fr/site-droit-formation/actualites-droit/signature-electronique), [Le Monde du Droit](https://www.lemondedudroit.fr/droit-civil/291-obligations/53829-signature-electronique-conditions-de-presomption-de-fiabilite.html))
- **Conséquence pratique** : une signature simple ou avancée **reste recevable**, mais la charge de convaincre le juge pèse sur celui qui l'invoque (faisceau de preuves : journal, horodatage, échanges, exécution du contrat). En cas de contestation, le juge doit vérifier les conditions des art. 1366-1367 (art. 287 du code de procédure civile) ; une décision de cassation citée par un commentaire sanctionne l'absence de recherche du niveau qualifié. 🟡
- **Actes exclus ou encadrés** : certains actes (droit de la famille, successions, certaines sûretés pour des non-professionnels) ne peuvent pas ou plus difficilement être établis sous forme électronique ; l'authentique reste du ressort du notaire. ❓ à vérifier précisément (art. 1174 et suivants du Code civil) avant de promettre un usage.

### 4.3 Côte d'Ivoire
- **Loi n° 2013-546 du 30 juillet 2013 sur les transactions électroniques** : reconnaît la signature électronique **« sécurisée »** avec une validité équivalente à la signature manuscrite ; décret d'application **n° 2014-106 du 12 mars 2014** (établissement et conservation de l'écrit et de la signature électroniques). 🟡 ([texte UNODC](https://sherloc.unodc.org/cld/uploads/res/document/civ/a/Loi_transactions_electroniques.pdf)) ❓ la définition exacte de « sécurisée » est à relire dans les articles.
- **Prestataires agréés** : l'ARTCI a agréé comme prestataires de services de certification électronique **Cryptoneo, DKB Solutions et ITA** (30 août 2017), puis **Toosign** (2024, utilisé par le tribunal de commerce d'Abidjan pour valider des registres du commerce). 🟡 ([CIO Mag](https://cio-mag.com/certification-et-signature-electroniques-3-prestataires-agrees-en-cote-divoire/), [Digital Mag](https://digitalmag.ci/signature-electronique-toosign-obtient-la-certification-electronique-psce-de-lartci/)) ❓ agréments à revérifier sur la liste officielle.
- **Réforme 2025** : un projet de loi sur les échanges et transactions électroniques, **adopté par le Sénat le 16 juin 2025**, abroge l'**article 50** de la loi de 2013 (rôle de l'ARTCI sur la sécurité, la certification et la délivrance des certificats) et modifie les articles 3 et 17 de l'ordonnance n° 2017-500 ; le nouvel acteur chargé de la certification n'est pas clairement nommé dans les sources. 🟡 ([Koaci](https://www.koaci.com/article/2025/06/16/cote-divoire/societe/cote-divoire-cybersecurite-transparence-et-transformation-numerique-les-senateurs-valident-une-reforme-juridique-capitale_187704.html), [Osiris](https://osiris.sn/cybersecurite-la-cote-d-ivoire-adopte-un-nouveau-cadre-legal.html)) ❓ **promulgation, publication et régime actuel d'agrément non vérifiés : point bloquant à lever avant toute offre en Côte d'Ivoire.**
- **Loi applicable** : l'art. 8 de la loi de 2013 soumet au droit ivoirien les activités de commerce électronique dont une partie est établie, résidente ou de nationalité ivoirienne, sans préjudice de la liberté de choisir la loi applicable. 🟡

### 4.4 OHADA
- L'Acte uniforme sur le droit commercial général (révisé en 2010) a introduit la dématérialisation, notamment pour les formalités au **RCCM**, et fait référence (art. 83, selon un commentaire) à la signature électronique **qualifiée** ; l'Acte uniforme sur les sûretés pose (art. 1-5, selon une source) l'équivalence entre actes papier et électroniques. 🟡 ([Village de la justice](https://www.village-justice.com/articles/dematerialisation-des-actes-juridiques-dans-droit-ohada-cas-acte-uniforme,52396.html), [Lextenso](https://www.labase-lextenso.fr/ouvrages/le-numerique-au-service-du-droit-de-l-ohada-et-des-etats-parties-9782275053165/))
- Un commentaire estime que l'AUDCG n'organise les procédures électroniques que pour le RCCM, pas pour les contrats en général : **le droit national (ivoirien) reste donc la base pour les contrats**. 🟡 ❓

### 4.5 Données personnelles
- **RGPD (UE)** : principes de **minimisation** et de **limitation de la conservation** ; la durée est fixée par le responsable de traitement selon la finalité (la CNIL cite par exemple 6 ans de conservation d'un justificatif à titre de preuve en matière de recouvrement). L'adresse IP est une donnée personnelle. ✅ ([CNIL](https://www.cnil.fr/limiter-la-conservation-des-donnees)) *C'est la raison d'être de la suppression de l'IP et du navigateur dans la v0.48.1.*
- **Côte d'Ivoire : loi n° 2013-450 du 19 juin 2013**, contrôle par l'ARTCI. Le régime de base serait la **déclaration préalable**, mais un article de presse parle d'**autorisation préalable** ; les **transferts vers des pays tiers** sont soumis à condition d'une protection adéquate. 🟡 ([texte](https://cms21.anac.ci/uploads/748534/LOI_2013-450.pdf), [DLA Piper](https://www.dlapiperdataprotection.com/?c=CI&t=law)) ❓ régime exact et formalités à confirmer.
- **Rôles** : pour les documents de ses clients, l'outil serait **sous-traitant** (contrat de sous-traitance, mesures de sécurité, localisation, sous-traitants ultérieurs) ; pour ses propres comptes, **responsable de traitement** (politique de confidentialité, registre, droits d'accès et d'effacement).
- **Hébergement** : un hébergeur européen simplifie le RGPD mais pose la question des transferts depuis la Côte d'Ivoire ; un hébergement local n'est pas évident à ce stade (❓ offres à étudier).

### 4.6 Archivage à valeur probante (GED)
- **NF Z42-013** (version 2020, qui remplace celle de 2009) : exigences pour l'archivage électronique ; la marque **NF 461** atteste la conformité d'un système d'archivage ; l'**ISO 14641** en est issue. **Non obligatoire.** ✅ ([AFNOR](https://www.afnor.org/en/decryptions/cybersecurity/electronic-archiving-faq/), [FranceArchives](https://francearchives.gouv.fr/article/91524937))
- **NF Z42-026** (version 2023) : numérisation fidèle de documents papier ; non obligatoire et ne suffit pas, seule, à autoriser la destruction des originaux. 🟡
- **Stockage ≠ archivage probant** : le stockage garantit la disponibilité, l'archivage probant garantit la valeur de preuve dans la durée (horodatage, intégrité, traçabilité, imputabilité). ✅ ([Yousign](https://yousign.com/fr-fr/blog/archivage-numerique-a-valeur-probante))
- **Durées légales de conservation** (civil, commercial, comptable, social) : variables selon le document ; **non vérifiées ici** ❓. Elles dicteront les règles de rétention du produit.

### 4.7 Ce que change le fait d'être l'éditeur
- Fournir un service de signature à des tiers expose à la **responsabilité contractuelle** (disponibilité, conservation, exactitude du certificat) et à un devoir de conseil sur le niveau de signature adapté. Une **assurance responsabilité civile professionnelle** adaptée est à prévoir.
- **Interdits de fait** : se présenter comme fournisseur de signature « qualifiée » ou « légalement équivalente à la manuscrite » sans l'être. Les écrans et conditions doivent dire précisément « signature électronique simple » ou « avancée », et ce que cela implique.
- **Statut** : l'activité est commerciale ; elle suppose une **entreprise** (immatriculation, régime fiscal, TVA, mentions légales, CGU/CGV). NJMDev n'est aujourd'hui qu'une marque et une identité visuelle (voir la facturation NJMDev).
- **Devenir prestataire de services de confiance qualifié** (liste de confiance européenne, ou agrément ivoirien) : audits, exigences de sécurité, capital et assurance, hors de portée à ce stade.

## 5. Niveaux de signature : comparaison

| | Simple « maison » (actuel) | Avancée via partenaire | Qualifiée via partenaire |
|---|---|---|---|
| Identification | Lien + code | Certificat lié au signataire, identification renforcée | Vérification d'identité + dispositif qualifié |
| Intégrité | Empreinte en base | Signature cryptographique dans le PDF | Idem |
| Horodatage | Serveur | Tiers | Tiers qualifié |
| Valeur en France | Recevable, preuve libre | Recevable, preuve plus solide | **Présomption de fiabilité**, équivalent de la manuscrite dans l'UE |
| Valeur en Côte d'Ivoire | Recevable, force à apprécier | Selon la définition de « sécurisée » ❓ | Prestataire agréé : valeur la plus sûre |
| Coût marginal | ≈ 0 | quelques dizaines de centimes à quelques euros par signature (❓) | plus élevé |
| Effort de mise en place | Fait | Intégration d'une API | Idem + parcours d'identité |
| Usage conseillé | Accords internes, devis, conventions entre proches | Contrats commerciaux courants | Actes à enjeu, exigence d'un tiers (banque, administration) |

## 6. Marché et concurrence

| Acteur | Positionnement | Éléments relevés |
|---|---|---|
| Yousign (marque en évolution, « Youtrust » selon certaines pages) | Français, API REST, hébergement des données en France | API vers **106 € HT/mois pour 500 signatures** selon un comparatif ; offres d'entrée à quelques euros par mois ; chiffres contradictoires selon les sites |
| Universign | Français, prestataire qualifié, tarif à la transaction | Packs de quelques dizaines d'euros pour 25 à 50 signatures ; API sur devis |
| DocuSign | Acteur mondial | Offres par utilisateur ; API à partir de quelques dizaines d'euros par mois selon la source |
| Toosign, Cryptoneo, DKB Solutions, ITA | Prestataires agréés en Côte d'Ivoire | Aucun tarif public trouvé |

Sources : [Tool Advisor](https://tool-advisor.fr/signature-electronique/comparatif/yousign/), [Hackceleration](https://hackceleration.com/fr/labs/meilleur/signature-electronique), [Yousign](https://yousign.com/fr-fr/alternative/docusign). 🟡 Les prix sont issus de sources secondaires qui se contredisent : **à revalider par devis avant tout chiffrage.**

**Espace possible pour un nouvel entrant** (hypothèses à tester auprès de vrais utilisateurs) :
- Simplicité sur téléphone et partage par **WhatsApp**, sans compte pour le signataire.
- Tarification en **FCFA** et paiement mobile (à étudier).
- **GED légère** intégrée (classer, retrouver, relancer) plutôt qu'un simple envoi de signature.
- Intégration avec la **facturation NJMDev** (devis, factures, conventions).
- Proximité et support local ; conformité au droit ivoirien et OHADA comme argument.

**Menaces** : acteurs établis très compétitifs sur l'Europe ; prestataires locaux agréés déjà présents dans l'administration ; faible disposition à payer des très petites entreprises ; coût d'acquisition client.

## 7. Options de réalisation

| Option | Description | + | − |
|---|---|---|---|
| **A. Tout maison** | Signature simple + GED, sans partenaire | Peu coûteux, rapide, maîtrisé | Valeur probante limitée ; non vendable à des clients à enjeu ; responsabilité entière |
| **B. Tout délégué** | Revendre l'API d'un prestataire | Valeur juridique solide, peu de cryptographie à écrire | Marge faible, dépendance, peu de différenciation |
| **C. Hybride (recommandée)** | GED et workflow maison ; signature via une **interface à adaptateurs** : « simple maison » par défaut, « avancée / qualifiée » via un partenaire | Valeur croissante selon l'enjeu ; partenaire remplaçable ; différenciation sur la GED et l'usage | Deux niveaux à expliquer ; intégration partenaire à maintenir |

## 8. Architecture technique proposée

**Principe : un projet séparé de la Supervision** (dépôt, service, base, domaine propres) pour isoler le risque, les données clients et la conformité. La Supervision le surveillerait comme les autres applications (journaux, disponibilité).

- **Pile** (réutilise l'existant) : Node/Express, Prisma, PostgreSQL, React, `pdf-lib` (assemblage) et `pdfkit` (génération), mêmes conventions de versions et de tests.
- **Stockage des fichiers** : un **stockage objet** (compatible S3, chiffré, versionné) plutôt que la base ; les disques de Render ne sont pas durables. La base ne garde que les métadonnées et les empreintes.
- **Chiffrement** : par fichier avec clés par client, gestion des clés séparée ; sauvegardes testées (restauration à un instant donné).
- **Intégrité et preuve** : journal d'événements **chaîné** (chaque entrée porte l'empreinte de la précédente), empreinte SHA-256 de chaque version, **horodatage par un tiers** (RFC 3161), signature **PAdES** dans le PDF et validation à long terme (**LTV**) pour les niveaux avancé et qualifié (norme ETSI EN 319 142). 🟡 ([ETSI](https://etsi.org/deliver/etsi_EN/319100_319199/31914202/01.01.01_60/en_31914202v010101p.pdf), [Encryption Consulting](https://www.encryptionconsulting.com/pades-and-long-term-validation/))
- **Interface de signature** : `SignatureProvider` avec adaptateurs `maison`, `partenaire_ci`, `partenaire_ue` ; mêmes états (créée, envoyée, ouverte, signée, refusée, expirée), mêmes webhooks.
- **Authentification du signataire** : lien + code (existant), puis code par SMS ou WhatsApp, puis identité vérifiée par le partenaire.
- **Multi-client** : comptes, organisations, rôles, quotas, limitation de débit, audit.
- **Sécurité** : jetons à usage limité, blocage après essais, secrets hors dépôt, revue des dépendances, test d'intrusion avant ouverture.
- **Exploitation** : surveillance par la Supervision, procédure de reprise, journalisation sans données de documents.

## 9. Modèle économique (hypothèses)

- **Gratuit / essai** : quelques signatures simples par mois.
- **Abonnement** par organisation (stockage et nombre de signatures inclus) et/ou **tarif à la signature** pour les niveaux avancé et qualifié (coût partenaire + marge).
- **Coûts récurrents à chiffrer** : stockage objet, SMS ou WhatsApp, horodatage tiers, API partenaire, hébergement, assurance, support, comptabilité et TVA.
- **Point mort** : à calculer une fois les devis obtenus (ne pas extrapoler des prix de comparateurs).

## 10. Limites et risques

| Risque | Gravité | Atténuation |
|---|---|---|
| Statut juridique de l'éditeur inexistant (NJMDev n'est pas une société) | **Bloquant commercial** | Créer la structure avant toute offre payante |
| Incertitude sur le régime ivoirien après la réforme de 2025 | Élevée | Consultation d'un juriste ivoirien ; relecture du texte promulgué |
| Valeur probante contestée d'une signature simple | Élevée | Étiquetage honnête, niveau avancé ou qualifié via partenaire pour les enjeux |
| Responsabilité en cas de perte ou fuite de documents | Élevée | Chiffrement, sauvegardes testées, assurance, CGU claires |
| Conformité données personnelles (RGPD et loi ivoirienne) | Élevée | Registre, contrats de sous-traitance, hébergement documenté |
| Dépendance à un partenaire | Moyenne | Interface à adaptateurs, deux partenaires qualifiés |
| Charge de maintenance et d'astreinte pour une seule personne | Élevée | Périmètre serré, automatisation, Supervision, MVP limité |
| Marché difficile (concurrents, faible disposition à payer) | Moyenne | Valider avec des clients réels avant de construire la V1 |
| Archivage probant non conforme aux normes | Moyenne | Ne pas promettre « archivage probant » avant audit ; se limiter à « conservation sécurisée » |
| Usage frauduleux (faux documents, usurpation) | Moyenne | Codes, blocages, journal, signalement, conditions d'usage |
| Évolution rapide du droit (eIDAS 2, réforme ivoirienne) | Moyenne | Veille, clauses de révision des CGU |

## 11. Questions ouvertes pour le propriétaire

1. **Pour qui** : usage interne NJMDev (devis, conventions, facturation) ou produit vendu à des tiers ? La réponse change tout (structure, assurance, niveau de signature).
2. **Où** : Côte d'Ivoire seule, UEMOA/OHADA, ou aussi Europe ?
3. **Quel niveau d'enjeu** vise-t-on (devis et conventions, ou contrats de crédit, de bail, de travail) ?
4. **Quel budget** de démarrage pour la structure, l'assurance, les partenaires ?
5. **Quel partenaire** de confiance accepter de contacter (un prestataire ivoirien agréé et un européen) ?
6. **Quel nom** pour le produit (indépendant de NJMDev ?) et quel hébergeur pour les données ?

## 12. Feuille de route proposée

| Phase | Contenu | Livrable | Décision de passage |
|---|---|---|---|
| **0. Validation** (quelques semaines, peu de code) | Consultation juridique (FR, CI, OHADA) ; devis de 2 partenaires ; 5 à 10 entretiens d'utilisateurs ; choix de la structure | Note de cadrage validée | Go si un segment accepte de payer et si le régime ivoirien est clair |
| **1. MVP interne** (≈ 6 à 10 semaines, estimation indicative) | Projet séparé, comptes, GED de base, signature simple multi-signataires, stockage objet, journal chaîné | Outil utilisé par NJMDev pour ses propres documents | Retour d'usage sur 1 à 2 mois |
| **2. V1 partenaire** | Adaptateur avancé ou qualifié, horodatage tiers, SMS/WhatsApp, API, e-mail | Offre pilote avec 3 à 5 clients | Taux d'usage et satisfaction |
| **3. V2** | Archivage probant, modèles avancés, tableaux de bord, facturation de l'offre | Ouverture commerciale | Rentabilité |

Les durées sont des **ordres de grandeur** à confirmer par une analyse détaillée ; elles supposent un seul développeur et ne comptent ni le juridique ni la création de structure.

## 13. Ce qui peut être fait sans attendre (sans engager le projet)

- Continuer à utiliser la signature « simple » de la Supervision pour les accords entre proches, en le disant clairement (c'est déjà le cas dans l'interface).
- Rassembler les questions pour un juriste (sections 4 et 11).
- Demander deux devis (un partenaire ivoirien agréé, un européen) pour chiffrer les niveaux avancé et qualifié.
- Noter, à chaque usage réel de la signature, ce qui manque aux utilisateurs : ce sera le meilleur cahier des charges.

## 14. Sources consultées (liste)

Juridique : [ANSSI, eIDAS](https://cyber.gouv.fr/reglementation/reglementation-identite-confiance-numerique/securite-echanges-voie-electronique/reglement-eidas/reglement-eidas-n9102014/) · [eIDAS art. 25](https://legislation.gov.uk/eur/2014/910/article/25/adopted/data.pdf) · [Centre Inffo, décret 2017-1416](https://www.centre-inffo.fr/site-droit-formation/actualites-droit/signature-electronique) · [Le Monde du Droit](https://www.lemondedudroit.fr/droit-civil/291-obligations/53829-signature-electronique-conditions-de-presomption-de-fiabilite.html) · [Loi 2013-546 (UNODC)](https://sherloc.unodc.org/cld/uploads/res/document/civ/a/Loi_transactions_electroniques.pdf) · [Loi 2013-450](https://cms21.anac.ci/uploads/748534/LOI_2013-450.pdf) · [CIO Mag, prestataires agréés](https://cio-mag.com/certification-et-signature-electroniques-3-prestataires-agrees-en-cote-divoire/) · [Digital Mag, Toosign](https://digitalmag.ci/signature-electronique-toosign-obtient-la-certification-electronique-psce-de-lartci/) · [Koaci, réforme 2025](https://www.koaci.com/article/2025/06/16/cote-divoire/societe/cote-divoire-cybersecurite-transparence-et-transformation-numerique-les-senateurs-valident-une-reforme-juridique-capitale_187704.html) · [Village de la justice, OHADA](https://www.village-justice.com/articles/dematerialisation-des-actes-juridiques-dans-droit-ohada-cas-acte-uniforme,52396.html) · [CNIL, durées de conservation](https://www.cnil.fr/limiter-la-conservation-des-donnees).

Archivage et technique : [AFNOR, archivage électronique](https://www.afnor.org/en/decryptions/cybersecurity/electronic-archiving-faq/) · [FranceArchives](https://francearchives.gouv.fr/article/91524937) · [ETSI EN 319 142](https://etsi.org/deliver/etsi_EN/319100_319199/31914202/01.01.01_60/en_31914202v010101p.pdf) · [PAdES et LTV](https://www.encryptionconsulting.com/pades-and-long-term-validation/).

Marché : [Tool Advisor](https://tool-advisor.fr/signature-electronique/comparatif/yousign/) · [Hackceleration](https://hackceleration.com/fr/labs/meilleur/signature-electronique) · [Yousign](https://yousign.com/fr-fr/alternative/docusign).

**Limites de la recherche** : une seule passe, sources majoritairement secondaires ; plusieurs chiffres de prix se contredisent ; le texte promulgué de la réforme ivoirienne de 2025, le régime exact de déclaration ou d'autorisation des données en Côte d'Ivoire, les durées légales de conservation et les actes exclus de la forme électronique en droit français n'ont **pas** été vérifiés.

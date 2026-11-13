# iPhone Duo : informations d'affichage (relevé du 2026-11-13)

Appareil de référence : iPhone Duo (annoncé en septembre 2026, vente le 23 octobre). Appareil du propriétaire : iOS **27.2.1**. Chaque valeur porte sa source ; **déduit** = calculé par nous à partir de sources, **à confirmer** = pas de source officielle.

## 1. Écrans (Apple, fiche technique)

| | Écran intérieur (ouvert, « grand ») | Écran extérieur (fermé, « face avant ») |
|---|---|---|
| Diagonale | 7,6 pouces (mesurée 7,58) | 5,4 pouces (mesurée 5,36) |
| Résolution du panneau | **1 878 × 2 670 px** | **1 398 × 2 034 px** |
| Densité | 430 ppp | 460 ppp |
| Rapport hauteur / largeur | ≈ 1,42 (déduit) | ≈ 1,455 (déduit) |
| Technologie | OLED pliable, Super Retina XDR, anti-reflets nano-texture | OLED, Super Retina XDR |
| Fréquence | ProMotion adaptative jusqu'à 120 Hz, Always-On | idem |
| Luminosité | 1 000 nits typique, 1 600 crête HDR, 3 000 crête extérieur, 1 minimum | idem |
| Contraste | 2 000 000 : 1 | idem |
| Caméra avant | FaceTime **sous l'écran** (Touch ID, pas de Face ID) | Center Stage 12 Mpx |
| Dynamic Island | sur le côté (verticale), s'étend pour les Live Activities | idem |

Appareil : ouvert 164,6 × 117,8 × 5,2 mm ; fermé 84,1 × 117,8 × 11,3 mm ; 254 g ; titane, Ceramic Shield 2 avant. Les deux écrans ont presque le même format, donc le contenu se met à l'échelle. Zone sûre : **non précisée par la fiche**.

## 2. Points et pixels CSS

- Échelle @3x (déduit) : **intérieur 669 × 951 pt**, **extérieur 466 × 678 pt**. Les largeurs de viewport de Safari (§ 3) confirment 669 et 951 pour l'intérieur ; une source tierce donnait 626 × 890, contredite par WebKit.
- **Pixels CSS = points** sur iPhone.

## 3. Taille réellement donnée aux pages web (Safari 27.1, WebKit)

Pixels CSS. SVH = barres de Safari affichées, LVH = barres repliées.

| Écran / configuration | Largeur | SVH | LVH |
|---|---:|---:|---:|
| Extérieur, portrait | 382 | 580 | 618 |
| Extérieur, paysage | 594 | 368 | 406 |
| Intérieur, portrait (un onglet) | 669 | 867 | 902 |
| Intérieur, paysage (un onglet) | 951 | 585 | 620 |
| Intérieur, deux fenêtres côte à côte | 385 | 571 | 609 |

Plage : largeur 382 à 951, hauteur 368 à 902. Barre d'onglets de Safari : en bas sur l'écran extérieur, en haut sur l'écran intérieur.

**Déduit** : sur l'écran extérieur, 466 − 382 = 82 à 84 pt : le **rail latéral** (barre d'état, navigation, commandes déplacés sur le côté par iOS 27) retire **≈ 84 pt** de largeur à la page (portrait) ou de hauteur utile (paysage : 678 − 594 = 84). Valeur « ≈ 84 pt » confirmée par un guide Capacitor pour les postures paysage et pliées (source secondaire).

## 4. Classes de taille (Apple, Tech Talk « Prepare your app for iPhone Duo »)

- Extérieur : comme les autres iPhone : portrait = hauteur régulière + largeur compacte ; paysage = compacte dans les deux sens.
- Intérieur : **régulière dans les deux sens** (comme un iPad), mais c'est toujours un iPhone.
- L'écran intérieur **ne respecte pas les orientations d'interface** : décider la mise en page par la taille disponible, jamais par l'orientation. Ne pas utiliser `UIScreen.main` (ambigu, bientôt déprécié).

## 5. Zones sûres et rail (Apple, WebKit)

- Les marges de sécurité sont **asymétriques** : gauche ≠ droite, traiter chaque côté séparément.
- Barres (outils, onglets, navigation) en **vertical** sur le côté, sauf écran intérieur en portrait ; en Split View, chaque fenêtre met ses commandes sur son bord extérieur ; Split View ≈ 385 CSS px par fenêtre (≈ 469 pt selon un guide Capacitor, à confirmer).
- Zones réservées : caméra extérieure (permanente), caméra intérieure (quand active), pli (écran intérieur partiellement ouvert).
- **Pages web (WebKit, Safari 27.1)** : « le contenu web ne s'étend pas sous ces contrôles ; Safari prolonge la couleur de fond de la page dans cet espace ». `viewport-fit=cover` permettrait d'étendre la page sous le rail, à condition d'écarter le contenu important avec `env(safe-area-inset-*)`. Apple juge que beaucoup de sites ne gèrent pas correctement les quatre bords et **étudie une solution plus simple, sans calendrier annoncé**.
- Les barres HTML fixes restent dans les zones haut/bas classiques et ne suivent pas le rail (guide Capacitor).
- Applications natives : sans SDK iOS 27 elles restent à gauche de la barre d'état ; SDK 27 : elles s'étendent à gauche de la barre d'état ; **SDK 27.1 : elles atteignent le bord**.

## 6. Pliage

- API web **Device Posture** (`@media (device-posture: folded)`, `navigator.devicePosture.type` : `folded` ou `continuous`) et **Viewport Segments** (`horizontal-viewport-segments`, `vertical-viewport-segments`, `env(viewport-segment-width 0 0)`, `window.viewport.segments`) : **préversion derrière un drapeau** (Réglages › Apps › Safari › Avancé › Drapeaux), non activées par défaut.
- Safari affiche les PDF en deux pages côte à côte quand l'appareil est plié en livre.

## 7. Versions d'iOS

iOS 27.1 : sorti le 23/10/2026 (uniquement sur iPhone Duo) ; iOS 27.2 : 26/10/2026 ; Safari 27.2 (WebKit, 26/10) : aucune mention de l'iPhone Duo, des applications web installées, de `viewport-fit` ni des zones sûres. Un rapport de forum développeur (application Cordova, non PWA, sans réponse d'Apple) décrit une **régression 27.1 → 27.2** : un affichage qui perdait ses marges de sécurité gauche et droite et dont la barre d'état modifiait la mise en page. Non confirmé pour les applications web installées.

## 8. Ce qu'on ne sait pas (à mesurer)

- Valeurs de `env(safe-area-inset-*)` dans l'application installée sous iOS 27.2.1, par écran et par posture : page **Réglages › Affichage › Mesurer l'écran** (`/ecran`, Supervision v0.35.5), avec cadres rouge (bord de la page) et vert (zone sûre).
- Si une application web **installée** peut s'étendre sous le rail : aucune source Apple ne le dit.
- Zone sûre officielle des deux écrans : non publiée.

## 9. Ce que NJMDev applique

Mise en page par **largeur** (≤ 640, 641–960, > 960 px, qui tombent sur 382 / 385 / 594 / 669 / 951), jamais par orientation ; marges gauche et droite traitées séparément (`env(safe-area-inset-left/right)`) ; barre du haut non fixe sous 520 px de hauteur ; champs à 16 px, zones tactiles de 44 px ; fond de la page = couleur de l'application (c'est lui que le système prolonge dans le rail) ; `viewport-fit=cover` déclaré.

## Sources

Apple : fiche technique iPhone Duo (support.apple.com/en-us/148588), salle de presse (apple.com/newsroom/2026/09/apple-unveils-iphone-duo), Tech Talk « Prepare your app for iPhone Duo » (developer.apple.com/videos/play/tech-talks/111461), WebKit : « WebKit Features for Safari 27.1 » (webkit.org/blog/18486) et « 27.2 » (webkit.org/blog/18515). Secondaires : guide Capacitor iPhone Duo (capgo.app), « iPhone Duo for Developers » (blakecrosley.com), « First Developer Good to Knows » (swiftjectivec.com), forum développeur Apple (fil 853762).

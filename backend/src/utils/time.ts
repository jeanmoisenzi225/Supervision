/**
 * Date insérée dans un texte écrit par le serveur (détail d'alerte, notification…) : `⟦2026-11-13T17:55:58.000Z⟧`.
 * L'interface et les notifications la remplacent par l'heure de l'appareil (v0.34.0) : plus d'heures en UTC
 * mélangées à celles de l'écran.
 */
export const stamp = (d: Date): string => `⟦${d.toISOString()}⟧`;

import { useEffect, type RefObject } from "react";

/**
 * En-tête qui ne reste pas figé (v0.38.0) : il se retire quand on descend dans la page et revient dès
 * qu'on remonte (ou en haut de page). Évite de perdre de la hauteur d'écran, surtout sur téléphone.
 */
export function useAutoHide(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const el = ref.current;
        if (el) {
          const delta = y - last;
          if (y < 80) el.classList.remove("is-hidden");
          else if (delta > 8) el.classList.add("is-hidden");
          else if (delta < -8) el.classList.remove("is-hidden");
        }
        last = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ref]);
}

import { useEffect, type RefObject } from "react";

const STEP_DOWN = 70; // pixels de défilement vers le bas pour retirer un niveau
const STEP_UP = 40; // pixels de défilement vers le haut pour en faire revenir un

/**
 * En-tête par niveaux (v0.38.1) : chaque rangée `.lvl` du conteneur se retire l'une après l'autre quand on
 * descend dans la page (le premier niveau d'abord, puis le suivant), et revient dans l'ordre inverse quand on
 * remonte (le niveau le plus proche du contenu d'abord). En haut de page, tout est visible.
 */
export function useStagedHide(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    let last = window.scrollY;
    let acc = 0;
    let hidden = 0;
    let ticking = false;
    const levels = () => Array.from(ref.current?.children ?? []).filter((c) => c.classList.contains("lvl")) as HTMLElement[];
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const list = levels();
      // Le niveau le plus proche du contenu reste toujours figé : on ne retire jamais le dernier.
      hidden = Math.max(0, Math.min(hidden, list.length - 1));
      let offset = 0;
      for (let i = 0; i < hidden; i++) offset += list[i].offsetHeight;
      el.style.transform = offset ? `translateY(-${offset}px)` : "";
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const d = y - last;
        last = y;
        if (y < 10) {
          hidden = 0;
          acc = 0;
        } else if (d > 0) {
          acc = acc > 0 ? acc + d : d;
          if (acc >= STEP_DOWN) {
            hidden = Math.min(hidden + 1, Math.max(0, levels().length - 1));
            acc = 0;
          }
        } else if (d < 0) {
          acc = acc < 0 ? acc + d : d;
          if (acc <= -STEP_UP) {
            hidden--;
            acc = 0;
          }
        }
        apply();
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Un niveau peut apparaître ou disparaître (onglets d'une fiche) : on recale la position.
    const observer = new MutationObserver(apply);
    if (ref.current) observer.observe(ref.current, { childList: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (ref.current) ref.current.style.transform = "";
    };
  }, [ref]);
}

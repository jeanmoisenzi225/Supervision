import { useEffect, useRef, useState } from "react";

// Mesure de l'écran réellement donné à la page (v0.35.4) : ouvrir /ecran dans l'application installée
// puis dans Safari, et comparer. Un cadre rouge entoure la zone occupée par la page, un cadre vert la
// zone « sûre » (hors barre d'état et coins).
interface Info {
  [label: string]: string;
}

function measure(probe: HTMLElement | null, units: HTMLElement | null): Info {
  const vv = window.visualViewport;
  const cs = probe ? getComputedStyle(probe) : null;
  const px = (v: string | undefined) => (v ? `${Math.round(parseFloat(v))} px` : "?");
  const media = (q: string) => (window.matchMedia(q).matches ? "oui" : "non");
  // Hauteur réelle de chaque unité CSS (mesurée sur des éléments sondes) : sur l'iPhone Duo, 100vh peut dépasser la zone visible.
  const unit = (name: string) => {
    const el = units?.querySelector<HTMLElement>(`[data-u="${name}"]`);
    return el ? `${Math.round(el.getBoundingClientRect().height)} px` : "?";
  };
  return {
    "Page (innerWidth × innerHeight)": `${window.innerWidth} × ${window.innerHeight} px`,
    "Zone visible (visualViewport)": vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)} px, échelle ${vv.scale}` : "indisponible",
    "Document (clientWidth × clientHeight)": `${document.documentElement.clientWidth} × ${document.documentElement.clientHeight} px`,
    "Écran (screen.width × height)": `${screen.width} × ${screen.height} px`,
    "Écran utile (availWidth × availHeight)": `${screen.availWidth} × ${screen.availHeight} px`,
    "Densité de pixels": String(window.devicePixelRatio),
    "Hauteur 100vh · 100dvh": `${unit("vh")} · ${unit("dvh")}`,
    "Hauteur 100svh · 100lvh": `${unit("svh")} · ${unit("lvh")}`,
    "Hauteur d'un élément fixe (100 %)": unit("fixed"),
    "Décalage de la zone visible (haut, gauche)": vv ? `${Math.round(vv.offsetTop)} px, ${Math.round(vv.offsetLeft)} px` : "?",
    "Marge de sécurité haut": px(cs?.paddingTop),
    "Marge de sécurité droite": px(cs?.paddingRight),
    "Marge de sécurité bas": px(cs?.paddingBottom),
    "Marge de sécurité gauche": px(cs?.paddingLeft),
    "Application installée": `${(navigator as Navigator & { standalone?: boolean }).standalone === true ? "oui (iOS)" : "non"} · display-mode standalone : ${media("(display-mode: standalone)")}`,
    "Orientation": `${screen.orientation?.type ?? "inconnue"} · portrait : ${media("(orientation: portrait)")}`,
    "Tactile": `pointer coarse : ${media("(pointer: coarse)")}`,
    "Posture (pliable)": (navigator as Navigator & { devicePosture?: { type: string } }).devicePosture?.type ?? "non disponible",
    "Segments de page (pliable)": `horizontaux ${media("(horizontal-viewport-segments: 2)")} · verticaux ${media("(vertical-viewport-segments: 2)")}`,
    "Navigateur": navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 110),
  };
}

export function ScreenDiag() {
  const probe = useRef<HTMLDivElement>(null);
  const units = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<Info>({});
  useEffect(() => {
    const update = () => setInfo(measure(probe.current, units.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    const t = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.clearInterval(t);
    };
  }, []);
  return (
    <div style={{ minHeight: "100dvh", background: "#0f172a", color: "#e2e8f0", padding: "calc(env(safe-area-inset-top) + 24px) 20px 24px", font: "14px/1.5 system-ui" }}>
      {/* Cadre rouge : bord de la page. Cadre vert : zone sûre. */}
      <div style={{ position: "fixed", inset: 0, border: "4px solid #ef4444", pointerEvents: "none", zIndex: 100 }} />
      <div style={{ position: "fixed", top: "env(safe-area-inset-top)", right: "env(safe-area-inset-right)", bottom: "env(safe-area-inset-bottom)", left: "env(safe-area-inset-left)", border: "3px dashed #22c55e", pointerEvents: "none", zIndex: 99 }} />
      <div ref={probe} style={{ position: "absolute", visibility: "hidden", padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }} />
      <div ref={units} aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, overflow: "hidden", visibility: "hidden", pointerEvents: "none" }}>
        <div data-u="vh" style={{ height: "100vh" }} />
        <div data-u="dvh" style={{ height: "100dvh" }} />
        <div data-u="svh" style={{ height: "100svh" }} />
        <div data-u="lvh" style={{ height: "100lvh" }} />
        <div data-u="fixed" style={{ position: "fixed", top: 0, left: 0, height: "100%", width: 0 }} />
      </div>
      <h1 style={{ fontSize: "1.3rem", margin: "0 0 4px" }}>Mesure de l'écran</h1>
      <p style={{ margin: "0 0 16px", color: "#94a3b8" }}>Rouge : bord de la page. Vert (pointillés) : zone sûre. Envoyez une capture d'écran de cette page, ouverte dans l'application installée puis dans Safari.</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {Object.entries(info).map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: "6px 8px 6px 0", color: "#94a3b8", verticalAlign: "top", borderBottom: "1px solid #334155" }}>{k}</td>
              <td style={{ padding: "6px 0", borderBottom: "1px solid #334155", fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

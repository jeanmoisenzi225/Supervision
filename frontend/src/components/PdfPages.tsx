import { useEffect, useRef, useState } from "react";

/**
 * Affiche TOUTES les pages d'un PDF, l'une sous l'autre (pdf.js, chargé à la demande).
 * Sur téléphone, un PDF dans un cadre n'en montre souvent que la première page : ici chaque page est dessinée.
 * Si le rendu échoue, `onFail` est appelé et l'appelant retombe sur le cadre PDF classique.
 */
export function PdfPages({ base64, onFail }: { base64: string; onFail: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const host = box.current;
    if (!host) return;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const pdf = await pdfjs.getDocument({ data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) }).promise;
        if (cancelled) return;
        host.replaceChildren();
        setState({ done: 0, total: pdf.numPages });
        const cssW = Math.max(host.clientWidth, 280);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = (cssW / base.width) * ratio;
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
          canvas.style.cssText = `width:100%;height:auto;display:block;background:#fff;border:1px solid var(--border);border-radius:6px;margin:0 0 10px`;
          canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", `Page ${n} sur ${pdf.numPages}`);
          host.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
          if (!cancelled) setState({ done: n, total: pdf.numPages });
        }
      } catch { if (!cancelled) onFail(); }
    })();
    return () => { cancelled = true; };
  }, [base64]);

  return <div>
    <div ref={box} />
    {(!state || state.done < state.total) && <p className="muted small">{state ? `Chargement des pages… ${state.done}/${state.total}` : "Chargement du document…"}</p>}
    {state && state.done === state.total && <p className="muted small">{state.total} page{state.total > 1 ? "s" : ""} : faites défiler pour tout lire avant de signer.</p>}
  </div>;
}

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Opened = { title: string; role: string; name: string; signerStatus: string; requestStatus: string; sha256: string; signers: { role: string; name: string; status: string }[]; pdfBase64: string };
const ROLE: Record<string, string> = { prestataire: "Prestataire", client: "Client" };

async function call<T>(token: string, action: "open" | "sign", body: unknown): Promise<T> {
  const res = await fetch(`/api/sign/${encodeURIComponent(token)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Erreur inattendue");
  return data as T;
}
const pdfUrl = (b64: string) => URL.createObjectURL(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: "application/pdf" }));

/** Page de signature, ouverte sans connexion : lien personnel + code reçu séparément. */
export function SignPage({ token }: { token: string }) {
  const [code, setCode] = useState("");
  const [doc, setDoc] = useState<Opened | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState<{ at: Date; completed: boolean } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [inked, setInked] = useState(false);
  // « Signer maintenant » depuis la Supervision : le code arrive dans le fragment de l'adresse (#123456), jamais envoyé au serveur.
  useEffect(() => {
    const m = /^#(\d{6})$/.exec(window.location.hash);
    if (!m) return;
    window.history.replaceState(null, "", window.location.pathname);
    setCode(m[1]);
    void open(undefined, m[1]);
  }, []);
  const url = useMemo(() => (doc ? pdfUrl(doc.pdfBase64) : ""), [doc?.pdfBase64]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function open(e?: React.FormEvent, withCode = code) {
    e?.preventDefault(); setError(""); setBusy(true);
    try { setDoc(await call<Opened>(token, "open", { code: withCode })); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height }; };
  function down(e: ReactPointerEvent<HTMLCanvasElement>) { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; const c = e.currentTarget.getContext("2d")!; const p = pos(e); c.beginPath(); c.moveTo(p.x, p.y); }
  function move(e: ReactPointerEvent<HTMLCanvasElement>) { if (!drawing.current) return; const c = e.currentTarget.getContext("2d")!; const p = pos(e); c.lineWidth = 3; c.lineCap = "round"; c.strokeStyle = "#0d0e10"; c.lineTo(p.x, p.y); c.stroke(); setInked(true); }
  const up = () => { drawing.current = false; };
  /** Réutilise le dernier tracé et le dernier nom saisis sur cet appareil. */
  function reuseLast() {
    try {
      const last = JSON.parse(localStorage.getItem("sign.last") ?? "null") as { name: string; signature: string } | null;
      const c = canvas.current;
      if (!last || !c) return;
      const img = new Image();
      img.onload = () => { const g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); setInked(true); };
      img.src = last.signature;
      if (!name.trim()) setName(last.name);
    } catch { /* rien de mémorisé */ }
  }
  const hasLast = (() => { try { return Boolean(localStorage.getItem("sign.last")); } catch { return false; } })();
  function clear() { const c = canvas.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setInked(false); }

  async function sign(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const signature = canvas.current!.toDataURL("image/png");
      const r = await call<{ completed: boolean }>(token, "sign", { code, typedName: name, signature, consent });
      // Mémorisée sur cet appareil seulement, pour la prochaine fois (jamais envoyée ailleurs qu'avec la signature).
      try { localStorage.setItem("sign.last", JSON.stringify({ name, signature })); } catch { /* stockage indisponible */ }
      setDone({ at: new Date(), completed: r.completed });
      window.scrollTo({ top: 0 });
      if (r.completed) await open();
      else setDoc((d) => (d ? { ...d, signerStatus: "signed", signers: d.signers.map((s) => (s.role === d.role ? { ...s, status: "signed" } : s)) } : d));
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  const wrap = (children: React.ReactNode) => <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 60px" }}><div className="brand" style={{ marginBottom: 18 }}><img src={document.documentElement.dataset.theme === "light" ? "/brand/njmdev-black.png" : "/brand/njmdev-white.png"} alt="NJMDev" style={{ height: 34 }} /></div>{children}</div>;
  const dark = document.documentElement.dataset.theme !== "light";

  if (!doc) return wrap(<section className="card">
    <h2>Signature d’un document</h2>
    <p className="muted small">Entrez le code à 6 chiffres que l’émetteur vous a transmis séparément de ce lien.</p>
    <form className="stack-small" onSubmit={open}>
      <label>Code d’accès<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
      {error && <p className="small" style={{ color: "var(--bad)" }}>{error}</p>}
      <button className="primary" type="submit" disabled={busy || code.length !== 6}>Ouvrir le document</button>
    </form>
  </section>);

  // Écran de confirmation : plein écran, en haut de page, impossible à manquer.
  if (done) {
    const waiting = doc.signers.filter((s) => s.status !== "signed");
    return wrap(<section className="card" style={{ textAlign: "center", padding: "28px 18px" }}>
      <div style={{ fontSize: 54, color: "var(--ok)", lineHeight: 1 }}>✓</div>
      <h2 style={{ margin: "10px 0 4px" }}>Votre signature est enregistrée</h2>
      <p className="muted">{doc.title}</p>
      <p className="small">Signé le {done.at.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })} par {name || doc.name}</p>
      {doc.requestStatus === "completed"
        ? <><p style={{ color: "var(--ok)" }}><strong>Toutes les parties ont signé.</strong> Le document est finalisé.</p><a className="button primary" href={url} download="document_signe.pdf">Télécharger le PDF signé</a></>
        : <p className="muted">{waiting.length ? `En attente de : ${waiting.map((s) => `${ROLE[s.role] ?? s.role} (${s.name})`).join(", ")}.` : "Finalisation en cours…"} Vous pouvez fermer cette page.</p>}
    </section>);
  }
  const completed = doc.requestStatus === "completed";
  const mustSign = doc.requestStatus === "pending" && doc.signerStatus === "pending";
  return wrap(<>
    <h2 style={{ marginTop: 0 }}>{doc.title}</h2>
    <p className="muted small">Vous signez en tant que <strong>{ROLE[doc.role] ?? doc.role}</strong> : {doc.name}</p>
    <section className="card">
      <h3>Document</h3>
      <iframe title="Document à signer" src={url} style={{ width: "100%", height: "68vh", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }} />
      <div className="row wrap" style={{ marginTop: 8 }}><a className="button" href={url} target="_blank" rel="noreferrer">Ouvrir le PDF en grand</a>{completed && <a className="button" href={url} download="document_signe.pdf">Télécharger le PDF signé</a>}</div>
      <p className="muted small">Si le document n’apparaît pas ci-dessus (c’est fréquent sur téléphone), utilisez « Ouvrir le PDF en grand » et lisez-le en entier avant de signer.</p>
      <p className="muted small" style={{ overflowWrap: "anywhere" }}>Empreinte SHA-256 du document : {doc.sha256}</p>
    </section>
    <section className="card">
      <h3>Signataires</h3>
      {doc.signers.map((s) => <p key={s.role} className="small">{s.status === "signed" ? "✓" : "○"} {ROLE[s.role] ?? s.role} : {s.name} — {s.status === "signed" ? "a signé" : "en attente"}</p>)}
    </section>
    {completed && <p style={{ color: "var(--ok)" }}><strong>Le document est signé par toutes les parties.</strong> Le PDF ci-dessus comprend la page de certificat.</p>}
    {doc.requestStatus === "cancelled" && <p style={{ color: "var(--warn)" }}>Cette demande a été annulée.</p>}
    {mustSign && <section className="card">
      <h3>Signer</h3>
      <form className="stack-small" onSubmit={sign}>
        <label>Votre nom complet<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={doc.name} /></label>
        <div>
          <div className="small muted">Dessinez votre signature (doigt ou souris)</div>
          <canvas ref={canvas} width={640} height={200} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            style={{ width: "100%", maxWidth: 520, height: "auto", aspectRatio: "16 / 5", touchAction: "none", background: dark ? "#f4f2ec" : "#fff", border: "1px solid var(--border)", borderRadius: 8, display: "block" }} />
          <div className="row wrap" style={{ marginTop: 6 }}><button type="button" onClick={clear}>Effacer</button>{hasLast && <button type="button" onClick={reuseLast}>Utiliser ma dernière signature</button>}</div>
        </div>
        <label className="row" style={{ alignItems: "flex-start" }}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> <span className="small">Je déclare avoir lu le document ci-dessus et je le signe électroniquement. J’accepte que la date de ma signature, mon nom, mon tracé, mon adresse IP et mon navigateur soient conservés comme preuve.</span></label>
        {error && <p className="small" style={{ color: "var(--bad)" }}>{error}</p>}
        <button className="primary" type="submit" disabled={busy || !inked || !consent || name.trim().length < 3}>Signer le document</button>
      </form>
    </section>}
  </>);
}

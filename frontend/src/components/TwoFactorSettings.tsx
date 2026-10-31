import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Setup {
  secret: string;
  otpauth: string;
  qrCodeDataUrl: string;
}

/** Réglages de la double authentification (code à 6 chiffres). */
export function TwoFactorSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void api<{ totpEnabled: boolean }>("/auth/me").then((r) => setEnabled(r.totpEnabled), () => undefined);
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      setSetup(await api<Setup>("/auth/2fa/setup", { method: "POST" }));
      setCode("");
    });

  const confirm = () =>
    run(async () => {
      await api("/auth/2fa/confirm", { method: "POST", body: { code } });
      setEnabled(true);
      setSetup(null);
      setCode("");
      setMessage({ ok: true, text: "Double authentification activée : le code sera demandé à chaque connexion." });
    });

  const disable = () =>
    run(async () => {
      await api("/auth/2fa/disable", { method: "POST", body: { password, code } });
      setEnabled(false);
      setDisabling(false);
      setPassword("");
      setCode("");
      setMessage({ ok: true, text: "Double authentification désactivée." });
    });

  async function copySecret() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const codeInput = (
    <label>
      Code à 6 chiffres
      <input className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} />
    </label>
  );

  return (
    <section className="card">
      <h3>Double authentification</h3>
      <p className="muted small">
        En plus du mot de passe, un code à 6 chiffres qui change toutes les 30 secondes, généré par ton téléphone. Indispensable : la Supervision peut redémarrer tes services.
      </p>
      {enabled === null && <p className="muted small">Chargement…</p>}

      {enabled === false && !setup && (
        <button className="primary" onClick={start} disabled={busy}>
          Activer
        </button>
      )}

      {enabled === false && setup && (
        <div className="stack-small">
          <p className="small">
            <strong>1.</strong> Ajoute la Supervision à ton appli de codes :
          </p>
          <a className="button primary-link" href={setup.otpauth}>
            Ajouter sur cet appareil
          </a>
          <p className="muted small">
            Sur iPhone, ce bouton ouvre l'appli Mots de passe, qui génère les codes. Depuis un ordinateur, scanne plutôt ce code avec l'appareil photo du téléphone :
          </p>
          <img className="qr" src={setup.qrCodeDataUrl} alt="QR code à scanner" width={180} height={180} />
          <p className="muted small">
            Ou saisis la clé à la main : <code className="secret">{setup.secret}</code>{" "}
            <button className="link" onClick={copySecret}>
              {copied ? "Copiée" : "Copier"}
            </button>
          </p>
          <p className="small">
            <strong>2.</strong> Saisis le code affiché pour « Supervision » :
          </p>
          {codeInput}
          <div className="row wrap">
            <button className="primary" onClick={confirm} disabled={busy || code.replace(/\s/g, "").length !== 6}>
              Confirmer
            </button>
            <button onClick={() => setSetup(null)} disabled={busy}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {enabled === true && !disabling && (
        <div className="row wrap">
          <span className="success grow">Active : le code est demandé à chaque connexion.</span>
          <button onClick={() => setDisabling(true)}>Désactiver</button>
        </div>
      )}

      {enabled === true && disabling && (
        <div className="stack-small">
          <label>
            Mot de passe
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {codeInput}
          <div className="row wrap">
            <button onClick={disable} disabled={busy || !password || code.replace(/\s/g, "").length !== 6}>
              Confirmer la désactivation
            </button>
            <button onClick={() => setDisabling(false)} disabled={busy}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {message && <p className={`small ${message.ok ? "success" : "error"}`}>{message.text}</p>}
    </section>
  );
}

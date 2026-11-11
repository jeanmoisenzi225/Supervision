import { useState, type FormEvent } from "react";
import { api, ApiError, setToken } from "../lib/api";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>("/auth/login", {
        method: "POST",
        body: { email, password, ...(needCode ? { code } : {}) },
      });
      setToken(token);
      onLogin();
    } catch (err) {
      if (err instanceof ApiError && err.data.totpRequired) {
        // Premier passage : le mot de passe est bon, on demande le code
        // sans afficher d'erreur.
        if (needCode) setError(err.message);
        setNeedCode(true);
        setCode("");
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <img src="/brand/njmdev-white.png" alt="" height={48} style={{ width: "auto" }} />
        <h1>NJMDev</h1>
        <p className="muted">Accès réservé au super administrateur</p>
        {!needCode ? (
          <>
            <label>
              E-mail
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Mot de passe
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
          </>
        ) : (
          <label>
            Code à 6 chiffres
            <input
              className="code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <span className="small">Ouvre l'appli Mots de passe (ou ton appli de codes), fiche « Supervision ».</span>
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Connexion…" : needCode ? "Valider" : "Se connecter"}
        </button>
        {needCode && (
          <button
            type="button"
            className="link"
            onClick={() => {
              setNeedCode(false);
              setError(null);
            }}
          >
            Retour
          </button>
        )}
      </form>
    </div>
  );
}

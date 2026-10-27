import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { APP_VERSION } from "../version";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function Settings() {
  const [pushState, setPushState] = useState<"unsupported" | "unconfigured" | "off" | "on" | "loading">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    void api<{ email: string }>("/auth/me").then((r) => setEmail(r.email), () => undefined);
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushState("unsupported");
        return;
      }
      const { configured } = await api<{ configured: boolean }>("/push/public-key");
      if (!configured) {
        setPushState("unconfigured");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      setPushState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setPushState("unsupported"));
  }, []);

  async function enable() {
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Autorisation refusée par le navigateur");
      const { publicKey } = await api<{ publicKey: string }>("/push/public-key");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await api("/push/subscribe", { method: "POST", body: sub.toJSON() });
      setPushState("on");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    setPushState("off");
  }

  async function test() {
    await api("/push/test", { method: "POST" });
    setMessage("Notification de test envoyée");
  }

  return (
    <>
      <h1>Réglages</h1>
      <section className="card">
        <h3>Notifications des alertes</h3>
        <p className="muted small">Une notification arrive sur cet appareil dès qu'une appli tombe, qu'une erreur apparaît ou qu'un incident est clos.</p>
        {pushState === "unsupported" && (
          <p className="small">
            Non disponible ici. Sur iPhone, installer d'abord l'appli sur l'écran d'accueil (Partager › Sur l'écran d'accueil), puis l'ouvrir depuis l'icône.
          </p>
        )}
        {pushState === "unconfigured" && <p className="small">Les clés VAPID ne sont pas encore définies sur le serveur.</p>}
        {pushState === "off" && <button className="primary" onClick={enable}>Activer sur cet appareil</button>}
        {pushState === "on" && (
          <div className="row wrap">
            <span className="success grow">Activées sur cet appareil</span>
            <button onClick={test}>Envoyer un test</button>
            <button onClick={disable}>Désactiver</button>
          </div>
        )}
        {message && <p className="small">{message}</p>}
      </section>
      <section className="card">
        <h3>Compte</h3>
        <p className="small">Connecté : {email}</p>
        <p className="muted small">Version {APP_VERSION}</p>
      </section>
    </>
  );
}

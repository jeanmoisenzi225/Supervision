import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string {
  // .trim() : un copier-coller dans Render laisse facilement un espace ou un
  // retour à la ligne en trop.
  return (process.env[name] ?? "").trim();
}

export const env = {
  port: Number(process.env.PORT ?? 4100),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim()),
  adminEmail: optional("ADMIN_EMAIL"),
  adminPassword: optional("ADMIN_PASSWORD"),
  vapidPublicKey: optional("VAPID_PUBLIC_KEY"),
  vapidPrivateKey: optional("VAPID_PRIVATE_KEY"),
  vapidSubject: optional("VAPID_SUBJECT"),
  renderApiKey: optional("RENDER_API_KEY"),
  // Nombre d'échecs consécutifs avant d'ouvrir une alerte « en panne » :
  // évite d'alerter sur un simple raté réseau isolé.
  alertAfterFailures: Number(process.env.ALERT_AFTER_FAILURES ?? 2),
  logRetentionDays: Number(process.env.LOG_RETENTION_DAYS ?? 30),
  checkRetentionDays: Number(process.env.CHECK_RETENTION_DAYS ?? 30),
  // Désactive la boucle de vérification (tests, développement hors ligne).
  monitorEnabled: process.env.MONITOR_ENABLED !== "false",
};

export { optional as readOptionalEnv };

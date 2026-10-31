import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import QRCode from "qrcode";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { requireAdmin, signToken } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { generateTotpSecret, totpUri, verifyTotp } from "./totp";

export const authRouter = asyncRouter();

// Compte aussi les essais de code à 6 chiffres : 10 essais / 15 min rendent
// la recherche d'un code au hasard impossible.
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const sensitiveLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

async function checkCode(userId: string, secret: string, lastStep: number | null, code: string): Promise<void> {
  const step = verifyTotp(secret, code, lastStep);
  if (step === null) throw new HttpError(401, "Code invalide", { totpRequired: true });
  await prisma.adminUser.update({ where: { id: userId }, data: { totpLastStep: step } });
}

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password, code } = z
    .object({ email: z.string().email(), password: z.string().min(1), code: z.string().max(10).optional() })
    .parse(req.body);
  const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Identifiants incorrects");
  }
  if (user.totpEnabled && user.totpSecret) {
    if (!code) throw new HttpError(401, "Saisis le code à 6 chiffres", { totpRequired: true });
    await checkCode(user.id, user.totpSecret, user.totpLastStep, code);
  }
  res.json({ token: signToken({ sub: user.id, email: user.email }), email: user.email });
});

authRouter.get("/me", requireAdmin, async (req, res) => {
  const user = await prisma.adminUser.findUnique({ where: { id: req.admin!.sub } });
  res.json({ email: req.admin!.email, totpEnabled: Boolean(user?.totpEnabled) });
});

/** Étape 1 : nouveau secret (pas encore actif), à ajouter dans l'appli de codes. */
authRouter.post("/2fa/setup", requireAdmin, sensitiveLimiter, async (req, res) => {
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.sub } });
  if (user.totpEnabled) throw new HttpError(409, "La double authentification est déjà active");
  const secret = generateTotpSecret();
  await prisma.adminUser.update({ where: { id: user.id }, data: { totpSecret: secret, totpLastStep: null } });
  const otpauth = totpUri(user.email, secret);
  res.json({ secret, otpauth, qrCodeDataUrl: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) });
});

/** Étape 2 : un premier code juste prouve que l'appli de codes est prête ; la double authentification devient active. */
authRouter.post("/2fa/confirm", requireAdmin, sensitiveLimiter, async (req, res) => {
  const { code } = z.object({ code: z.string().max(10) }).parse(req.body);
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.sub } });
  if (user.totpEnabled) throw new HttpError(409, "La double authentification est déjà active");
  if (!user.totpSecret) throw new HttpError(400, "Relance l'activation");
  await checkCode(user.id, user.totpSecret, user.totpLastStep, code);
  await prisma.adminUser.update({ where: { id: user.id }, data: { totpEnabled: true } });
  res.json({ ok: true });
});

/** Désactivation : mot de passe et code exigés. */
authRouter.post("/2fa/disable", requireAdmin, sensitiveLimiter, async (req, res) => {
  const { password, code } = z.object({ password: z.string().min(1), code: z.string().max(10) }).parse(req.body);
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.sub } });
  if (!user.totpEnabled || !user.totpSecret) throw new HttpError(400, "La double authentification n'est pas active");
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, "Mot de passe incorrect");
  await checkCode(user.id, user.totpSecret, user.totpLastStep, code);
  await prisma.adminUser.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null, totpLastStep: null } });
  res.json({ ok: true });
});

/** Crée le super administrateur au premier démarrage (ADMIN_EMAIL / ADMIN_PASSWORD). */
export async function ensureAdmin(): Promise<void> {
  if (!env.adminEmail) return;
  const email = env.adminEmail.toLowerCase();
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing && env.adminReset2fa && existing.totpEnabled) {
    await prisma.adminUser.update({ where: { id: existing.id }, data: { totpEnabled: false, totpSecret: null, totpLastStep: null } });
    console.warn(`[auth] double authentification coupée pour ${email} (ADMIN_RESET_2FA) : retirer cette variable puis la réactiver`);
  }
  if (existing || !env.adminPassword) return;
  await prisma.adminUser.create({ data: { email, passwordHash: await bcrypt.hash(env.adminPassword, 12) } });
  console.log(`[auth] super administrateur créé : ${email}`);
}

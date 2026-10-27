import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { requireAdmin, signToken } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";

export const authRouter = asyncRouter();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Identifiants incorrects");
  }
  res.json({ token: signToken({ sub: user.id, email: user.email }), email: user.email });
});

authRouter.get("/me", requireAdmin, async (req, res) => {
  res.json({ email: req.admin!.email });
});

/** Crée le super administrateur au premier démarrage (ADMIN_EMAIL / ADMIN_PASSWORD). */
export async function ensureAdmin(): Promise<void> {
  if (!env.adminEmail || !env.adminPassword) return;
  const email = env.adminEmail.toLowerCase();
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return;
  await prisma.adminUser.create({ data: { email, passwordHash: await bcrypt.hash(env.adminPassword, 12) } });
  console.log(`[auth] super administrateur créé : ${email}`);
}

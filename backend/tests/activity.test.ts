import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Nécessite une vraie base : TEST_DATABASE_URL=postgresql://... npx vitest run --no-file-parallelism
describe.skipIf(!process.env.TEST_DATABASE_URL)("Alerte d'activité (v0.54.0)", () => {
  let prisma: typeof import("../src/db/prisma").prisma;
  let svc: typeof import("../src/modules/activity/activity.service");
  let app: ReturnType<typeof import("../src/app").createApp>;
  let auth: { Authorization: string };
  let procedia: (typeof import("../src/config/apps"))["apps"][number];
  const t0 = Date.parse("2026-11-25T10:00:00Z");
  const at = (min: number) => new Date(t0 + min * 60_000);
  const report = (users: { id: string; name: string; role: string; lastSeenAt: Date }[]) => ({ activity: { users: users.map((u) => ({ ...u, lastSeenAt: u.lastSeenAt.toISOString() })) } });
  const open = () => prisma.alert.findMany({ where: { appKey: "procedia", fingerprint: { startsWith: "activity:procedia:" }, status: { in: ["open", "acknowledged"] } } });

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    ({ prisma } = await import("../src/db/prisma"));
    svc = await import("../src/modules/activity/activity.service");
    const { apps } = await import("../src/config/apps");
    procedia = apps.find((a) => a.key === "procedia")!;
    const { signToken } = await import("../src/middleware/auth");
    app = (await import("../src/app")).createApp();
    auth = { Authorization: `Bearer ${signToken({ sub: "t", email: "t@example.test" })}` };
    await prisma.alert.deleteMany({ where: { appKey: "procedia" } });
    await prisma.setting.deleteMany({ where: { key: "activityAlert:procedia" } });
    await prisma.appPause.deleteMany({ where: { appKey: "procedia" } });
  });
  afterAll(async () => {
    await prisma.alert.deleteMany({ where: { appKey: "procedia" } });
    await prisma.setting.deleteMany({ where: { key: "activityAlert:procedia" } });
  });

  it("ouvre une alerte par compte actif, sans doublon, puis la referme sans bruit après 30 minutes d'inactivité", async () => {
    const alice = { id: "u1", name: "Alice Test", role: "CONSULTANT", lastSeenAt: at(0) };
    await svc.watchActivity(procedia, report([alice]), at(1));
    let alerts = await open();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "warning", fingerprint: "activity:procedia:u1" });
    expect(alerts[0].title).toContain("Alice Test");
    expect(alerts[0].detail).toContain("désactiver cette alerte");
    // Nouveau relevé peu après : toujours une seule alerte.
    await svc.watchActivity(procedia, report([{ ...alice, lastSeenAt: at(3) }]), at(4));
    expect(await open()).toHaveLength(1);
    // Un deuxième compte ouvre sa propre alerte.
    await svc.watchActivity(procedia, report([alice, { id: "u2", name: "Bob Test", role: "ADMIN", lastSeenAt: at(5) }]), at(6));
    expect(await open()).toHaveLength(2);
    // Alice inactive depuis plus de 30 minutes : son alerte se referme, Bob reste.
    await svc.watchActivity(procedia, report([{ id: "u2", name: "Bob Test", role: "ADMIN", lastSeenAt: at(40) }, { ...alice, lastSeenAt: at(3) }]), at(41));
    alerts = await open();
    expect(alerts.map((a) => a.fingerprint)).toEqual(["activity:procedia:u2"]);
    // Nouvelle activité d'Alice après une pause : une nouvelle alerte s'ouvre.
    await svc.watchActivity(procedia, report([{ ...alice, lastSeenAt: at(100) }]), at(101));
    expect((await open()).map((a) => a.fingerprint).sort()).toEqual(["activity:procedia:u1"]);
  });

  it("peut être désactivée à tout moment : plus d'alerte, et celles ouvertes sont refermées", async () => {
    const res = await request(app).get("/api/apps/procedia/activity-alert").set(auth).expect(200);
    expect(res.body).toMatchObject({ supported: true, enabled: true });
    await request(app).put("/api/apps/procedia/activity-alert").set(auth).send({ enabled: false }).expect(200);
    expect(await open()).toHaveLength(0);
    expect((await request(app).get("/api/apps/procedia/activity-alert").set(auth)).body.enabled).toBe(false);
    await svc.watchActivity(procedia, report([{ id: "u9", name: "Carole Test", role: "CONSULTANT", lastSeenAt: at(200) }]), at(201));
    expect(await open()).toHaveLength(0);
    // Réactivée : l'activité en cours déclenche de nouveau l'alerte.
    await request(app).put("/api/apps/procedia/activity-alert").set(auth).send({ enabled: true }).expect(200);
    await svc.watchActivity(procedia, report([{ id: "u9", name: "Carole Test", role: "CONSULTANT", lastSeenAt: at(210) }]), at(211));
    expect(await open()).toHaveLength(1);
  });

  it("ne fait rien si l'appli ne fournit pas l'activité (ancienne version)", async () => {
    await prisma.alert.deleteMany({ where: { appKey: "procedia" } });
    await svc.watchActivity(procedia, {}, at(300));
    expect(await open()).toHaveLength(0);
  });
});

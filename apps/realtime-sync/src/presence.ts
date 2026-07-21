import Redis from "ioredis";

export type Intent = { userId: string; userName: string; projectId: string; filePath: string; summary: string; startedAt: string; lastActiveAt: string; expiresAt: string };
const ttlSeconds = 15 * 60;
const memory = new Map<string, Intent>();
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : undefined;
if (redis) redis.on("error", () => undefined);

function key(intent: Pick<Intent, "projectId" | "userId">) { return `live_intent:${intent.projectId}:${intent.userId}`; }
function purge() { const now = Date.now(); for (const [storedKey, intent] of Array.from(memory.entries())) if (Date.parse(intent.expiresAt) <= now) memory.delete(storedKey); }

export async function setIntent(intent: Intent) {
  memory.set(key(intent), intent);
  if (redis) { try { await redis.connect().catch(() => undefined); await redis.set(key(intent), JSON.stringify(intent), "EX", ttlSeconds); } catch { /* local fallback remains available */ } }
}
export async function deleteIntent(projectId: string, userId: string) {
  memory.delete(key({ projectId, userId }));
  if (redis) { try { await redis.del(key({ projectId, userId })); } catch { /* local fallback */ } }
}
export async function listIntents(projectId: string) {
  purge();
  if (redis) { try { const keys = await redis.keys(`live_intent:${projectId}:*`); const values = await Promise.all(keys.map((storedKey) => redis.get(storedKey))); return values.filter(Boolean).map((value) => JSON.parse(value as string) as Intent); } catch { /* local fallback */ } }
  return Array.from(memory.values()).filter((intent) => intent.projectId === projectId);
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setIntent = setIntent;
exports.deleteIntent = deleteIntent;
exports.listIntents = listIntents;
const ioredis_1 = __importDefault(require("ioredis"));
const ttlSeconds = 15 * 60;
const memory = new Map();
const redis = process.env.REDIS_URL ? new ioredis_1.default(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : undefined;
if (redis)
    redis.on("error", () => undefined);
function key(intent) { return `live_intent:${intent.projectId}:${intent.userId}`; }
function purge() { const now = Date.now(); for (const [storedKey, intent] of Array.from(memory.entries()))
    if (Date.parse(intent.expiresAt) <= now)
        memory.delete(storedKey); }
async function setIntent(intent) {
    memory.set(key(intent), intent);
    if (redis) {
        try {
            await redis.connect().catch(() => undefined);
            await redis.set(key(intent), JSON.stringify(intent), "EX", ttlSeconds);
        }
        catch { /* local fallback remains available */ }
    }
}
async function deleteIntent(projectId, userId) {
    memory.delete(key({ projectId, userId }));
    if (redis) {
        try {
            await redis.del(key({ projectId, userId }));
        }
        catch { /* local fallback */ }
    }
}
async function listIntents(projectId) {
    purge();
    if (redis) {
        try {
            const keys = await redis.keys(`live_intent:${projectId}:*`);
            const values = await Promise.all(keys.map((storedKey) => redis.get(storedKey)));
            return values.filter(Boolean).map((value) => JSON.parse(value));
        }
        catch { /* local fallback */ }
    }
    return Array.from(memory.values()).filter((intent) => intent.projectId === projectId);
}

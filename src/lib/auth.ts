import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDatabase, query } from "@/lib/db";

type User = { id: string; email: string; name: string; passwordHash: string };
const users: User[] = [{ id: "user-suresh", email: "suresh@example.com", name: "Suresh Kumar", passwordHash: hashPassword("demo1234") }];
const sessions = new Map<string, { userId: string; expiresAt: number }>();

export function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
export function verifyPassword(password: string, stored: string) { const [salt, key] = stored.split(":"); if (!salt || !key) return false; const derived = scryptSync(password, salt, 64); return timingSafeEqual(derived, Buffer.from(key, "hex")); }
export async function createUser(email: string, name: string, password: string) { if (getDatabase()) { const result = await query<UserRow>(`INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id, email, name, password_hash AS "passwordHash"`, [email, name, hashPassword(password)]); return result.rows[0] ? publicUser(result.rows[0]) : undefined; } if (users.some((user) => user.email === email)) return undefined; const user = { id: `user-${Date.now()}`, email, name, passwordHash: hashPassword(password) }; users.push(user); return publicUser(user); }
export async function authenticate(email: string, password: string) { if (getDatabase()) { await ensureDemoUser(); const result = await query<UserRow>(`SELECT id, email, name, password_hash AS "passwordHash" FROM users WHERE email = $1`, [email]); const user = result.rows[0]; return user && verifyPassword(password, user.passwordHash) ? publicUser(user) : undefined; } const user = users.find((candidate) => candidate.email === email); return user && verifyPassword(password, user.passwordHash) ? publicUser(user) : undefined; }
export async function createSession(userId: string) { const token = randomBytes(32).toString("hex"); const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); if (getDatabase()) { await query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [userId, hashToken(token), expiresAt]); } else sessions.set(hashToken(token), { userId, expiresAt: expiresAt.getTime() }); return token; }
export async function getUserFromToken(token: string | undefined) { if (!token) return undefined; if (getDatabase()) { const result = await query<UserRow>(`SELECT u.id, u.email, u.name, u.password_hash AS "passwordHash" FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`, [hashToken(token)]); return result.rows[0]; } const session = sessions.get(hashToken(token)); if (!session || session.expiresAt < Date.now()) return undefined; return users.find((user) => user.id === session.userId); }
export async function deleteSession(token: string | undefined) { if (!token) return; if (getDatabase()) await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]); else sessions.delete(hashToken(token)); }
export function publicUser(user: User) { return { id: user.id, email: user.email, name: user.name }; }
type UserRow = User;

async function ensureDemoUser() { await query(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`, ["00000000-0000-0000-0000-000000000002", "suresh@example.com", hashPassword("demo1234"), "Suresh Kumar"]); }
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

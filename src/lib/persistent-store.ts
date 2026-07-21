import { query } from "@/lib/db";
import { chunkMarkdown } from "@/lib/chunking";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/auth";
import { distillConversationTurn, ConversationMemory } from "@/lib/ai-decisions";

export const ATLAS_API_ID = "atlas-project";
export const ATLAS_DB_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000002";

export async function ensureAtlasSeed() {
  await query(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash`, [DEMO_USER_ID, "suresh@example.com", hashPassword("demo1234"), "Suresh Kumar"]);
  await query(`INSERT INTO projects (id, owner_id, name, description) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`, [ATLAS_DB_ID, DEMO_USER_ID, "Atlas project", "The shared memory layer for the Atlas engineering project."]);
  await query(`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`, [ATLAS_DB_ID, DEMO_USER_ID]);
  await query(`INSERT INTO project_settings (project_id) VALUES ($1) ON CONFLICT DO NOTHING`, [ATLAS_DB_ID]);
  const sources = [
    { id: "00000000-0000-0000-0000-000000000011", type: "document", name: "ARCHITECTURE.md", content: "# Atlas architecture\n\nAtlas uses a Next.js web application with a Postgres data layer.\n" },
    { id: "00000000-0000-0000-0000-000000000012", type: "notes", name: "Sprint planning notes", content: "# Sprint planning\n\nThe team will keep retrieval provider-agnostic.\n" },
  ];
  await query(`DELETE FROM chunks WHERE source_id IN (SELECT id FROM sources WHERE project_id = $1 AND content = 'Repository sync placeholder')`, [ATLAS_DB_ID]);
  await query(`DELETE FROM sources WHERE project_id = $1 AND content = 'Repository sync placeholder'`, [ATLAS_DB_ID]);
  for (const source of sources) {
    await query(`INSERT INTO sources (id, project_id, type, name, status, content, last_indexed_at) VALUES ($1, $2, $3, $4, 'indexed', $5, now()) ON CONFLICT (id) DO NOTHING`, [source.id, ATLAS_DB_ID, source.type, source.name, source.content]);
    const chunks = chunkMarkdown(source.content);
    for (const chunk of chunks) await query(`INSERT INTO chunks (source_id, project_id, content, heading, token_count, version, is_current) SELECT $1, $2, $3, $4, $5, 1, true WHERE NOT EXISTS (SELECT 1 FROM chunks WHERE source_id = $1)`, [source.id, ATLAS_DB_ID, chunk.content, chunk.heading, chunk.tokenCount]);
  }
  await query(`INSERT INTO decisions (id, project_id, title, rationale, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`, ["00000000-0000-0000-0000-000000000021", ATLAS_DB_ID, "Keep retrieval provider-agnostic", "The core retrieval and storage layers should not need schema changes when a new AI assistant is added.", new Date("2026-07-16T10:00:00.000Z")]);
}

export type WorkspaceProject = { id: string; name: string; description: string; createdAt: string };
export async function listDatabaseProjects(userId: string) {
  await ensureAtlasSeed();
  const result = await query<WorkspaceProject>(`SELECT p.id, p.name, p.description, p.created_at AS "createdAt" FROM projects p JOIN project_members m ON m.project_id = p.id WHERE m.user_id = $1 ORDER BY p.created_at`, [userId]);
  return result.rows.map((project) => ({ ...project, id: project.id === ATLAS_DB_ID ? ATLAS_API_ID : project.id }));
}
export async function createDatabaseProject(userId: string, input: { name: string; description?: string }) {
  await ensureAtlasSeed();
  const result = await query<WorkspaceProject>(`INSERT INTO projects (owner_id, name, description) VALUES ($1, $2, $3) RETURNING id, name, description, created_at AS "createdAt"`, [userId, input.name.trim(), input.description?.trim() || "A shared OneContext project."]);
  const project = result.rows[0];
  await query(`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')`, [project.id, userId]);
  await query(`INSERT INTO project_settings (project_id) VALUES ($1)`, [project.id]);
  return project;
}

export async function listDatabaseSources(projectId: string) { await ensureAtlasSeed(); const result = await query(`SELECT s.id, s.name, s.type, s.status, s.content, s.created_at AS "createdAt", s.last_indexed_at AS "lastIndexedAt", COUNT(c.id)::int AS "chunkCount" FROM sources s LEFT JOIN chunks c ON c.source_id = s.id AND c.is_current = true WHERE s.project_id = $1 GROUP BY s.id ORDER BY s.created_at DESC`, [toDatabaseProjectId(projectId)]); return result.rows.map((row) => ({ ...row, projectId })); }
export async function addDatabaseSource(projectId: string, input: { name: string; type: "markdown" | "notes" | "github"; content: string; originUrl?: string }) { await ensureAtlasSeed(); const sourceId = randomUUID(); const chunks = chunkMarkdown(input.content); const databaseType = input.type === "markdown" ? "document" : input.type; await query(`INSERT INTO sources (id, project_id, type, name, origin_url, status, content, last_indexed_at) VALUES ($1, $2, $3, $4, $5, 'indexed', $6, now())`, [sourceId, toDatabaseProjectId(projectId), databaseType, input.name, input.originUrl || null, input.content]); for (const chunk of chunks) await query(`INSERT INTO chunks (source_id, project_id, content, heading, token_count) VALUES ($1, $2, $3, $4, $5)`, [sourceId, toDatabaseProjectId(projectId), chunk.content, chunk.heading, chunk.tokenCount]); return { id: sourceId, projectId, name: input.name, type: input.type, status: "indexed", content: input.content, chunkCount: chunks.length, createdAt: new Date().toISOString(), lastIndexedAt: new Date().toISOString() }; }
export async function listDatabaseChunks(projectId: string) { await ensureAtlasSeed(); const result = await query(`SELECT c.id, c.project_id AS "projectId", c.source_id AS "sourceId", s.name AS "sourceName", c.heading, c.content, c.token_count AS "tokenCount", c.is_current AS "isCurrent" FROM chunks c JOIN sources s ON s.id = c.source_id WHERE c.project_id = $1 AND c.is_current = true ORDER BY c.created_at`, [toDatabaseProjectId(projectId)]); return result.rows; }
export async function listDatabaseDecisions(projectId: string) { await ensureAtlasSeed(); const result = await query(`SELECT id, title, rationale, created_at AS "createdAt" FROM decisions WHERE project_id = $1 ORDER BY created_at DESC`, [toDatabaseProjectId(projectId)]); return result.rows.map((row) => ({ ...row, projectId })); }
export async function createDatabaseDecision(projectId: string, title: string, rationale: string) { await ensureAtlasSeed(); const result = await query(`INSERT INTO decisions (project_id, title, rationale) VALUES ($1, $2, $3) RETURNING id, title, rationale, created_at AS "createdAt"`, [toDatabaseProjectId(projectId), title, rationale]); return { ...result.rows[0], projectId }; }
export async function listDatabaseTimeline(projectId: string) { await ensureAtlasSeed(); const databaseProjectId = toDatabaseProjectId(projectId); const sources = await query(`SELECT id, name, status, created_at AS "createdAt", last_indexed_at AS "lastIndexedAt" FROM sources WHERE project_id = $1`, [databaseProjectId]); const decisions = await query(`SELECT id, title, rationale, created_at AS "createdAt" FROM decisions WHERE project_id = $1`, [databaseProjectId]); return [...sources.rows.map((source) => ({ id: `source-${source.id}`, type: "source", title: `Indexed ${source.name}`, detail: `${source.status} source added to project memory`, createdAt: source.lastIndexedAt ?? source.createdAt })), ...decisions.rows.map((decision) => ({ id: decision.id, type: "decision", title: decision.title, detail: decision.rationale, createdAt: decision.createdAt }))].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()); }
export async function getDatabaseSettings(projectId: string) { await ensureAtlasSeed(); const result = await query(`SELECT index_github AS "indexGithub", index_documents AS "indexDocuments", index_notes AS "indexNotes", index_chat_exports AS "indexChatExports", updated_at AS "updatedAt" FROM project_settings WHERE project_id = $1`, [toDatabaseProjectId(projectId)]); return result.rows[0]; }
export async function updateDatabaseSettings(projectId: string, settings: { indexGithub?: boolean; indexDocuments?: boolean; indexNotes?: boolean; indexChatExports?: boolean }) { await ensureAtlasSeed(); const result = await query(`UPDATE project_settings SET index_github = COALESCE($2, index_github), index_documents = COALESCE($3, index_documents), index_notes = COALESCE($4, index_notes), index_chat_exports = COALESCE($5, index_chat_exports), updated_at = now() WHERE project_id = $1 RETURNING index_github AS "indexGithub", index_documents AS "indexDocuments", index_notes AS "indexNotes", index_chat_exports AS "indexChatExports", updated_at AS "updatedAt"`, [toDatabaseProjectId(projectId), settings.indexGithub ?? null, settings.indexDocuments ?? null, settings.indexNotes ?? null, settings.indexChatExports ?? null]); return result.rows[0]; }
export async function recordActivity(projectId: string, input: { userId?: string; agent?: string; eventType: string; prompt?: string; answer?: string; summary: string; filePaths?: string[]; metadata?: Record<string, unknown> }) { await ensureAtlasSeed(); const result = await query(`INSERT INTO activity_events (project_id, user_id, agent, event_type, prompt, answer, summary, file_paths, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb) RETURNING id, project_id AS "projectId", user_id AS "userId", agent, event_type AS "eventType", prompt, answer, summary, file_paths AS "filePaths", metadata, created_at AS "createdAt"`, [toDatabaseProjectId(projectId), input.userId || DEMO_USER_ID, input.agent || "generic", input.eventType, input.prompt || null, input.answer || null, input.summary, JSON.stringify(input.filePaths || []), JSON.stringify(input.metadata || {})]); return { ...result.rows[0], projectId }; }
export async function upsertConversationTurn(projectId: string, input: { agent: string; conversationId: string; turnKey: string; prompt: string; answer: string }) {
  await ensureAtlasSeed();
  const dbProjectId = toDatabaseProjectId(projectId);
  const existing = await query<{ id: string; answer?: string }>(`SELECT id, answer FROM activity_events WHERE project_id = $1 AND metadata->>'turnKey' = $2 LIMIT 1`, [dbProjectId, input.turnKey]);
  if (existing.rows[0]?.answer === input.answer) return { id: existing.rows[0].id, updated: true };
  const memory = await distillConversationTurn(input.prompt, input.answer);
  const summary = memory?.shouldRemember ? memory.summary : `Synced ${input.agent} project conversation: ${input.prompt.slice(0, 160)}`;
  const metadata = { conversationId: input.conversationId, turnKey: input.turnKey, autoSynced: true, ...(memory ? { memory } : {}) };
  if (existing.rows[0]) {
    await query(`UPDATE activity_events SET prompt = $2, answer = $3, summary = $4, metadata = metadata || $5::jsonb WHERE id = $1`, [existing.rows[0].id, input.prompt, input.answer, summary, JSON.stringify(metadata)]);
    if (memory?.shouldRemember) await persistStructuredConversationMemory(projectId, input, memory);
    return { id: existing.rows[0].id, updated: true };
  }
  const event = await recordActivity(projectId, { agent: input.agent, eventType: "conversation_turn", prompt: input.prompt, answer: input.answer, summary, metadata });
  if (memory?.shouldRemember) await persistStructuredConversationMemory(projectId, input, memory);
  return { id: String((event as { id?: string }).id || ""), updated: false };
}
async function persistStructuredConversationMemory(projectId: string, input: { agent: string; conversationId: string; turnKey: string; prompt: string; answer: string }, memory: ConversationMemory) {
  const dbProjectId = toDatabaseProjectId(projectId);
  const session = await query<{ id: string }>(`INSERT INTO conversation_sessions (project_id, provider, client_conversation_id) VALUES ($1, $2, $3) ON CONFLICT (project_id, provider, client_conversation_id) DO UPDATE SET updated_at = now() RETURNING id`, [dbProjectId, input.agent, input.conversationId]);
  const turn = await query<{ id: string }>(`INSERT INTO conversation_turns (session_id, turn_key, prompt, answer) VALUES ($1, $2, $3, $4) ON CONFLICT (session_id, turn_key) DO UPDATE SET prompt = EXCLUDED.prompt, answer = EXCLUDED.answer, updated_at = now() RETURNING id`, [session.rows[0].id, input.turnKey, input.prompt, input.answer]);
  const items = memory.items.length ? memory.items : [{ type: "conversation_summary" as const, title: `Conversation: ${input.prompt.slice(0, 100)}`, summary: memory.summary, importance: 3, metadata: {} }];
  for (const item of items) await query(`INSERT INTO memory_items (project_id, type, title, summary, importance, source_turn_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) ON CONFLICT (project_id, type, title, status) DO UPDATE SET summary = EXCLUDED.summary, importance = GREATEST(memory_items.importance, EXCLUDED.importance), source_turn_id = EXCLUDED.source_turn_id, metadata = memory_items.metadata || EXCLUDED.metadata, updated_at = now()`, [dbProjectId, item.type, item.title, item.summary, item.importance, turn.rows[0].id, JSON.stringify(item.metadata || {})]);
}
export type MemoryItem = { id: string; type: string; title: string; summary: string; importance: number; metadata: Record<string, unknown>; createdAt: string; updatedAt: string };
export async function listStructuredMemory(projectId: string, limit = 30) {
  await ensureAtlasSeed();
  const result = await query<MemoryItem>(`SELECT id, type, title, summary, importance, metadata, created_at AS "createdAt", updated_at AS "updatedAt" FROM memory_items WHERE project_id = $1 AND status = 'active' ORDER BY importance DESC, updated_at DESC LIMIT $2`, [toDatabaseProjectId(projectId), limit]);
  return result.rows;
}
export async function buildStructuredContext(projectId: string, queryText: string, limit = 12) {
  const terms = queryText.toLowerCase().split(/[^a-z0-9_./-]+/).filter((term) => term.length > 2);
  const items = await listStructuredMemory(projectId, 50);
  const ranked = items.map((item) => ({ item, score: terms.filter((term) => `${item.title} ${item.summary}`.toLowerCase().includes(term)).length + item.importance / 10 })).filter(({ score }) => score > 0 || /continue|handoff|previous|conversation/i.test(queryText)).sort((a, b) => b.score - a.score).slice(0, limit).map(({ item }) => item);
  return ranked;
}
export async function listActivity(projectId: string, limit = 20) { await ensureAtlasSeed(); const result = await query<{ id: string; userId: string; agent: string; eventType: string; prompt?: string; answer?: string; summary: string; filePaths: string[]; metadata: Record<string, unknown>; createdAt: string }>(`SELECT id, user_id AS "userId", agent, event_type AS "eventType", prompt, answer, summary, file_paths AS "filePaths", metadata, created_at AS "createdAt" FROM activity_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`, [toDatabaseProjectId(projectId), limit]); return result.rows.map((row) => ({ ...row, projectId })); }
export async function getProjectBrief(projectId: string) { await ensureAtlasSeed(); const result = await query(`SELECT project_goal AS "projectGoal", current_sprint AS "currentSprint", updated_at AS "updatedAt" FROM project_settings WHERE project_id = $1`, [toDatabaseProjectId(projectId)]); return result.rows[0] || { projectGoal: "", currentSprint: "" }; }
export async function updateProjectBrief(projectId: string, brief: { projectGoal?: string; currentSprint?: string }) { await ensureAtlasSeed(); const result = await query(`UPDATE project_settings SET project_goal = COALESCE($2, project_goal), current_sprint = COALESCE($3, current_sprint), updated_at = now() WHERE project_id = $1 RETURNING project_goal AS "projectGoal", current_sprint AS "currentSprint", updated_at AS "updatedAt"`, [toDatabaseProjectId(projectId), brief.projectGoal ?? null, brief.currentSprint ?? null]); return result.rows[0]; }
function toDatabaseProjectId(projectId: string) { return projectId === ATLAS_API_ID ? ATLAS_DB_ID : projectId; }

import { randomBytes, randomUUID } from "node:crypto";
import { getDatabase, query } from "@/lib/db";
import { ATLAS_API_ID, ATLAS_DB_ID, ensureAtlasSeed } from "@/lib/persistent-store";

export type LiveIntent = {
  id: string;
  userId: string;
  userName: string;
  projectId: string;
  filePath: string;
  summary: string;
  startedAt: string;
  expiresAt: string;
};

const intents = new Map<string, LiveIntent>();
const fallbackTeams = new Map<string, { id: string; projectId: string; teamCode: string; createdAt: string }>();

function databaseProjectId(projectId: string) { return projectId === ATLAS_API_ID ? ATLAS_DB_ID : projectId; }
function publicProjectId(projectId: string) { return projectId === ATLAS_DB_ID ? ATLAS_API_ID : projectId; }
function cleanExpired() { const now = Date.now(); for (const [key, intent] of Array.from(intents.entries())) if (Date.parse(intent.expiresAt) <= now) intents.delete(key); }
function makeTeamCode() { return `ONECTX-${randomBytes(3).toString("hex").toUpperCase()}`; }

export async function ensureTeamSession(projectId: string) {
  if (getDatabase()) {
    await ensureAtlasSeed();
    const existing = await query(`SELECT id, project_id AS "projectId", team_code AS "teamCode", created_at AS "createdAt" FROM team_sessions WHERE project_id = $1 ORDER BY created_at LIMIT 1`, [databaseProjectId(projectId)]);
    if (existing.rows[0]) return { ...existing.rows[0], projectId };
    const created = await query(`INSERT INTO team_sessions (project_id, team_code) VALUES ($1, $2) RETURNING id, project_id AS "projectId", team_code AS "teamCode", created_at AS "createdAt"`, [databaseProjectId(projectId), makeTeamCode()]);
    return { ...created.rows[0], projectId };
  }
  const existing = Array.from(fallbackTeams.values()).find((team) => team.projectId === projectId);
  if (existing) return existing;
  const team = { id: randomUUID(), projectId, teamCode: makeTeamCode(), createdAt: new Date().toISOString() };
  fallbackTeams.set(team.id, team);
  return team;
}

export async function joinTeam(teamCode: string): Promise<{ id: string; projectId: string; teamCode: string; createdAt: string } | undefined> {
  if (getDatabase()) {
    const result = await query<{ id: string; projectId: string; teamCode: string; createdAt: string }>(`SELECT id, project_id AS "projectId", team_code AS "teamCode", created_at AS "createdAt" FROM team_sessions WHERE team_code = $1`, [teamCode.toUpperCase()]);
    const team = result.rows[0];
    return team ? { ...team, projectId: publicProjectId(team.projectId) } : undefined;
  }
  return Array.from(fallbackTeams.values()).find((team) => team.teamCode === teamCode.toUpperCase());
}

export async function publishIntent(input: { projectId: string; userId: string; userName: string; filePath: string; summary: string }) {
  cleanExpired();
  const now = new Date();
  const intent: LiveIntent = { id: `${input.userId}:${input.projectId}`, userId: input.userId, userName: input.userName, projectId: input.projectId, filePath: input.filePath.trim(), summary: input.summary.trim(), startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString() };
  intents.set(intent.id, intent);
  return { intent, conflicts: findConflicts(intent) };
}

export function clearIntent(projectId: string, userId: string) { intents.delete(`${userId}:${projectId}`); }
export function listIntents(projectId: string) { cleanExpired(); return Array.from(intents.values()).filter((intent) => intent.projectId === projectId); }
export function findConflicts(intent: LiveIntent) {
  const path = intent.filePath.toLowerCase();
  const summaryWords = new Set(intent.summary.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
  return listIntents(intent.projectId).filter((other) => other.userId !== intent.userId && (other.filePath.toLowerCase() === path || Array.from(summaryWords).some((word) => other.summary.toLowerCase().includes(word))));
}

export function teamActivityContext(projectId: string, queryText = "") {
  const active = listIntents(projectId);
  const relevant = active.filter((intent) => !queryText || intent.filePath.toLowerCase().includes(queryText.toLowerCase()) || intent.summary.toLowerCase().includes(queryText.toLowerCase()));
  if (!relevant.length) return "";
  return `### Live team activity\n${relevant.map((intent) => `- ${intent.userName} is working on ${intent.filePath}: ${intent.summary} (active until ${new Date(intent.expiresAt).toLocaleTimeString()})`).join("\n")}\nCoordinate with teammates before making structural changes to these areas.`;
}

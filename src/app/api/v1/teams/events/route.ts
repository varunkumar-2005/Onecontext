import { NextResponse } from "next/server";
import { createDatabaseDecision } from "@/lib/persistent-store";
import { createDecision } from "@/lib/store";
import { joinTeam } from "@/lib/live";
import { getDatabase } from "@/lib/db";
import { recordActivity } from "@/lib/persistent-store";

export async function POST(request: Request) {
  const body = await request.json() as { team_code?: string; project_id?: string; type?: string; title?: string; rationale?: string; agent?: string; prompt?: string; answer?: string };
  const team = body.team_code ? await joinTeam(body.team_code) : undefined;
  if (!team || team.projectId !== (body.project_id || "atlas-project")) return NextResponse.json({ error: { code: "TEAM_NOT_FOUND", message: "A valid Team Code is required." } }, { status: 401 });
  if ((body.type === "task_started" || body.type === "file_saved" || body.type === "task_completed") && body.title?.trim()) { const event = getDatabase() ? await recordActivity(team.projectId, { agent: "vscode", eventType: body.type, summary: body.title.trim(), filePaths: body.rationale ? [body.rationale] : [], metadata: body.type === "task_completed" ? { handoff: true, status: "completed" } : {} }) : { projectId: team.projectId, eventType: body.type, summary: body.title.trim() }; return NextResponse.json({ ok: true, event }, { status: 201 }); }
  if (body.type === "answer_saved" && body.title?.trim()) { const event = getDatabase() ? await recordActivity(team.projectId, { agent: body.agent || "codex", eventType: "answer_saved", prompt: body.prompt, answer: body.answer, summary: body.title.trim() }) : { projectId: team.projectId, eventType: "answer_saved", summary: body.title.trim() }; return NextResponse.json({ ok: true, event }, { status: 201 }); }
  if (body.type !== "commit" || !body.title?.trim()) return NextResponse.json({ error: { code: "EVENT_NOT_SUPPORTED", message: "This team event is not supported." } }, { status: 400 });
  const decision = process.env.DATABASE_URL ? await createDatabaseDecision(team.projectId, body.title.trim(), body.rationale?.trim() || "Committed work from OneContext Live.") : createDecision(team.projectId, body.title.trim(), body.rationale?.trim() || "Committed work from OneContext Live.");
  return NextResponse.json({ ok: true, decision }, { status: 201 });
}

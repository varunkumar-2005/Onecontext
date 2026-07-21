import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { recordActivity, upsertConversationTurn } from "@/lib/persistent-store";

export async function POST(request: NextRequest) {
  const configuredGatewayKey = process.env.ONECONTEXT_GATEWAY_KEY;
  if (configuredGatewayKey && request.headers.get("x-onecontext-key") !== configuredGatewayKey) return NextResponse.json({ error: { code: "INVALID_GATEWAY_KEY", message: "A valid gateway key is required." } }, { status: 401 });
  const body = await request.json() as { project_id?: string; agent?: string; summary?: string; files?: string[]; status?: "in_progress" | "completed" | "handoff"; prompt?: string; answer?: string; conversation_id?: string };
  const projectId = body.project_id || "atlas-project"; const agent = (body.agent || "assistant").slice(0, 40); const summary = body.summary?.trim() || "";
  if (!summary && !(body.prompt?.trim() && body.answer?.trim())) return NextResponse.json({ error: { code: "UPDATE_REQUIRED", message: "Provide a concise update or a completed prompt and answer." } }, { status: 400 });
  if (!getDatabase()) return NextResponse.json({ ok: true, storage: "unavailable" });
  if (body.prompt?.trim() && body.answer?.trim()) await upsertConversationTurn(projectId, { agent, conversationId: (body.conversation_id || "mcp").slice(0, 120), turnKey: `${agent}-${Date.now()}`, prompt: body.prompt.trim().slice(0, 12_000), answer: body.answer.trim().slice(0, 30_000) });
  const event = await recordActivity(projectId, { agent, eventType: body.status === "completed" || body.status === "handoff" ? "task_completed" : "agent_update", summary: (summary || `Saved ${agent} conversation update`).slice(0, 900), filePaths: (body.files || []).filter((file): file is string => typeof file === "string").slice(0, 30), metadata: { source: "mcp", status: body.status || "in_progress", handoff: body.status === "handoff" } });
  return NextResponse.json({ ok: true, event });
}

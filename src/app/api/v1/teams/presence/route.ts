import { NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { clearIntent, listIntents, publishIntent } from "@/lib/live";

async function currentUser(request: Request) { return getUserFromToken(request.headers.get("cookie")?.match(/onecontext_session=([^;]+)/)?.[1]); }

export async function GET(request: Request) {
  const user = await currentUser(request); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("project_id") || "atlas-project";
  const localIntents = listIntents(projectId);
  let remoteIntents: typeof localIntents = [];
  try { const realtimeUrl = process.env.ONECONTEXT_REALTIME_HTTP_URL || "http://localhost:8787"; const response = await fetch(`${realtimeUrl}/presence?project_id=${encodeURIComponent(projectId)}`, { cache: "no-store" }); if (response.ok) remoteIntents = (await response.json()).active_intents || []; } catch { /* realtime service is optional */ }
  const merged = new Map([...localIntents, ...remoteIntents].map((intent) => [`${intent.userId}:${intent.projectId}`, intent]));
  return NextResponse.json({ active_intents: Array.from(merged.values()), connected_user_id: user.id, transport: remoteIntents.length ? "websocket-backed-polling" : "polling" });
}

export async function POST(request: Request) {
  const user = await currentUser(request); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  const body = await request.json() as { project_id?: string; file_path?: string; summary?: string };
  if (!body.file_path?.trim() || !body.summary?.trim()) return NextResponse.json({ error: { code: "INTENT_REQUIRED", message: "A file path and task summary are required." } }, { status: 400 });
  const result = await publishIntent({ projectId: body.project_id || "atlas-project", userId: user.id, userName: user.name, filePath: body.file_path, summary: body.summary });
  return NextResponse.json({ intent: result.intent, active_intents: listIntents(result.intent.projectId), conflicts: result.conflicts, transport: "polling" });
}

export async function DELETE(request: Request) {
  const user = await currentUser(request); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("project_id") || "atlas-project";
  clearIntent(projectId, user.id);
  return NextResponse.json({ ok: true });
}

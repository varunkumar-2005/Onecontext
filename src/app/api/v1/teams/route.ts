import { NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { ensureTeamSession } from "@/lib/live";

async function currentUser(request: Request) { return getUserFromToken(request.headers.get("cookie")?.match(/onecontext_session=([^;]+)/)?.[1]); }

export async function GET(request: Request) {
  if (!await currentUser(request)) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("project_id") || "atlas-project";
  const team = await ensureTeamSession(projectId);
  return NextResponse.json({ team, websocket_url: process.env.ONECONTEXT_REALTIME_URL || "ws://localhost:8787/live" });
}

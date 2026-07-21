import { NextResponse } from "next/server";
import { joinTeam } from "@/lib/live";

export async function POST(request: Request) {
  const body = await request.json() as { team_code?: string };
  const team = body.team_code?.trim() ? await joinTeam(body.team_code.trim()) : undefined;
  if (!team) return NextResponse.json({ error: { code: "TEAM_NOT_FOUND", message: "That Team Code is not active." } }, { status: 404 });
  return NextResponse.json({ project_id: team.projectId, team_code: team.teamCode, websocket_url: process.env.ONECONTEXT_REALTIME_URL || "ws://localhost:8787/live" });
}

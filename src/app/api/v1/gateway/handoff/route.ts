import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { recordActivity } from "@/lib/persistent-store";

export async function POST(request: NextRequest) {
  const configuredGatewayKey = process.env.ONECONTEXT_GATEWAY_KEY;
  if (configuredGatewayKey && request.headers.get("x-onecontext-key") !== configuredGatewayKey) return NextResponse.json({ error: { code: "INVALID_GATEWAY_KEY", message: "A valid gateway key is required." } }, { status: 401 });
  const body = await request.json() as { project_id?: string; provider?: string; prompt?: string; answer?: string };
  const prompt = body.prompt?.trim() || ""; const answer = body.answer?.trim() || "";
  if (!prompt || !answer) return NextResponse.json({ error: { code: "HANDOFF_REQUIRED", message: "A prompt and assistant answer are required to save a handoff." } }, { status: 400 });
  if (prompt.length > 12_000 || answer.length > 30_000) return NextResponse.json({ error: { code: "HANDOFF_TOO_LARGE", message: "This handoff is too large. Save a shorter conversation segment." } }, { status: 413 });
  const provider = (body.provider || "assistant").slice(0, 40);
  if (getDatabase()) await recordActivity(body.project_id || "atlas-project", { agent: provider, eventType: "conversation_handoff", prompt, answer, summary: `Saved ${provider} handoff: ${prompt.slice(0, 160)}`, metadata: { handoff: true } });
  return NextResponse.json({ ok: true });
}

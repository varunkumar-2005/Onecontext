import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { upsertConversationTurn } from "@/lib/persistent-store";

type Turn = { turn_key?: string; prompt?: string; answer?: string };

export async function POST(request: NextRequest) {
  const configuredGatewayKey = process.env.ONECONTEXT_GATEWAY_KEY;
  if (configuredGatewayKey && request.headers.get("x-onecontext-key") !== configuredGatewayKey) return NextResponse.json({ error: { code: "INVALID_GATEWAY_KEY", message: "A valid gateway key is required." } }, { status: 401 });
  const body = await request.json() as { project_id?: string; provider?: string; conversation_id?: string; turns?: Turn[] };
  const turns = (body.turns || []).filter((turn) => turn.turn_key && turn.prompt?.trim() && turn.answer?.trim()).slice(0, 20);
  if (!turns.length) return NextResponse.json({ error: { code: "TURNS_REQUIRED", message: "At least one completed conversation turn is required." } }, { status: 400 });
  const provider = (body.provider || "assistant").slice(0, 40); const conversationId = (body.conversation_id || "conversation").slice(0, 120);
  if (!getDatabase()) return NextResponse.json({ ok: true, saved: 0, storage: "unavailable" });
  const saved = await Promise.all(turns.map(async (turn) => {
    const prompt = turn.prompt!.trim().slice(0, 12_000); const answer = turn.answer!.trim().slice(0, 30_000);
    return upsertConversationTurn(body.project_id || "atlas-project", { agent: provider, conversationId, turnKey: turn.turn_key!.slice(0, 180), prompt, answer });
  }));
  return NextResponse.json({ ok: true, saved: saved.length });
}

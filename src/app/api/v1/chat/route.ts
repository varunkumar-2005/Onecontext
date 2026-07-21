import { NextResponse } from "next/server";
import { estimateTokens } from "@/lib/chunking";
import { hybridRetrieve } from "@/lib/hybrid";
import { getDatabase } from "@/lib/db";
import { recordActivity } from "@/lib/persistent-store";
import { answerNonProjectMemoryChatWithAI, answerProjectQuestionWithAI } from "@/lib/ai-decisions";

export async function POST(request: Request) {
  const body = await request.json() as { project_id?: string; message?: string; token_budget?: number };
  const message = body.message?.trim() ?? "";
  if (!message) return NextResponse.json({ error: { code: "MESSAGE_REQUIRED", message: "Ask a question about the project." } }, { status: 400 });
  const result = await hybridRetrieve(body.project_id ?? "atlas-project", message, Math.min(Math.max(body.token_budget ?? 1200, 200), 3000));
  if (!result.routing.shouldInject) {
    const answer = await answerNonProjectMemoryChatWithAI(message) || "Hi! I can help with the shared project memory. Ask me about a source file, decision, task, architecture, or team work.";
    return NextResponse.json({ answer, citations: [], context_token_count: 0, memory_items_used: 0, project_context_added: false });
  }
  const citations = result.selected.map((item) => ({ id: item.id, name: item.source, heading: item.heading, score: Number(item.score.toFixed(3)) }));
  const fallbackAnswer = result.selected.length
    ? `Based on the most relevant source, ${result.selected.map((item) => item.content).join(" ").replace(/\n+/g, " ")}`
    : "I couldn’t find a matching memory item yet. Try adding a design document, repository note, or more specific project terms.";
  const answer = await answerProjectQuestionWithAI(message, result.context) || fallbackAnswer;
  if (getDatabase()) await recordActivity(body.project_id ?? "atlas-project", { agent: "onecontext-chat", eventType: "prompt_answer", prompt: message, answer, summary: `Asked: ${message.slice(0, 180)}` });
  return NextResponse.json({ answer, citations, context_token_count: estimateTokens(result.context), memory_items_used: result.selected.length, project_context_added: true });
}

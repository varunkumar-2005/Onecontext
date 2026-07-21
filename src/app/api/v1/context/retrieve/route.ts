import { NextResponse } from "next/server";
import { estimateTokens } from "@/lib/chunking";
import { hybridRetrieve } from "@/lib/hybrid";

export async function POST(request: Request) {
  const body = await request.json() as { project_id?: string; query?: string; token_budget?: number; provider?: string };
  const query = body.query?.trim() ?? "";
  if (!query) return NextResponse.json({ error: { code: "QUERY_REQUIRED", message: "A query is required." } }, { status: 400 });
  const tokenBudget = Math.min(Math.max(body.token_budget ?? 1500, 200), 4000);
  const result = await hybridRetrieve(body.project_id ?? "atlas-project", query, tokenBudget);
  return NextResponse.json({ context: result.context || "No matching project memory was found.", sources_used: result.selected.map((item) => item.id), token_count: estimateTokens(result.context), provider: body.provider ?? "generic", routing: result.routing, results: result.selected.map((item) => ({ id: item.id, source: item.source, heading: item.heading, score: Number(item.score.toFixed(3)), semantic_score: Number(item.semanticScore.toFixed(3)), keyword_score: Number(item.keywordScore.toFixed(3)) })) });
}

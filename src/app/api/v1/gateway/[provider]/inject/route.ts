import { NextResponse } from "next/server";
import { hybridRetrieve } from "@/lib/hybrid";
import { getDatabase } from "@/lib/db";
import { recordActivity } from "@/lib/persistent-store";

const providerBudgets: Record<string, number> = { chatgpt: 1800, claude: 2200, gemini: 1800, codex: 2400, cursor: 1600, windsurf: 1600 };

export async function POST(request: Request, { params }: { params: { provider: string } }) {
  const configuredGatewayKey = process.env.ONECONTEXT_GATEWAY_KEY;
  if (configuredGatewayKey && request.headers.get("x-onecontext-key") !== configuredGatewayKey) return NextResponse.json({ error: { code: "INVALID_GATEWAY_KEY", message: "A valid gateway key is required." } }, { status: 401 });
  const body = await request.json() as { project_id?: string; raw_prompt?: string; token_budget?: number };
  const rawPrompt = body.raw_prompt?.trim() ?? "";
  if (!rawPrompt) return NextResponse.json({ error: { code: "PROMPT_REQUIRED", message: "A raw prompt is required." } }, { status: 400 });
  const provider = params.provider.toLowerCase();
  const result = await hybridRetrieve(body.project_id ?? "atlas-project", rawPrompt, body.token_budget ?? providerBudgets[provider] ?? 1500);
  if (!result.routing.shouldInject) return NextResponse.json({ provider, augmented_prompt: rawPrompt, context: "", sources_used: [], token_count: 0, routing: result.routing });
  const context = result.context || "No relevant project memory was found.";
  const augmentedPrompt = `[PROJECT CONTEXT — OneContext]\nProject: Atlas project\nRelevant context:\n${context}\nSources: ${result.selected.map((item) => `${item.source} (${item.heading})`).join(", ")}\n[END CONTEXT]\n\n${rawPrompt}`;
  if (getDatabase()) await recordActivity(body.project_id ?? "atlas-project", { agent: provider, eventType: "prompt_shared", prompt: rawPrompt, summary: `Shared ${provider} prompt: ${rawPrompt.slice(0, 180)}` });
  return NextResponse.json({ provider, augmented_prompt: augmentedPrompt, context: context, sources_used: result.selected.map((item) => item.id), token_count: result.selected.reduce((sum, item) => sum + item.tokenCount, 0), routing: result.routing });
}

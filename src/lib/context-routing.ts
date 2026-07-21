export type ContextRoute = { shouldInject: boolean; reason: "short_prompt" | "casual_prompt" | "matched_project_terms" | "project_intent" | "no_project_signal"; terms: string[] };

const casualPrompts = /^(hi|hello|hey)([,!\.\s]+(how are you|what'?s up))?[!.?\s]*$|^(h|thanks|thank you|ok|okay|yes|no|good morning|good night)[!.?\s]*$/i;
const projectSignals = new Set(["project", "team", "code", "repo", "repository", "file", "files", "feature", "bug", "debug", "implement", "implementation", "refactor", "architecture", "database", "api", "auth", "authentication", "sprint", "commit", "branch", "deploy", "deployment", "test", "testing", "context", "memory", "working", "continue", "handoff", "previous", "conversation"]);

export function contextTerms(value: string) { return value.toLowerCase().split(/[^a-z0-9_./-]+/).map((term) => term.replace(/^[-./]+|[-./]+$/g, "")).filter((term) => term.length > 2 && !["the", "and", "for", "with", "this", "that", "what", "should", "would", "about", "from", "into", "have", "will", "are", "our"].includes(term)); }

export function routeProjectContext(query: string, searchableProjectText: string): ContextRoute {
  const normalized = query.trim(); const terms = contextTerms(normalized);
  if (normalized.length < 4 || terms.length === 0) return { shouldInject: false, reason: "short_prompt", terms };
  if (casualPrompts.test(normalized)) return { shouldInject: false, reason: "casual_prompt", terms };
  const projectText = searchableProjectText.toLowerCase();
  if (terms.some((term) => projectText.includes(term))) return { shouldInject: true, reason: "matched_project_terms", terms };
  if (terms.some((term) => projectSignals.has(term)) || /[\\/][\w.-]+\.(ts|tsx|js|jsx|py|md|json|sql)\b/i.test(normalized)) return { shouldInject: true, reason: "project_intent", terms };
  return { shouldInject: false, reason: "no_project_signal", terms };
}

/** Uses OpenAI only when explicitly enabled; the deterministic router remains the safe fallback. */
export async function routeProjectContextIntelligently(query: string, searchableProjectText: string): Promise<ContextRoute> {
  const fallback = routeProjectContext(query, searchableProjectText);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || process.env.ONECONTEXT_USE_AI_ROUTING !== "true") return fallback;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);
    const projectSummary = searchableProjectText.replace(/\s+/g, " ").slice(0, 6_000);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.ONECONTEXT_AI_MODEL || process.env.ONECONTEXT_CONTEXT_ROUTER_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You classify whether a user's prompt needs shared software-project context. Return JSON only: {\\\"shouldInject\\\": boolean}. Return true if the user is asking about, changing, planning, debugging, reviewing, or coordinating the project described. Return false for casual conversation, general knowledge, or unrelated personal questions." },
          { role: "user", content: `Project memory:\n${projectSummary || "No imported sources yet."}\n\nUser prompt:\n${query}` },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) return fallback;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const decision = JSON.parse(content) as { shouldInject?: unknown };
    if (typeof decision.shouldInject !== "boolean") return fallback;
    return { ...fallback, shouldInject: decision.shouldInject, reason: decision.shouldInject ? "project_intent" : "no_project_signal" };
  } catch {
    return fallback;
  }
}

export function matchesContextTerms(value: string, terms: string[]) { const text = value.toLowerCase(); return terms.some((term) => text.includes(term)); }

type ChatChoice = { choices?: Array<{ message?: { content?: string } }> };

function featureEnabled(feature: "retrieval" | "answers" | "conversation_memory") {
  return Boolean(process.env.OPENAI_API_KEY) && process.env[`ONECONTEXT_USE_AI_${feature.toUpperCase()}`] === "true";
}

async function complete(messages: Array<{ role: "system" | "user"; content: string }>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.ONECONTEXT_AI_MODEL || "gpt-4o-mini", temperature: 0, messages }),
    });
    if (!response.ok) return undefined;
    return ((await response.json()) as ChatChoice).choices?.[0]?.message?.content?.trim();
  } catch { return undefined; } finally { clearTimeout(timer); }
}

export async function rerankMemoryWithAI(query: string, candidates: Array<{ id: string; heading: string; content: string }>) {
  if (!featureEnabled("retrieval") || candidates.length < 2) return undefined;
  const catalogue = candidates.map((candidate) => ({ id: candidate.id, heading: candidate.heading, content: candidate.content.slice(0, 700) }));
  const content = await complete([
    { role: "system", content: "Choose the memory items that directly help answer the project question. Return only JSON: {\\\"ids\\\":[\\\"id\\\"]}. Keep source order by relevance. Do not invent IDs." },
    { role: "user", content: JSON.stringify({ question: query, candidates: catalogue }) },
  ]);
  if (!content) return undefined;
  try {
    const ids = JSON.parse(content).ids;
    if (!Array.isArray(ids)) return undefined;
    const allowed = new Set(candidates.map((candidate) => candidate.id));
    return ids.filter((id): id is string => typeof id === "string" && allowed.has(id));
  } catch { return undefined; }
}

export async function answerProjectQuestionWithAI(question: string, context: string) {
  if (!featureEnabled("answers") || !context) return undefined;
  return complete([
    { role: "system", content: "Answer the project question using only the supplied OneContext memory. Be concise and say when the memory does not establish an answer. Do not claim actions you did not perform." },
    { role: "user", content: `Question:\n${question}\n\nOneContext memory:\n${context}` },
  ]);
}

export async function answerNonProjectMemoryChatWithAI(question: string) {
  if (!featureEnabled("answers")) return undefined;
  return complete([
    { role: "system", content: "You are OneContext, a shared memory assistant for a software project. Reply naturally and briefly to the user, but do not use, mention, reveal, or infer any project memory because their message is unrelated to the project. Invite them to ask a project question if appropriate." },
    { role: "user", content: question },
  ]);
}

export type MemoryItemType = "decision" | "task" | "constraint" | "file_reference" | "conversation_summary";
export type StructuredMemoryItem = { type: MemoryItemType; title: string; summary: string; importance: number; metadata?: Record<string, unknown> };
export type ConversationMemory = { summary: string; decisions: string[]; tasks: string[]; constraints: string[]; files: string[]; shouldRemember: boolean; items: StructuredMemoryItem[] };

export async function distillConversationTurn(prompt: string, answer: string): Promise<ConversationMemory | undefined> {
  if (!featureEnabled("conversation_memory")) return undefined;
  const content = await complete([
    { role: "system", content: "Distill this project conversation turn into durable shared memory. Return JSON only with exactly: summary (string, max 90 words), decisions (string[]), tasks (string[]), constraints (string[]), files (string[]), shouldRemember (boolean), items (array of {type,title,summary,importance,metadata}). Item type must be decision, task, constraint, file_reference, or conversation_summary. Keep only concrete project knowledge. Do not include greetings, speculation, or instructions to the next model." },
    { role: "user", content: `User prompt:\n${prompt}\n\nAssistant answer:\n${answer}` },
  ]);
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")) as Partial<ConversationMemory>;
    if (typeof parsed.summary !== "string" || typeof parsed.shouldRemember !== "boolean") return undefined;
    const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
    const itemTypes = new Set<MemoryItemType>(["decision", "task", "constraint", "file_reference", "conversation_summary"]);
    const items = Array.isArray(parsed.items) ? parsed.items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as Partial<StructuredMemoryItem>;
      if (!itemTypes.has(value.type as MemoryItemType) || typeof value.title !== "string" || typeof value.summary !== "string") return [];
      return [{ type: value.type as MemoryItemType, title: value.title.slice(0, 180), summary: value.summary.slice(0, 900), importance: Math.max(1, Math.min(5, Number(value.importance) || 3)), metadata: value.metadata && typeof value.metadata === "object" ? value.metadata : {} }];
    }).slice(0, 10) : [];
    return { summary: parsed.summary.slice(0, 900), decisions: strings(parsed.decisions), tasks: strings(parsed.tasks), constraints: strings(parsed.constraints), files: strings(parsed.files), shouldRemember: parsed.shouldRemember, items };
  } catch { return undefined; }
}

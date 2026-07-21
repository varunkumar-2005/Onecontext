import { chunkMarkdown, estimateTokens, trimToTokenBudget } from "@/lib/chunking";
import { embedText, cosineSimilarity } from "@/lib/embeddings";
import { listChunks } from "@/lib/store";
import { buildStructuredContext, getProjectBrief, listActivity, listDatabaseChunks } from "@/lib/persistent-store";
import { getDatabase } from "@/lib/db";
import { teamActivityContext } from "@/lib/live";
import { matchesContextTerms, routeProjectContextIntelligently } from "@/lib/context-routing";
import { rerankMemoryWithAI } from "@/lib/ai-decisions";

export type RankedMemory = { id: string; source: string; heading: string; content: string; tokenCount: number; score: number; semanticScore: number; keywordScore: number };

export async function hybridRetrieve(projectId: string, query: string, tokenBudget: number) {
  const terms = query.toLowerCase().split(/[^a-z0-9_]+/).filter((term) => term.length > 2);
  const hasProviderEmbeddings = process.env.OPENAI_API_KEY && process.env.ONECONTEXT_USE_OPENAI_EMBEDDINGS === "true";
  const queryVector = await embedText(query);
  const memoryChunks = getDatabase() ? await listDatabaseChunks(projectId) : listChunks(projectId);
  const searchableProjectText = memoryChunks.map((chunk) => `${chunk.sourceName} ${chunk.heading} ${chunk.content}`).join(" ");
  const routing = await routeProjectContextIntelligently(query, searchableProjectText);
  if (!routing.shouldInject) return { selected: [], context: "", routing };
  const candidates = memoryChunks.flatMap((chunk) => chunkMarkdown(chunk.content).map((part) => {
    const searchable = `${part.heading} ${part.content}`;
    const words = searchable.toLowerCase();
    const keywordScore = terms.filter((term) => words.includes(term)).length / Math.max(terms.length, 1);
    const semanticScore = cosineSimilarity(queryVector, localOrStoredEmbedding(searchable));
    return { id: `${chunk.id}-${part.index}`, source: chunk.sourceName, heading: part.heading, content: part.content, tokenCount: estimateTokens(part.content), keywordScore, semanticScore, score: keywordScore * 0.55 + semanticScore * 0.45 };
  })).sort((left, right) => right.score - left.score).filter((candidate) => candidate.keywordScore > 0 || (hasProviderEmbeddings && candidate.semanticScore > 0.25)).slice(0, 12);
  const aiRankedIds = await rerankMemoryWithAI(query, candidates);
  const rankedCandidates = aiRankedIds?.length
    ? aiRankedIds.map((id) => candidates.find((candidate) => candidate.id === id)).filter((candidate): candidate is RankedMemory => Boolean(candidate))
    : candidates;
  let remaining = tokenBudget;
  const selected = rankedCandidates.filter((candidate) => {
    if (candidate.tokenCount > remaining && remaining < tokenBudget) return false;
    remaining -= candidate.tokenCount;
    return true;
  });
  const memoryContext = selected.map((candidate) => `### ${candidate.source} — ${candidate.heading}\n${trimToTokenBudget(candidate.content, candidate.tokenCount)}`).join("\n\n");
  const liveContext = teamActivityContext(projectId, query);
  const sharedContext: string[] = [];
  if (getDatabase()) {
    const brief = await getProjectBrief(projectId); if (brief.projectGoal || brief.currentSprint) sharedContext.push(`### Shared project direction\nGoal: ${brief.projectGoal || "Not specified"}\nCurrent sprint: ${brief.currentSprint || "Not specified"}`);
    const structuredMemory = await buildStructuredContext(projectId, query);
    if (structuredMemory.length) sharedContext.push(`### Structured project memory\n${structuredMemory.map((item) => `- [${item.type}] ${item.title}: ${item.summary}`).join("\n")}`);
    const activity = (await listActivity(projectId, 20)).filter((event) => event.eventType !== "prompt_shared" || (event.prompt || "").trim().length >= 4);
    const continuationTerms = ["continue", "handoff", "previous", "conversation"];
    const asksToContinue = routing.terms.some((term) => continuationTerms.includes(term));
    const asksAboutTeam = /\b(current\s+sprint|team\s+(?:is\s+)?working|team\s+status|what\s+is\s+the\s+team|who\s+is\s+working|recent\s+team\s+activity)\b/i.test(query);
    // Raw prompts and answers are not reliable project facts. They are only used for an explicit handoff,
    // never as background for an unrelated source question.
    const nonConversationActivity = activity.filter((event) => !["conversation_handoff", "conversation_turn", "prompt_shared", "prompt_answer"].includes(event.eventType));
    const autoSyncedConversationActivity = activity.filter((event) => event.eventType === "conversation_turn" && !(event.prompt || "").includes("[PROJECT CONTEXT"));
    const activityPool = asksToContinue ? autoSyncedConversationActivity : nonConversationActivity;
    const relevantActivity = asksToContinue ? activityPool.slice(0, 3) : asksAboutTeam ? activityPool.slice(0, 6) : activityPool.filter((event) => matchesContextTerms(`${event.summary} ${event.prompt || ""} ${(event.filePaths || []).join(" ")}`, routing.terms)).slice(0, 6);
    if (relevantActivity.length) {
      const heading = asksToContinue ? "### Conversation to continue" : "### Recent team activity";
      sharedContext.push(`${heading}\n${relevantActivity.map((event) => event.eventType === "conversation_turn" ? formatConversationMemory(event) : `- ${event.agent}: ${event.summary}`).join("\n")}`);
    }
  }
  return { selected, context: [...sharedContext, memoryContext, liveContext].filter(Boolean).join("\n\n"), routing };
}

function localOrStoredEmbedding(text: string) {
  // Imported lazily in the production vector store; local fallback keeps this slice synchronous per candidate.
  const vector = Array.from({ length: 96 }, () => 0);
  for (const term of text.toLowerCase().split(/[^a-z0-9_]+/).filter((item) => item.length > 1)) {
    let hash = 2166136261;
    for (let index = 0; index < term.length; index += 1) hash = Math.imul(hash ^ term.charCodeAt(index), 16777619);
    vector[Math.abs(hash) % 96] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function formatConversationMemory(event: { agent: string; prompt?: string; answer?: string; metadata?: Record<string, unknown> }) {
  const memory = event.metadata?.memory as Partial<import("@/lib/ai-decisions").ConversationMemory> | undefined;
  if (memory?.shouldRemember && typeof memory.summary === "string") {
    const fields = [["Decisions", memory.decisions], ["Tasks", memory.tasks], ["Constraints", memory.constraints], ["Files", memory.files]]
      .filter(([, values]) => Array.isArray(values) && values.length)
      .map(([label, values]) => `  ${label}: ${(values as string[]).join("; ")}`);
    return `- ${event.agent} memory: ${memory.summary}${fields.length ? `\n${fields.join("\n")}` : ""}`;
  }
  return `- ${event.agent} turn\n  User: ${(event.prompt || "").slice(0, 450)}\n  Assistant: ${(event.answer || "").slice(0, 900)}`;
}

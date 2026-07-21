const DIMENSIONS = 96;

/**
 * Uses OpenAI embeddings when configured. The local fallback is deterministic,
 * so retrieval remains useful during local development and tests without a key.
 */
export async function embedText(text: string): Promise<number[]> {
  if (process.env.OPENAI_API_KEY && process.env.ONECONTEXT_USE_OPENAI_EMBEDDINGS === "true") {
    const response = await fetch("https://api.openai.com/v1/embeddings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small", input: text }) });
    if (response.ok) {
      const data = await response.json() as { data?: Array<{ embedding: number[] }> };
      if (data.data?.[0]?.embedding) return data.data[0].embedding;
    }
  }
  return localEmbedding(text);
}

export function localEmbedding(text: string) {
  const vector = Array.from({ length: DIMENSIONS }, () => 0);
  const terms = text.toLowerCase().split(/[^a-z0-9_]+/).filter((term) => term.length > 1);
  for (const term of terms) {
    let hash = 2166136261;
    for (let index = 0; index < term.length; index += 1) hash = Math.imul(hash ^ term.charCodeAt(index), 16777619);
    const slot = Math.abs(hash) % DIMENSIONS;
    vector[slot] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) score += left[index] * right[index];
  return score;
}

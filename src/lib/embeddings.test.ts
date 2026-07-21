import assert from "node:assert/strict";
import test from "node:test";
import { cosineSimilarity, localEmbedding } from "./embeddings";

test("local embeddings are deterministic and normalized", () => {
  const first = localEmbedding("authentication service");
  const second = localEmbedding("authentication service");
  assert.deepEqual(first, second);
  assert.ok(Math.abs(cosineSimilarity(first, first) - 1) < 0.0001);
});

test("similar text is more similar than unrelated text", () => {
  const query = localEmbedding("Postgres database architecture");
  const related = cosineSimilarity(query, localEmbedding("Postgres data storage architecture"));
  const unrelated = cosineSimilarity(query, localEmbedding("meeting agenda and sprint planning"));
  assert.ok(related > unrelated);
});

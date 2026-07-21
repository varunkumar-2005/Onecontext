import assert from "node:assert/strict";
import test from "node:test";
import { chunkMarkdown, estimateTokens, trimToTokenBudget } from "./chunking";

test("chunkMarkdown preserves Markdown headings", () => {
  const chunks = chunkMarkdown("# Architecture\n\nAtlas uses Next.js.\n\n## Storage\n\nAtlas uses Postgres.");
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].heading, "Architecture");
  assert.equal(chunks[1].heading, "Storage");
});

test("chunkMarkdown splits large sections into bounded chunks", () => {
  const chunks = chunkMarkdown(`# Notes\n\n${Array.from({ length: 250 }, (_, index) => `word${index}`).join(" ")}`);
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((chunk) => chunk.content.split(" ").length <= 110));
});

test("trimToTokenBudget limits context without returning an empty string", () => {
  const trimmed = trimToTokenBudget("one two three four five six seven eight nine ten", 4);
  assert.ok(trimmed.length > 0);
  assert.ok(estimateTokens(trimmed) <= 5);
});

export type TextChunk = {
  index: number;
  heading: string;
  content: string;
  tokenCount: number;
};

const MAX_WORDS = 110;

/** Split Markdown on headings first, then keep each section within a small retrieval window. */
export function chunkMarkdown(markdown: string): TextChunk[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ heading: string; lines: string[] }> = [];
  let current = { heading: "Introduction", lines: [] as string[] };

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading && current.lines.join(" ").trim()) {
      sections.push(current);
      current = { heading: heading[1].trim(), lines: [] };
    } else if (heading) {
      current.heading = heading[1].trim();
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.join(" ").trim()) sections.push(current);

  const chunks: TextChunk[] = [];
  for (const section of sections) {
    const words = section.lines.join(" ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    for (let start = 0; start < words.length; start += MAX_WORDS) {
      const content = words.slice(start, start + MAX_WORDS).join(" ");
      chunks.push({ index: chunks.length, heading: section.heading, content, tokenCount: estimateTokens(content) });
    }
  }
  return chunks.length ? chunks : [{ index: 0, heading: "Document", content: markdown.trim(), tokenCount: estimateTokens(markdown) }];
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3));
}

export function trimToTokenBudget(text: string, tokenBudget: number) {
  const maxWords = Math.max(1, Math.floor(tokenBudget / 1.3));
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text : `${words.slice(0, maxWords).join(" ")}…`;
}

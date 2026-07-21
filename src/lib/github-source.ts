type GitHubFile = { path: string; type: string };

const ALLOWED_FILE = /(^|\/)(readme|contributing|architecture|design|adr|decision|roadmap|plan|todo|changelog)[^/]*\.(md|mdx|txt)$/i;

export function parsePublicGitHubUrl(value: string) {
  const match = value.trim().match(/^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/#?\s]+)\/?(?:[?#].*)?$/i);
  if (!match) throw new Error("Enter a GitHub repository URL such as https://github.com/owner/repository.");
  return { owner: match[1], repository: match[2].replace(/\.git$/i, "") };
}

async function githubFetch(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "OneContext" }, next: { revalidate: 0 } });
  if (!response.ok) throw new Error(response.status === 404 ? "Repository not found. It must be public for this MVP." : "GitHub could not read this repository right now.");
  return response;
}

export async function importPublicGitHubRepository(repositoryUrl: string) {
  const { owner, repository } = parsePublicGitHubUrl(repositoryUrl);
  const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  const repo = await (await githubFetch(apiBase)).json() as { default_branch: string; full_name: string; html_url: string };
  const tree = await (await githubFetch(`${apiBase}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`)).json() as { tree?: GitHubFile[] };
  const files = (tree.tree || []).filter((file) => file.type === "blob" && ALLOWED_FILE.test(file.path)).slice(0, 12);
  if (!files.length) throw new Error("No supported documentation was found. Add a README.md, docs Markdown file, or text planning file first.");
  const documents = await Promise.all(files.map(async (file) => {
    const data = await (await githubFetch(`${apiBase}/contents/${file.path}?ref=${encodeURIComponent(repo.default_branch)}`)).json() as { content?: string; encoding?: string };
    if (!data.content || data.encoding !== "base64") return "";
    return `# ${file.path}\n\n${Buffer.from(data.content, "base64").toString("utf8")}`;
  }));
  const content = documents.filter(Boolean).join("\n\n---\n\n");
  if (!content.trim()) throw new Error("OneContext could not read documentation from that repository.");
  return { name: repo.full_name, originUrl: repo.html_url, content, fileCount: documents.filter(Boolean).length };
}

export type SourceStatus = "pending" | "parsing" | "indexed" | "failed";

export type ProjectSource = {
  id: string;
  projectId: string;
  name: string;
  type: "markdown" | "notes" | "github";
  status: SourceStatus;
  content: string;
  chunkCount: number;
  createdAt: string;
  lastIndexedAt: string | null;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  sources: ProjectSource[];
};

export type MemoryChunk = {
  id: string;
  projectId: string;
  sourceId: string;
  sourceName: string;
  heading: string;
  content: string;
  tokenCount: number;
  isCurrent: boolean;
};
export type Decision = { id: string; projectId: string; title: string; rationale: string; sourceChunkId?: string; createdAt: string };
export type GraphNode = { id: string; type: "File" | "Decision" | "Concept" | "Person" | "Task"; label: string };
export type GraphEdge = { from: string; to: string; type: "AFFECTS" | "DEPENDS_ON" | "IMPLEMENTS" | "REFERENCES" | "AUTHORED" };

const atlasId = "atlas-project";
const projects: Project[] = [{
  id: atlasId,
  name: "Atlas project",
  description: "The shared memory layer for the Atlas engineering project.",
  createdAt: new Date("2026-07-01T09:00:00.000Z").toISOString(),
  sources: [
    { id: "source-architecture", projectId: atlasId, name: "ARCHITECTURE.md", type: "markdown", status: "indexed", content: "# Atlas architecture\n\nAtlas uses a Next.js web application with a Postgres data layer.\n", chunkCount: 24, createdAt: new Date("2026-07-15T08:00:00.000Z").toISOString(), lastIndexedAt: new Date("2026-07-17T08:00:00.000Z").toISOString() },
    { id: "source-github", projectId: atlasId, name: "github.com/acme/atlas", type: "github", status: "parsing", content: "Repository sync placeholder", chunkCount: 0, createdAt: new Date("2026-07-17T07:45:00.000Z").toISOString(), lastIndexedAt: null },
    { id: "source-notes", projectId: atlasId, name: "Sprint planning notes", type: "notes", status: "indexed", content: "# Sprint planning\n\nThe team will keep retrieval provider-agnostic.\n", chunkCount: 8, createdAt: new Date("2026-07-17T06:30:00.000Z").toISOString(), lastIndexedAt: new Date("2026-07-17T06:40:00.000Z").toISOString() },
  ],
}];
const decisions: Decision[] = [{ id: "decision-provider-agnostic", projectId: atlasId, title: "Keep retrieval provider-agnostic", rationale: "The core retrieval and storage layers should not need schema changes when a new AI assistant is added.", sourceChunkId: "source-notes-chunk-0", createdAt: new Date("2026-07-16T10:00:00.000Z").toISOString() }];
const graphNodes: GraphNode[] = [{ id: "file-architecture", type: "File", label: "ARCHITECTURE.md" }, { id: "file-sprint-notes", type: "File", label: "Sprint planning notes" }, { id: "decision-provider-agnostic", type: "Decision", label: "Keep retrieval provider-agnostic" }, { id: "concept-retrieval", type: "Concept", label: "Hybrid retrieval" }, { id: "concept-postgres", type: "Concept", label: "Postgres" }];
const graphEdges: GraphEdge[] = [{ from: "decision-provider-agnostic", to: "file-architecture", type: "AFFECTS" }, { from: "file-architecture", to: "concept-postgres", type: "IMPLEMENTS" }, { from: "file-sprint-notes", to: "concept-retrieval", type: "IMPLEMENTS" }];

export function listChunks(projectId: string) {
  const project = getProject(projectId);
  if (!project) return [] as MemoryChunk[];
  return project.sources.flatMap((source) => source.content.trim() ? [{
    id: `${source.id}-chunk-0`, projectId, sourceId: source.id, sourceName: source.name,
    heading: "Document", content: source.content, tokenCount: source.chunkCount * 90, isCurrent: source.status === "indexed",
  }] : []);
}

export function listProjects() { return projects; }
export function getProject(projectId: string) { return projects.find((project) => project.id === projectId); }
export function listDecisions(projectId: string) { return decisions.filter((decision) => decision.projectId === projectId); }
export function createDecision(projectId: string, title: string, rationale: string) { const decision = { id: `decision-${Date.now()}`, projectId, title, rationale, createdAt: new Date().toISOString() }; decisions.unshift(decision); graphNodes.push({ id: decision.id, type: "Decision", label: title }); return decision; }
export function getGraph(projectId: string) { return { nodes: graphNodes.map((node) => ({ ...node })), edges: graphEdges.map((edge) => ({ ...edge })), projectId }; }

export function addSource(projectId: string, input: { name: string; type: ProjectSource["type"]; content: string }) {
  const project = getProject(projectId);
  if (!project) return undefined;
  const now = new Date().toISOString();
  const source: ProjectSource = { id: `source-${Date.now()}`, projectId, name: input.name, type: input.type, status: "indexed", content: input.content, chunkCount: Math.max(1, Math.ceil(input.content.trim().split(/\s+/).filter(Boolean).length / 90)), createdAt: now, lastIndexedAt: now };
  project.sources.unshift(source);
  return source;
}

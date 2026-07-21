import { NextResponse } from "next/server";
import { addSource, getProject, ProjectSource } from "@/lib/store";
import { addDatabaseSource, listDatabaseSources } from "@/lib/persistent-store";
import { getDatabase } from "@/lib/db";
import { importPublicGitHubRepository } from "@/lib/github-source";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (getDatabase()) return NextResponse.json({ sources: await listDatabaseSources(params.id) });
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: { code: "PROJECT_NOT_FOUND", message: "Project was not found." } }, { status: 404 });
  return NextResponse.json({ sources: project.sources });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const form = await request.formData();
  const githubUrl = form.get("githubUrl");
  if (typeof githubUrl === "string" && githubUrl.trim()) {
    try {
      const repository = await importPublicGitHubRepository(githubUrl);
      if (getDatabase()) return NextResponse.json({ source: await addDatabaseSource(params.id, { name: repository.name, type: "github", content: repository.content, originUrl: repository.originUrl }), filesIndexed: repository.fileCount }, { status: 202 });
      if (!getProject(params.id)) return NextResponse.json({ error: { code: "PROJECT_NOT_FOUND", message: "Project was not found." } }, { status: 404 });
      return NextResponse.json({ source: addSource(params.id, { name: repository.name, type: "github", content: repository.content }), filesIndexed: repository.fileCount }, { status: 202 });
    } catch (error) { return NextResponse.json({ error: { code: "GITHUB_IMPORT_FAILED", message: error instanceof Error ? error.message : "Could not import this GitHub repository." } }, { status: 400 }); }
  }
  if (getDatabase()) {
    const file = form.get("file"); const note = form.get("note"); const name = form.get("name"); let content = ""; let sourceName = typeof name === "string" && name.trim() ? name.trim() : "Untitled note"; let type: "markdown" | "notes" = "notes";
    if (file instanceof File) { content = await file.text(); sourceName = file.name; type = "markdown"; } else if (typeof note === "string") content = note;
    if (!content.trim()) return NextResponse.json({ error: { code: "EMPTY_SOURCE", message: "Add a file or note before indexing." } }, { status: 400 });
    return NextResponse.json({ source: await addDatabaseSource(params.id, { name: sourceName, type, content }) }, { status: 202 });
  }
  if (!getProject(params.id)) return NextResponse.json({ error: { code: "PROJECT_NOT_FOUND", message: "Project was not found." } }, { status: 404 });
  const file = form.get("file");
  const note = form.get("note");
  const name = form.get("name");
  let content = "";
  let sourceName = typeof name === "string" && name.trim() ? name.trim() : "Untitled note";
  let type: ProjectSource["type"] = "notes";
  if (file instanceof File) { content = await file.text(); sourceName = file.name; type = "markdown"; }
  else if (typeof note === "string") content = note;
  if (!content.trim()) return NextResponse.json({ error: { code: "EMPTY_SOURCE", message: "Add a file or note before indexing." } }, { status: 400 });
  return NextResponse.json({ source: addSource(params.id, { name: sourceName, type, content }) }, { status: 202 });
}

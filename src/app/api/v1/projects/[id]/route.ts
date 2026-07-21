import { NextResponse } from "next/server";
import { getProject } from "@/lib/store";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: { code: "PROJECT_NOT_FOUND", message: "Project was not found." } }, { status: 404 });
  return NextResponse.json(project);
}

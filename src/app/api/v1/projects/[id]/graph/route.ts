import { NextResponse } from "next/server";
import { getGraph, getProject } from "@/lib/store";
export async function GET(_request: Request, { params }: { params: { id: string } }) { if (!getProject(params.id)) return NextResponse.json({ error: { code: "PROJECT_NOT_FOUND", message: "Project was not found." } }, { status: 404 }); return NextResponse.json(getGraph(params.id)); }

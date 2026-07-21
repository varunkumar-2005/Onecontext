import { NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { createDatabaseProject, listDatabaseProjects } from "@/lib/persistent-store";
import { listProjects } from "@/lib/store";

async function currentUser(request: Request) { return getUserFromToken(request.headers.get("cookie")?.match(/onecontext_session=([^;]+)/)?.[1]); }
export async function GET(request: Request) { const user = await currentUser(request); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 }); return NextResponse.json({ projects: getDatabase() ? await listDatabaseProjects(user.id) : listProjects().map(({ id, name, description, createdAt }) => ({ id, name, description, createdAt })) }); }
export async function POST(request: Request) { const user = await currentUser(request); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 }); const body = await request.json() as { name?: string; description?: string }; const name = body.name?.trim(); if (!name || name.length > 80) return NextResponse.json({ error: { code: "PROJECT_NAME_REQUIRED", message: "Enter a project name (up to 80 characters)." } }, { status: 400 }); if (!getDatabase()) return NextResponse.json({ error: { code: "DATABASE_REQUIRED", message: "Create-project is available when PostgreSQL is connected." } }, { status: 503 }); return NextResponse.json({ project: await createDatabaseProject(user.id, { name, description: body.description?.trim() }) }, { status: 201 }); }

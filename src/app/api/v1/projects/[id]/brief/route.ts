import { NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { getProjectBrief, updateProjectBrief } from "@/lib/persistent-store";
import { getDatabase } from "@/lib/db";

async function user(request: Request) { return getUserFromToken(request.headers.get("cookie")?.match(/onecontext_session=([^;]+)/)?.[1]); }
export async function GET(request: Request, { params }: { params: { id: string } }) { if (!await user(request)) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 }); return NextResponse.json({ brief: getDatabase() ? await getProjectBrief(params.id) : { projectGoal: "", currentSprint: "" } }); }
export async function PATCH(request: Request, { params }: { params: { id: string } }) { if (!await user(request)) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 }); const body = await request.json(); return NextResponse.json({ brief: getDatabase() ? await updateProjectBrief(params.id, body) : body }); }

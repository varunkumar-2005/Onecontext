import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
export async function POST(request: Request) { const token = request.headers.get("cookie")?.match(/onecontext_session=([^;]+)/)?.[1]; await deleteSession(token); const response = NextResponse.json({ ok: true }); response.cookies.set("onecontext_session", "", { expires: new Date(0), path: "/" }); return response; }

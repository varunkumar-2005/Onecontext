import { NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
export async function GET(request: Request) { const token = request.headers.get("cookie")?.match(/onecontext_session=([^;]+)/)?.[1]; const user = await getUserFromToken(token); return user ? NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }) : NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 }); }

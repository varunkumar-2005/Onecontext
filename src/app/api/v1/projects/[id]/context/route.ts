import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { buildStructuredContext, getProjectBrief } from "@/lib/persistent-store";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.headers.get("cookie")?.match(/onecontext_session=([^;]+)/)?.[1];
  if (!await getUserFromToken(token)) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  const query = request.nextUrl.searchParams.get("q") || "project context";
  const [brief, memory] = await Promise.all([getProjectBrief(params.id), buildStructuredContext(params.id, query)]);
  return NextResponse.json({ project_id: params.id, brief, memory, generated_at: new Date().toISOString() });
}

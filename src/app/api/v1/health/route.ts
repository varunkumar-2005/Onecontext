import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/db";

export async function GET() {
  try { return NextResponse.json({ ok: true, service: "onecontext", database: await checkDatabase() }); }
  catch { return NextResponse.json({ ok: false, service: "onecontext", database: { configured: true, connected: false } }, { status: 503 }); }
}

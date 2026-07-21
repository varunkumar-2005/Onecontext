import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { getDatabaseSettings, updateDatabaseSettings } from "@/lib/persistent-store";
export async function GET(_request: Request, { params }: { params: { id: string } }) { if (!getDatabase()) return NextResponse.json({ settings: { indexGithub: true, indexDocuments: true, indexNotes: true, indexChatExports: true } }); return NextResponse.json({ settings: await getDatabaseSettings(params.id) }); }
export async function PATCH(request: Request, { params }: { params: { id: string } }) { const body = await request.json(); if (!getDatabase()) return NextResponse.json({ settings: body }); return NextResponse.json({ settings: await updateDatabaseSettings(params.id, body) }); }

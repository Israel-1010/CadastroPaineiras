import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth"

export async function POST(request: Request) {
  return clearSessionCookie(request, NextResponse.json({ ok: true }), "colaborador")
}

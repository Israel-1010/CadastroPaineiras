import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { getAdmin, unauthorized } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const admin = await getAdmin()
    if (!admin) return unauthorized()

    const [colaboradores, dependentes] = await Promise.all([
      supabaseAdmin.from("colaboradores").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("dependentes").select("id", { count: "exact", head: true }),
    ])
    if (colaboradores.error || dependentes.error) {
      throw new Error(colaboradores.error?.message || dependentes.error?.message)
    }

    return NextResponse.json({
      admin,
      stats: {
        totalColaboradores: colaboradores.count ?? 0,
        totalDependentes: dependentes.count ?? 0,
      },
    })
  } catch (error) {
    console.error("[admin-session] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

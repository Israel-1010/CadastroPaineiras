import { NextResponse } from "next/server"
import { fetchAll, supabaseAdmin } from "@/lib/supabase/server"
import { getAdmin, unauthorized } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (!(await getAdmin())) return unauthorized()

    const dependentes = await fetchAll((from, to) =>
      supabaseAdmin
        .from("dependentes")
        .select("*, colaborador:colaboradores(nome_completo, re)")
        .order("nome_completo")
        .range(from, to),
    )

    return NextResponse.json({ dependentes })
  } catch (error) {
    console.error("[admin/dependentes] erro ao listar:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao buscar dependentes" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { getColaboradorId, unauthorized } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const { data: colaborador, error } = await supabaseAdmin
      .from("colaboradores")
      .select("id, re, cpf, nome_completo, email")
      .eq("id", colaboradorId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!colaborador) return unauthorized()

    const { data: dependentes, error: dependentesError } = await supabaseAdmin
      .from("dependentes")
      .select("id, nome_completo, cpf, genero, dependencia, data_nascimento, foto_url, colaborador_id")
      .eq("colaborador_id", colaborador.id)
      .order("nome_completo")

    if (dependentesError) throw new Error(dependentesError.message)

    return NextResponse.json({ colaborador, dependentes: dependentes ?? [] })
  } catch (error) {
    console.error("[session] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

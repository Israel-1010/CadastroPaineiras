import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { getColaboradorId, unauthorized } from "@/lib/auth"
import { colaboradorParaTela, dependenteParaTela } from "@/lib/mascara"
import { termoAceito } from "@/lib/aceite"
import { TERMO_VERSAO } from "@/lib/termo"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const { data: colaborador, error } = await supabaseAdmin
      .from("colaboradores")
      .select("id, re, cpf, nome_completo")
      .eq("id", colaboradorId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!colaborador) return unauthorized()

    const { data: dependentes, error: dependentesError } = await supabaseAdmin
      .from("dependentes")
      .select("id, nome_completo, cpf, genero, dependencia, data_nascimento, foto_url, colaborador_id, foto_aceita, foto_enviada_em, foto_enviada_por")
      .eq("colaborador_id", colaborador.id)
      .order("nome_completo")

    if (dependentesError) throw new Error(dependentesError.message)

    // PD-01: a tela recebe nome, CPF e nascimento já mascarados
    return NextResponse.json({
      colaborador: colaboradorParaTela(colaborador),
      dependentes: (dependentes ?? []).map(dependenteParaTela),
      // PD-04: sem aceite da versão atual, a tela mostra o termo e bloqueia câmera/galeria/envio
      termo: { versao: TERMO_VERSAO, aceito: await termoAceito(colaborador.id) },
    })
  } catch (error) {
    console.error("[session] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

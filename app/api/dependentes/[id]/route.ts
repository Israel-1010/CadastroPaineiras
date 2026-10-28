import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, getColaboradorId, unauthorized } from "@/lib/auth"
import { isOwnPhotoUrl } from "@/lib/s3"

const DEPENDENTE_COLUMNS = "id, nome_completo, cpf, genero, dependencia, data_nascimento, foto_url, colaborador_id"

// O colaborador NÃO altera dados do dependente (nome, CPF, parentesco...): só envia a foto.
/** Grava a foto do dependente (cartão na tela inicial) */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const fotoUrl = typeof body?.foto_url === "string" ? body.foto_url : ""
    if (!fotoUrl || !isOwnPhotoUrl(fotoUrl, colaboradorId)) {
      return NextResponse.json({ error: "Foto inválida" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("dependentes")
      .update({ foto_url: fotoUrl, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("colaborador_id", colaboradorId)
      .select(DEPENDENTE_COLUMNS)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    await audit({ tipo: "colaborador", id: colaboradorId }, "foto", "dependentes", data.id)
    return NextResponse.json({ dependente: data })
  } catch (error) {
    console.error("[dependentes] erro ao salvar foto:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}


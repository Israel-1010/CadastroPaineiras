import { type NextRequest, NextResponse } from "next/server"
import { isUniqueViolation, supabaseAdmin } from "@/lib/supabase/server"
import { audit, getColaboradorId, unauthorized } from "@/lib/auth"
import { isOwnPhotoUrl } from "@/lib/s3"
import { dependenteSchema, firstIssue } from "@/lib/validation"

const DEPENDENTE_COLUMNS = "id, nome_completo, cpf, genero, dependencia, data_nascimento, foto_url, colaborador_id"

export async function POST(request: NextRequest) {
  try {
    // O colaborador vem da sessão, nunca do corpo da requisição
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const parsed = dependenteSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
    const input = parsed.data

    if (input.foto_url && !isOwnPhotoUrl(input.foto_url, colaboradorId)) {
      return NextResponse.json({ error: "Foto inválida" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("dependentes")
      .insert({
        ...input,
        foto_url: input.foto_url || null,
        colaborador_id: colaboradorId,
      })
      .select(DEPENDENTE_COLUMNS)
      .single()

    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Já existe um dependente cadastrado com este CPF." }, { status: 409 })
    }
    if (error) throw new Error(error.message)

    await audit({ tipo: "colaborador", id: colaboradorId }, "criar", "dependentes", data.id)
    return NextResponse.json({ dependente: data })
  } catch (error) {
    console.error("[dependentes] erro ao inserir:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

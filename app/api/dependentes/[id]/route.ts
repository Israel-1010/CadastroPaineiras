import { type NextRequest, NextResponse } from "next/server"
import { isUniqueViolation, supabaseAdmin } from "@/lib/supabase/server"
import { audit, getColaboradorId, unauthorized } from "@/lib/auth"
import { removeFace } from "@/lib/dahua"
import { isOwnPhotoUrl } from "@/lib/s3"
import { dependenteSchema, firstIssue } from "@/lib/validation"

const DEPENDENTE_COLUMNS = "id, nome_completo, cpf, genero, dependencia, data_nascimento, foto_url, colaborador_id"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const parsed = dependenteSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
    const input = parsed.data

    // Só edita dependente do próprio colaborador
    const { data: atual, error: findError } = await supabaseAdmin
      .from("dependentes")
      .select("id, cpf, foto_url")
      .eq("id", params.id)
      .eq("colaborador_id", colaboradorId)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!atual) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    // Aceita a foto atual (inclusive fotos antigas) ou uma enviada por este colaborador
    if (input.foto_url && input.foto_url !== atual.foto_url && !isOwnPhotoUrl(input.foto_url, colaboradorId)) {
      return NextResponse.json({ error: "Foto inválida" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("dependentes")
      .update({
        ...input,
        foto_url: input.foto_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", atual.id)
      .eq("colaborador_id", colaboradorId)
      .select(DEPENDENTE_COLUMNS)
      .single()

    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Já existe outro dependente cadastrado com este CPF." }, { status: 409 })
    }
    if (error) throw new Error(error.message)

    // A face é cadastrada no terminal com o CPF como UserID: se o CPF mudou, remove o cadastro antigo
    if (atual.cpf !== data.cpf) await removeFace(atual.cpf)

    await audit({ tipo: "colaborador", id: colaboradorId }, "editar", "dependentes", data.id, {
      cpf_alterado: atual.cpf !== data.cpf,
    })
    return NextResponse.json({ dependente: data })
  } catch (error) {
    console.error("[dependentes] erro ao editar:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

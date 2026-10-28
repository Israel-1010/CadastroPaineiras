import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, getColaboradorId, unauthorized } from "@/lib/auth"
import { syncFace, upsertCard } from "@/lib/dahua"
import { deleteObject, getObject, isOwnPhotoUrl, photoKeyFromUrl } from "@/lib/s3"

export const runtime = "nodejs"

const DEPENDENTE_COLUMNS = "id, nome_completo, cpf, genero, dependencia, data_nascimento, foto_url, colaborador_id"

// O colaborador NÃO altera dados do dependente (nome, CPF, parentesco...): só envia a foto.
/**
 * Foto nova do dependente (cartão na tela inicial).
 * Primeiro envia às catracas; só grava no banco se o facial aceitar a foto.
 * Se nenhum terminal aceitar, a foto não é salva e o arquivo enviado é apagado.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const fotoUrl = typeof body?.foto_url === "string" ? body.foto_url : ""
    const key = photoKeyFromUrl(fotoUrl)
    if (!fotoUrl || !key || !isOwnPhotoUrl(fotoUrl, colaboradorId)) {
      return NextResponse.json({ error: "Foto inválida" }, { status: 400 })
    }

    const { data: dependente, error: findError } = await supabaseAdmin
      .from("dependentes")
      .select("id, cpf, nome_completo")
      .eq("id", params.id)
      .eq("colaborador_id", colaboradorId)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!dependente) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    // Cartão de acesso (não bloqueia) e face nos terminais, com a foto recém-enviada
    await upsertCard(dependente.cpf, dependente.nome_completo).catch((err) =>
      console.warn("[dependentes] cartão não enviado:", (err as Error).message),
    )
    let face: Awaited<ReturnType<typeof syncFace>>
    try {
      face = await syncFace(dependente.cpf, dependente.nome_completo, await getObject(key))
    } catch (err) {
      console.warn("[dependentes] foto não processada:", (err as Error).message)
      await deleteObject(key)
      return NextResponse.json(
        { error: "Não foi possível processar esta foto. Tire outra foto e tente de novo.", catraca: true },
        { status: 502 },
      )
    }
    if (!face.ok) {
      console.warn("[dependentes] facial recusou a foto:", JSON.stringify(face.results))
      await deleteObject(key)
      return NextResponse.json(
        {
          error: "A catraca não aceitou esta foto (o rosto precisa estar de frente, bem iluminado e sem óculos escuros ou boné). A foto não foi salva: tire outra.",
          catraca: true,
        },
        { status: 502 },
      )
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

import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, getColaboradorId, unauthorized } from "@/lib/auth"
import { syncFace, upsertCard } from "@/lib/dahua"
import { deleteObject, getObject, isOwnPhotoUrl, photoKeyFromUrl } from "@/lib/s3"

export const runtime = "nodejs"

const DEPENDENTE_COLUMNS =
  "id, nome_completo, cpf, genero, dependencia, data_nascimento, foto_url, colaborador_id, foto_aceita, foto_enviada_em"

const MSG_RECUSADA =
  "A catraca não aceitou esta foto (o rosto precisa estar de frente, bem iluminado e sem óculos escuros ou boné). Tire outra foto."
const MSG_SEM_CONEXAO = "Não foi possível conectar às catracas agora. Tente enviar de novo em instantes."

// O colaborador NÃO altera dados do dependente (nome, CPF, parentesco...): só envia a foto.
/**
 * Envia a foto do dependente às catracas (cartão na tela inicial).
 * - body { foto_url }: foto nova; só é gravada no banco se o facial aceitar (se recusar, o arquivo é apagado).
 * - body {}: reenvia a foto já salva.
 * Grava em foto_aceita/foto_enviada_em o resultado, para o cartão mostrar "Foto enviada".
 * Catracas inacessíveis não contam como recusa: nada muda e a foto nova é mantida para tentar de novo.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const fotoUrlBody = typeof body?.foto_url === "string" ? body.foto_url : ""

    const { data: dependente, error: findError } = await supabaseAdmin
      .from("dependentes")
      .select("id, cpf, nome_completo, foto_url")
      .eq("id", params.id)
      .eq("colaborador_id", colaboradorId)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!dependente) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    const novaFoto = Boolean(fotoUrlBody) && fotoUrlBody !== dependente.foto_url
    const fotoUrl = novaFoto ? fotoUrlBody : dependente.foto_url
    const key = photoKeyFromUrl(fotoUrl)
    if (novaFoto && (!key || !isOwnPhotoUrl(fotoUrl, colaboradorId))) {
      return NextResponse.json({ error: "Foto inválida" }, { status: 400 })
    }
    if (!key) return NextResponse.json({ error: "Dependente sem foto. Tire ou escolha uma foto." }, { status: 400 })

    const registrar = (campos: Record<string, unknown>) =>
      supabaseAdmin
        .from("dependentes")
        .update({ ...campos, updated_at: new Date().toISOString() })
        .eq("id", dependente.id)
        .eq("colaborador_id", colaboradorId)
        .select(DEPENDENTE_COLUMNS)
        .maybeSingle()

    // Cartão de acesso (não bloqueia) e face nos terminais
    await upsertCard(dependente.cpf, dependente.nome_completo).catch((err) =>
      console.warn("[dependentes] cartão não enviado:", (err as Error).message),
    )
    let face: Awaited<ReturnType<typeof syncFace>>
    try {
      face = await syncFace(dependente.cpf, dependente.nome_completo, await getObject(key))
    } catch (err) {
      const msg = (err as Error).message
      console.warn("[dependentes] foto não enviada:", msg)
      if (msg.includes("não configurada")) {
        return NextResponse.json({ error: MSG_SEM_CONEXAO, descartada: false }, { status: 503 })
      }
      if (novaFoto) await deleteObject(key)
      return NextResponse.json(
        { error: "Não foi possível processar esta foto. Tire outra foto e tente de novo.", descartada: novaFoto },
        { status: 502 },
      )
    }

    if (!face.ok) {
      // Nenhum terminal respondeu: problema de rede, não da foto
      if (face.results.every((r) => "error" in r)) {
        console.warn("[dependentes] catracas inacessíveis:", JSON.stringify(face.results))
        return NextResponse.json({ error: MSG_SEM_CONEXAO, descartada: false }, { status: 503 })
      }
      // O facial recusou (e a face anterior já foi removida dos terminais)
      console.warn("[dependentes] facial recusou a foto:", JSON.stringify(face.results))
      if (novaFoto) await deleteObject(key)
      const { data } = await registrar({ foto_aceita: false, foto_enviada_em: new Date().toISOString() })
      return NextResponse.json({ error: MSG_RECUSADA, descartada: novaFoto, dependente: data }, { status: 422 })
    }

    const { data, error } = await registrar({
      foto_url: fotoUrl,
      foto_aceita: true,
      foto_enviada_em: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    await audit({ tipo: "colaborador", id: colaboradorId }, novaFoto ? "foto" : "reenvio_foto", "dependentes", data.id)
    return NextResponse.json({ dependente: data })
  } catch (error) {
    console.error("[dependentes] erro ao enviar foto:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

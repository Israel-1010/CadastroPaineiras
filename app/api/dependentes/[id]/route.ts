import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, getColaboradorId, unauthorized } from "@/lib/auth"
import { enviarFaceDependente } from "@/lib/facial"
import { ORIENTACAO_FOTO } from "@/lib/mensagens"
import { dependenteParaTela } from "@/lib/mascara"
import { termoAceito, termoPendente } from "@/lib/aceite"
import { registrarEnvio } from "@/lib/log-envios"
import { deleteObject, isOwnPhotoUrl, photoKeyFromUrl } from "@/lib/s3"
import { dataHoraBrasilia, passagensDepoisDoEnvio } from "@/lib/passagens"

export const runtime = "nodejs"

const DEPENDENTE_COLUMNS =
  "id, nome_completo, cpf, genero, dependencia, data_nascimento, foto_url, colaborador_id, foto_aceita, foto_enviada_em, foto_enviada_por"

const MSG_RECUSADA = `A catraca não aceitou esta foto. ${ORIENTACAO_FOTO} Tire outra foto.`
const MSG_SEM_CONEXAO = "Não foi possível conectar às catracas agora. Tente enviar de novo em instantes."

// O colaborador NÃO altera dados do dependente (nome, CPF, parentesco...): só envia a foto.
/**
 * Envia a foto do dependente às catracas (cartão na tela inicial).
 * - body { foto_url }: foto nova; só é gravada no banco se o facial aceitar (se recusar, o arquivo é apagado).
 * - body {}: reenvia a foto já salva.
 * Grava em foto_aceita/foto_enviada_em o resultado, para o cartão mostrar "Foto enviada".
 * Catracas inacessíveis não contam como recusa: nada muda e a foto nova é mantida para tentar de novo.
 * Depois que o dependente passa pelo facial com a foto atual (tabela passages), responde 409 e não envia.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()
    // PD-04: envio às catracas só depois do aceite do termo
    if (!(await termoAceito(colaboradorId))) return termoPendente()

    const body = await request.json().catch(() => ({}))
    const fotoUrlBody = typeof body?.foto_url === "string" ? body.foto_url : ""

    const { data: dependente, error: findError } = await supabaseAdmin
      .from("dependentes")
      .select("id, cpf, nome_completo, foto_url, foto_enviada_em")
      .eq("id", params.id)
      .eq("colaborador_id", colaboradorId)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!dependente) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    // Já passou pelo facial com a foto atual: o colaborador não troca nem reenvia mais
    const passouEm = (await passagensDepoisDoEnvio([dependente])).get(dependente.id)
    if (passouEm) {
      return NextResponse.json(
        {
          error: `Este dependente já passou pelo facial em ${dataHoraBrasilia(passouEm)}. A foto não pode mais ser trocada. Se precisar, procure o RH.`,
          passou_facial_em: passouEm,
          descartada: false,
        },
        { status: 409 },
      )
    }

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

    const resultado = await enviarFaceDependente(dependente, key)

    // PD-05: histórico de todo envio (inclusive recusas e falhas), com a foto anterior quando é troca
    await registrarEnvio(request, {
      origem: "colaborador",
      acao: !novaFoto ? "reenvio" : dependente.foto_url ? "troca" : "envio",
      resultado,
      dependente: { ...dependente, colaborador_id: colaboradorId },
      fotoUrl,
      fotoAnterior: novaFoto ? dependente.foto_url : null,
    })

    // Nenhum terminal respondeu: problema de rede, não da foto
    if (resultado === "sem_conexao") {
      return NextResponse.json({ error: MSG_SEM_CONEXAO, descartada: false }, { status: 503 })
    }
    if (resultado === "erro_foto") {
      if (novaFoto) await deleteObject(key)
      return NextResponse.json(
        { error: "Não foi possível processar esta foto. Tire outra foto e tente de novo.", descartada: novaFoto },
        { status: 502 },
      )
    }
    // O facial recusou (e a face anterior já foi removida dos terminais)
    if (resultado === "recusada") {
      if (novaFoto) await deleteObject(key)
      const { data } = await registrar({
        foto_aceita: false,
        foto_enviada_em: new Date().toISOString(),
        foto_enviada_por: "colaborador",
      })
      return NextResponse.json(
        { error: MSG_RECUSADA, descartada: novaFoto, dependente: data ? dependenteParaTela(data) : null },
        { status: 422 },
      )
    }

    const { data, error } = await registrar({
      foto_url: fotoUrl,
      foto_aceita: true,
      foto_enviada_em: new Date().toISOString(),
      foto_enviada_por: "colaborador",
    })
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    await audit({ tipo: "colaborador", id: colaboradorId }, novaFoto ? "foto" : "reenvio_foto", "dependentes", data.id)
    return NextResponse.json({ dependente: dependenteParaTela(data) })
  } catch (error) {
    console.error("[dependentes] erro ao enviar foto:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

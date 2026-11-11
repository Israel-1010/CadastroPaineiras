import { type NextRequest, NextResponse } from "next/server"
import { isUniqueViolation, supabaseAdmin } from "@/lib/supabase/server"
import { audit, exigirAdmin } from "@/lib/auth"
import { removerDasCatracas } from "@/lib/dahua"
import { enviarFaceDependente, type ResultadoFacial } from "@/lib/facial"
import { registrarEnvio } from "@/lib/log-envios"
import { photoKeyFromUrl } from "@/lib/s3"
import { onlyDigits } from "@/lib/cpf"
import { dependenteSchema, firstIssue } from "@/lib/validation"

export const runtime = "nodejs"

const MSG_CPF_DUPLICADO = "Já existe outro dependente cadastrado com este CPF."
const cpf11 = (cpf: string) => onlyDigits(cpf).padStart(11, "0")

/**
 * Body { presenca_confirmada }: confirma/desfaz presença (permissão "presenca").
 * Body { re, nome_completo, cpf, genero, dependencia, data_nascimento }: edita os dados (permissão "cadastro").
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}))
  return body && "presenca_confirmada" in body ? alterarPresenca(body, params.id) : editarDados(request, body, params.id)
}

async function alterarPresenca(body: { presenca_confirmada?: unknown }, id: string) {
  try {
    const auth = await exigirAdmin("presenca")
    if ("resposta" in auth) return auth.resposta
    const { admin } = auth

    const { presenca_confirmada } = body
    if (typeof presenca_confirmada !== "boolean") {
      return NextResponse.json({ error: "Campo presenca_confirmada deve ser um boolean" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("dependentes")
      .update({
        presenca_confirmada,
        presenca_confirmada_em: presenca_confirmada ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id, presenca_confirmada")
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    await audit({ tipo: "admin", id: admin.id }, "presenca", "dependentes", id, { presenca_confirmada })
    return NextResponse.json({ dependente: data })
  } catch (error) {
    console.error("[admin/dependentes] erro ao atualizar presença:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao atualizar presença" }, { status: 500 })
  }
}

/**
 * Edição pelo admin/RH. O CPF é o UserID nas catracas: se ele muda, a face sai do CPF antigo
 * e a foto é enviada de novo com o novo. Se só o nome muda, o nome é atualizado na catraca.
 */
async function editarDados(request: NextRequest, body: Record<string, unknown>, id: string) {
  try {
    const auth = await exigirAdmin("cadastro")
    if ("resposta" in auth) return auth.resposta
    const { admin } = auth

    const re = typeof body?.re === "string" ? body.re.trim() : ""
    if (!re) return NextResponse.json({ error: "Informe o RE do colaborador" }, { status: 400 })
    const parsed = dependenteSchema.omit({ foto_url: true }).safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
    const input = parsed.data

    const { data: atual, error: atualError } = await supabaseAdmin
      .from("dependentes")
      .select("id, cpf, nome_completo, genero, dependencia, data_nascimento, colaborador_id, foto_url, foto_aceita")
      .eq("id", id)
      .maybeSingle()
    if (atualError) throw new Error(atualError.message)
    if (!atual) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    const { data: colaborador, error: colError } = await supabaseAdmin
      .from("colaboradores")
      .select("id")
      .eq("re", re)
      .maybeSingle()
    if (colError) throw new Error(colError.message)
    if (!colaborador) return NextResponse.json({ error: `Nenhum colaborador com RE ${re}` }, { status: 404 })

    const cpfMudou = cpf11(atual.cpf) !== cpf11(input.cpf)
    const nomeMudou = atual.nome_completo !== input.nome_completo
    if (cpfMudou) {
      // Checagem explícita: a constraint UNIQUE de CPF só existe depois do 005_seguranca.sql
      const { data: outro, error: dupError } = await supabaseAdmin
        .from("dependentes")
        .select("id")
        .in("cpf", [...new Set([input.cpf, cpf11(input.cpf)])])
        .neq("id", id)
        .limit(1)
      if (dupError) throw new Error(dupError.message)
      if (outro?.length) return NextResponse.json({ error: MSG_CPF_DUPLICADO }, { status: 409 })
    }

    const colunas = "*, colaborador:colaboradores(nome_completo, re)"
    const { data: salvo, error } = await supabaseAdmin
      .from("dependentes")
      .update({ ...input, colaborador_id: colaborador.id, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(colunas)
      .single()
    if (isUniqueViolation(error)) return NextResponse.json({ error: MSG_CPF_DUPLICADO }, { status: 409 })
    if (error) throw new Error(error.message)
    let dependente = salvo

    // Catracas: CPF novo = face sai do antigo e entra no novo; nome novo = atualiza o nome na catraca
    let aviso: string | undefined
    if (cpfMudou) {
      try {
        const terminais = await removerDasCatracas(cpf11(atual.cpf))
        const faces = terminais.map((t) => t.face)
        await registrarEnvio(request, {
          origem: "admin",
          acao: "remocao",
          resultado: faces.every((f) => f === "removida") ? "removida" : faces.every((f) => f === "sem conexão") ? "sem_conexao" : "erro",
          dependente: { ...atual, cpf: cpf11(atual.cpf) },
          adminId: admin.id,
          detalhes: { motivo: "cpf_alterado", cpf_novo: input.cpf, terminais },
        })
      } catch (err) {
        console.warn("[admin/dependentes] CPF antigo não removido das catracas:", (err as Error).message)
      }
    }

    const key = photoKeyFromUrl(dependente.foto_url)
    const sincronizar = key && (cpfMudou || (nomeMudou && atual.foto_aceita === true))
    if (sincronizar) {
      const resultado: ResultadoFacial = await enviarFaceDependente({ cpf: input.cpf, nome_completo: input.nome_completo }, key)
      await registrarEnvio(request, {
        origem: "admin",
        acao: "carga",
        resultado,
        dependente,
        adminId: admin.id,
        fotoUrl: dependente.foto_url,
        detalhes: { motivo: cpfMudou ? "cpf_alterado" : "nome_alterado", cpf_anterior: cpfMudou ? cpf11(atual.cpf) : undefined },
      })
      // Só o nome mudou e a catraca não respondeu/recusou: a face antiga (com o nome antigo) continua valendo
      const situacao =
        resultado === "aceita"
          ? { foto_aceita: true, foto_enviada_em: new Date().toISOString() }
          : cpfMudou
            ? resultado === "recusada"
              ? { foto_aceita: false, foto_enviada_em: new Date().toISOString() }
              : { foto_aceita: null, foto_enviada_em: null }
            : null
      if (situacao) {
        const { data } = await supabaseAdmin.from("dependentes").update(situacao).eq("id", id).select(colunas).single()
        if (data) dependente = data
      }
      aviso =
        resultado === "aceita"
          ? cpfMudou
            ? "Foto enviada às catracas com o CPF novo."
            : "Nome atualizado nas catracas."
          : cpfMudou
            ? resultado === "recusada"
              ? "A catraca recusou a foto com o CPF novo: o colaborador precisa enviar outra foto."
              : "As catracas não responderam: envie a foto de novo pela Carga no Facial (fica em \"pendentes\")."
            : "O nome não foi atualizado nas catracas agora; ele muda no próximo envio da foto."
    } else if (cpfMudou && dependente.foto_aceita != null) {
      // Sem foto para reenviar: o CPF novo ainda não está nas catracas
      const { data } = await supabaseAdmin
        .from("dependentes")
        .update({ foto_aceita: null, foto_enviada_em: null })
        .eq("id", id)
        .select(colunas)
        .single()
      if (data) dependente = data
    }

    await audit({ tipo: "admin", id: admin.id }, "editar", "dependentes", id, {
      antes: { cpf: atual.cpf, nome_completo: atual.nome_completo, genero: atual.genero, dependencia: atual.dependencia, data_nascimento: atual.data_nascimento, colaborador_id: atual.colaborador_id },
      colaborador_re: re,
    })
    return NextResponse.json({ dependente, aviso })
  } catch (error) {
    console.error("[admin/dependentes] erro ao editar:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao salvar as alterações" }, { status: 500 })
  }
}

/**
 * Exclui o dependente (permissão "excluir"). Antes, tira a face e o cartão dele das catracas, para não
 * continuar entrando, e registra a remoção no Histórico de Fotos (o registro fica, com nome e CPF).
 * Catracas sem resposta não impedem a exclusão: a resposta traz um aviso para remover depois.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await exigirAdmin("excluir")
    if ("resposta" in auth) return auth.resposta
    const { admin } = auth

    const { data: atual, error: atualError } = await supabaseAdmin
      .from("dependentes")
      .select("id, cpf, nome_completo, colaborador_id, foto_url")
      .eq("id", params.id)
      .maybeSingle()
    if (atualError) throw new Error(atualError.message)
    if (!atual) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    const cpf = cpf11(atual.cpf)
    let faces: string[] = []
    try {
      const terminais = await removerDasCatracas(cpf)
      faces = terminais.map((t) => t.face)
      // Gravado antes de excluir: o histórico guarda nome e CPF (o vínculo com o dependente vira nulo)
      await registrarEnvio(request, {
        origem: "admin",
        acao: "remocao",
        resultado: faces.every((f) => f === "removida") ? "removida" : faces.every((f) => f === "sem conexão") ? "sem_conexao" : "erro",
        dependente: { ...atual, cpf },
        adminId: admin.id,
        fotoUrl: atual.foto_url,
        detalhes: { motivo: "dependente_excluido", terminais },
      })
    } catch (err) {
      console.warn("[admin/dependentes] dependente não removido das catracas:", (err as Error).message)
    }

    const { error } = await supabaseAdmin.from("dependentes").delete().eq("id", atual.id)
    if (error) throw new Error(error.message)

    await audit({ tipo: "admin", id: admin.id }, "excluir", "dependentes", atual.id, {
      nome_completo: atual.nome_completo,
      colaborador_id: atual.colaborador_id,
      catracas: faces,
    })

    // "erro 4xx" na remoção costuma ser face que nunca foi cadastrada: só avisa quando a catraca não respondeu
    const aviso = faces.some((f) => f === "sem conexão")
      ? `Uma ou mais catracas não responderam. Remova o CPF ${cpf} em Carga no Facial › Remover das catracas.`
      : undefined
    return NextResponse.json({ message: "Dependente excluído com sucesso", aviso })
  } catch (error) {
    console.error("[admin/dependentes] erro ao excluir:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao excluir dependente" }, { status: 500 })
  }
}

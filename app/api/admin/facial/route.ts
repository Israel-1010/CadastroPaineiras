import { type NextRequest, NextResponse } from "next/server"
import { fetchAll, supabaseAdmin } from "@/lib/supabase/server"
import { audit, exigirAdmin } from "@/lib/auth"
import { enviarFaceDependente, type ResultadoFacial } from "@/lib/facial"
import { photoKeyFromUrl } from "@/lib/s3"
import { registrarEnvio } from "@/lib/log-envios"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Lote pequeno: cada foto leva alguns segundos (cadastra ou troca em cada terminal),
// e o pedido precisa terminar antes do timeout do proxy. O navegador chama lote após lote.
const MAX_LOTE = 10

type Linha = {
  id: string
  nome_completo: string
  foto_url: string | null
  foto_aceita: boolean | null
  colaborador: { nome_completo: string; re: string } | null
}

const MODOS = ["pendentes", "recusadas", "todas"] as const
type Modo = (typeof MODOS)[number]

/**
 * Resumo da situação das fotos e fila da carga.
 * ?modo=pendentes (padrão): nunca enviadas | recusadas: recusadas pelo facial | todas: recarga completa
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await exigirAdmin("facial")
    if ("resposta" in auth) return auth.resposta
    const param = request.nextUrl.searchParams.get("modo") as Modo
    const modo: Modo = MODOS.includes(param) ? param : "pendentes"

    const linhas = await fetchAll<Linha>((from, to) =>
      supabaseAdmin
        .from("dependentes")
        .select("id, nome_completo, foto_url, foto_aceita, colaborador:colaboradores(nome_completo, re)")
        .order("nome_completo")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: Linha[] | null; error: { message: string } | null }>,
    )

    const comFoto = linhas.filter((d) => d.foto_url)
    const resumo = {
      total: linhas.length,
      comFoto: comFoto.length,
      semFoto: linhas.length - comFoto.length,
      aceitas: comFoto.filter((d) => d.foto_aceita === true).length,
      recusadas: comFoto.filter((d) => d.foto_aceita === false).length,
      nuncaEnviadas: comFoto.filter((d) => d.foto_aceita == null).length,
    }
    const naFila = {
      pendentes: (d: Linha) => d.foto_aceita == null,
      recusadas: (d: Linha) => d.foto_aceita === false,
      todas: () => true,
    }[modo]
    const fila = comFoto.filter(naFila).map((d) => ({
      id: d.id,
      nome_completo: d.nome_completo,
      colaborador: d.colaborador ? `${d.colaborador.nome_completo} (RE ${d.colaborador.re})` : null,
    }))

    return NextResponse.json({ modo, resumo, fila })
  } catch (error) {
    console.error("[admin/facial] erro ao montar a fila:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao carregar a situação das fotos" }, { status: 500 })
  }
}

type ResultadoCarga = ResultadoFacial | "sem_foto" | "nao_encontrado"

/** Envia um lote de dependentes às catracas e grava o resultado de cada um */
export async function POST(request: NextRequest) {
  try {
    const auth = await exigirAdmin("facial")
    if ("resposta" in auth) return auth.resposta
    const { admin } = auth

    const body = await request.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((v: unknown) => typeof v === "string") : []
    if (ids.length === 0 || ids.length > MAX_LOTE) {
      return NextResponse.json({ error: `Envie de 1 a ${MAX_LOTE} dependentes por vez` }, { status: 400 })
    }

    const { data: dependentes, error } = await supabaseAdmin
      .from("dependentes")
      .select("id, cpf, nome_completo, foto_url, colaborador_id, foto_aceita")
      .in("id", ids)
    if (error) throw new Error(error.message)
    const porId = new Map((dependentes ?? []).map((d) => [d.id, d]))

    const resultados: Array<{ id: string; resultado: ResultadoCarga }> = []
    for (const id of ids) {
      const dependente = porId.get(id)
      const key = photoKeyFromUrl(dependente?.foto_url)
      if (!dependente || !key) {
        resultados.push({ id, resultado: dependente ? "sem_foto" : "nao_encontrado" })
        continue
      }

      const resultado = await enviarFaceDependente(dependente, key)
      resultados.push({ id, resultado })
      // PD-05: histórico da carga feita pelo admin
      await registrarEnvio(request, { origem: "admin", acao: "carga", resultado, dependente, adminId: admin.id, fotoUrl: dependente.foto_url })
      // Catracas fora do ar: não adianta continuar o lote
      if (resultado === "sem_conexao") break

      // Recusada para quem já estava aceito: a face anterior continua na catraca (nada é removido), então nada muda
      const continuaValendo = resultado === "recusada" && dependente.foto_aceita === true
      if ((resultado === "aceita" || resultado === "recusada") && !continuaValendo) {
        const agora = new Date().toISOString()
        // foto_enviada_por fica intacto: o aviso de sucesso no cartão é só para envio feito pelo colaborador
        const { error: updError } = await supabaseAdmin
          .from("dependentes")
          .update({ foto_aceita: resultado === "aceita", foto_enviada_em: agora, updated_at: agora })
          .eq("id", id)
        if (updError) console.warn("[admin/facial] resultado não gravado:", updError.message)
      }
    }

    const contar = (r: ResultadoCarga) => resultados.filter((x) => x.resultado === r).length
    await audit({ tipo: "admin", id: admin.id }, "carga_facial", "dependentes", null, {
      enviados: resultados.length,
      aceitas: contar("aceita"),
      recusadas: contar("recusada"),
      sem_conexao: contar("sem_conexao"),
    })
    return NextResponse.json({ resultados })
  } catch (error) {
    console.error("[admin/facial] erro na carga:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao enviar o lote às catracas" }, { status: 500 })
  }
}

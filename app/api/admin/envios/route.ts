import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { exigirAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

const POR_PAGINA = 50
const RESULTADOS = ["aceita", "recusada", "sem_conexao", "erro_foto", "removida", "erro"]
const ORIGENS = ["colaborador", "admin"]
const DATA = /^\d{4}-\d{2}-\d{2}$/
// Horário de Brasília (sem horário de verão desde 2019)
const FUSO = "-03:00"

/**
 * PD-05: histórico de envios, trocas, cargas e remoções de foto nas catracas.
 * ?q= nome ou CPF · resultado= · origem= · de=/ate= (AAAA-MM-DD) · pagina= (50 por página)
 * Devolve também a contagem por resultado com os mesmos filtros (sem o de resultado).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await exigirAdmin("facial")
    if ("resposta" in auth) return auth.resposta

    const sp = request.nextUrl.searchParams
    // Caracteres que quebrariam o filtro do PostgREST
    const q = (sp.get("q") ?? "").replace(/[,()*%\\]/g, " ").trim()
    const resultado = RESULTADOS.includes(sp.get("resultado") ?? "") ? sp.get("resultado")! : ""
    const origem = ORIGENS.includes(sp.get("origem") ?? "") ? sp.get("origem")! : ""
    const de = DATA.test(sp.get("de") ?? "") ? sp.get("de")! : ""
    const ate = DATA.test(sp.get("ate") ?? "") ? sp.get("ate")! : ""
    const pagina = Math.max(0, Number.parseInt(sp.get("pagina") ?? "0", 10) || 0)

    // Mesmos filtros na lista e nas contagens
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtrar = (consulta: any, comResultado: boolean) => {
      if (q) {
        const digitos = q.replace(/\D/g, "")
        consulta =
          digitos.length >= 3 && digitos.length === q.replace(/[.\-\s]/g, "").length
            ? consulta.ilike("cpf", `%${digitos}%`)
            : consulta.ilike("nome", `%${q}%`)
      }
      if (origem) consulta = consulta.eq("origem", origem)
      if (de) consulta = consulta.gte("criado_em", new Date(`${de}T00:00:00${FUSO}`).toISOString())
      if (ate) consulta = consulta.lte("criado_em", new Date(`${ate}T23:59:59.999${FUSO}`).toISOString())
      if (comResultado && resultado) consulta = consulta.eq("resultado", resultado)
      return consulta
    }

    const lista = filtrar(
      supabaseAdmin
        .from("envios_foto")
        .select(
          "id, criado_em, cpf, nome, origem, acao, resultado, foto_url, foto_anterior, ip, dispositivo, detalhes, colaborador:colaboradores(nome_completo, re), admin:administradores(username)",
          { count: "exact" },
        )
        .order("criado_em", { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1),
      true,
    )
    const contar = (r?: string) => {
      let c = filtrar(supabaseAdmin.from("envios_foto").select("id", { count: "exact", head: true }), false)
      if (r) c = c.eq("resultado", r)
      return c
    }

    const [listaR, totalR, aceitaR, recusadaR, semConexaoR] = await Promise.all([
      lista,
      contar(),
      contar("aceita"),
      contar("recusada"),
      contar("sem_conexao"),
    ])
    const erro = listaR.error ?? totalR.error
    if (erro) {
      // Tabela ainda não criada (010_log_envios.sql não rodado)
      if (erro.code === "PGRST205" || erro.code === "42P01" || /envios_foto/.test(erro.message)) {
        return NextResponse.json({ error: "O histórico ainda não está ativado: rode o scripts/010_log_envios.sql." }, { status: 503 })
      }
      throw new Error(erro.message)
    }

    const total = totalR.count ?? 0
    const aceitas = aceitaR.count ?? 0
    const recusadas = recusadaR.count ?? 0
    const semConexao = semConexaoR.count ?? 0
    return NextResponse.json({
      envios: listaR.data ?? [],
      encontrados: listaR.count ?? 0,
      pagina,
      porPagina: POR_PAGINA,
      resumo: { total, aceitas, recusadas, semConexao, outros: Math.max(0, total - aceitas - recusadas - semConexao) },
    })
  } catch (error) {
    console.error("[admin/envios] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao carregar o histórico" }, { status: 500 })
  }
}

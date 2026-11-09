import { type NextRequest, NextResponse } from "next/server"
import { fetchAll, supabaseAdmin } from "@/lib/supabase/server"
import { exigirAdmin } from "@/lib/auth"
import { montarAcessos, nomesCatracas, type ColaboradorBase, type DependenteBase, type Passagem } from "@/lib/acessos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Horário de Brasília (sem horário de verão desde 2019)
const FUSO = "-03:00"
const FUSO_MS = 3 * 60 * 60 * 1000
const MAX_DIAS = 31
const MAX_LEITURAS = 100_000

const DATA = /^\d{4}-\d{2}-\d{2}$/
/** Dia (AAAA-MM-DD) em Brasília de um instante ISO */
const diaLocal = (iso: string) => new Date(Date.parse(iso) - FUSO_MS).toISOString().slice(0, 10)

/** Leituras do período, de 1000 em 1000 (limite do PostgREST), até MAX_LEITURAS */
async function buscarPassagens(inicio: string, fim: string) {
  const linhas: Passagem[] = []
  for (let from = 0; from < MAX_LEITURAS; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("passages")
      .select("user_id, user_name, card_no, similarity, timestamp, recorded_at, device_ip")
      .gte("timestamp", inicio)
      .lte("timestamp", fim)
      .order("timestamp")
      .order("id")
      .range(from, from + 999)
    if (error) throw new Error(`passages: ${error.message}`)
    linhas.push(...((data ?? []) as Passagem[]))
    if (!data || data.length < 1000) break
  }
  return linhas
}

/**
 * PD-09: acessos pelas catracas (tabela `passages`).
 * ?de=AAAA-MM-DD&ate=AAAA-MM-DD (horário de Brasília). Sem datas: o último dia com leituras.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await exigirAdmin("relatorios")
    if ("resposta" in auth) return auth.resposta

    const sp = request.nextUrl.searchParams
    let de = sp.get("de") ?? ""
    let ate = sp.get("ate") ?? ""

    const { data: ultima, error: ultimaError } = await supabaseAdmin
      .from("passages")
      .select("timestamp")
      .not("timestamp", "is", null)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ultimaError) throw new Error(`passages: ${ultimaError.message}`)
    const ultimoDia = ultima?.timestamp ? diaLocal(ultima.timestamp) : null

    if (!de && !ate) {
      de = ate = ultimoDia ?? diaLocal(new Date().toISOString())
    }
    if (!ate) ate = de
    if (!de) de = ate
    if (!DATA.test(de) || !DATA.test(ate)) return NextResponse.json({ error: "Data inválida" }, { status: 400 })
    if (ate < de) return NextResponse.json({ error: "A data final é anterior à inicial" }, { status: 400 })
    const inicio = new Date(`${de}T00:00:00${FUSO}`)
    const fim = new Date(`${ate}T23:59:59.999${FUSO}`)
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 })
    }
    if ((fim.getTime() - inicio.getTime()) / 86_400_000 > MAX_DIAS) {
      return NextResponse.json({ error: `Escolha um período de até ${MAX_DIAS} dias` }, { status: 400 })
    }

    const [passagens, dependentes, colaboradores] = await Promise.all([
      buscarPassagens(inicio.toISOString(), fim.toISOString()),
      fetchAll<DependenteBase>((from, to) =>
        supabaseAdmin
          .from("dependentes")
          .select("id, cpf, nome_completo, dependencia, genero, foto_aceita, colaborador:colaboradores(re, nome_completo)")
          .order("id")
          .range(from, to) as any,
      ),
      fetchAll<ColaboradorBase>((from, to) =>
        supabaseAdmin.from("colaboradores").select("id, re, nome_completo").order("id").range(from, to),
      ),
    ])

    const { pessoas, acessos, aptos } = montarAcessos(passagens, dependentes, colaboradores)

    return NextResponse.json({
      periodo: { de, ate },
      ultimoDia,
      leituras: passagens.length,
      limiteAtingido: passagens.length >= MAX_LEITURAS,
      catracas: nomesCatracas(),
      pessoas,
      acessos,
      aptos,
      atualizadoEm: new Date().toISOString(),
    })
  } catch (error) {
    const msg = (error as Error).message
    console.error("[admin/acessos] erro:", msg)
    if (/passages/.test(msg)) {
      return NextResponse.json({ error: "Não foi possível ler a tabela de passagens das catracas" }, { status: 503 })
    }
    return NextResponse.json({ error: "Erro ao carregar os acessos" }, { status: 500 })
  }
}

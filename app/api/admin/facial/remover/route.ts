import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, getAdmin, unauthorized } from "@/lib/auth"
import { onlyDigits } from "@/lib/cpf"
import { removerDasCatracas, type RemocaoTerminal } from "@/lib/dahua"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Lote pequeno: cada CPF faz várias chamadas por terminal (face + busca e remoção do cartão)
const MAX_LOTE = 10

const normalizaCpf = (v: unknown) => {
  const d = onlyDigits(String(v ?? ""))
  return d && d.length < 11 ? d.padStart(11, "0") : d
}

/**
 * PD-08: remove das catracas (face e cartão) os CPFs informados.
 * Body: { cpfs: string[], simular?: boolean, apagarFoto?: boolean }
 * - simular: só confere quem é cada CPF no banco, sem tocar nas catracas.
 * - Dependente que está no banco volta a "não enviada"; com apagarFoto, a foto também é desvinculada
 *   (o colaborador tira outra). CPF que não está no banco (ex.: dependente já removido) só sai das catracas.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdmin()
    if (!admin) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const cpfs: string[] = Array.isArray(body?.cpfs) ? [...new Set<string>(body.cpfs.map(normalizaCpf))].filter(Boolean) : []
    if (cpfs.length === 0 || cpfs.length > MAX_LOTE) {
      return NextResponse.json({ error: `Envie de 1 a ${MAX_LOTE} CPFs por vez` }, { status: 400 })
    }
    const invalidos = cpfs.filter((c) => c.length !== 11)
    if (invalidos.length) return NextResponse.json({ error: `CPF com tamanho inválido: ${invalidos.join(", ")}` }, { status: 400 })

    const { data: deps, error } = await supabaseAdmin
      .from("dependentes")
      .select("id, cpf, nome_completo, foto_url, foto_aceita, colaborador:colaboradores(nome_completo, re)")
      .in("cpf", cpfs)
    if (error) throw new Error(error.message)
    const porCpf = new Map((deps ?? []).map((d) => [onlyDigits(d.cpf), d]))
    const quem = (cpf: string) => {
      const d = porCpf.get(cpf) as any
      return d
        ? { no_banco: true, nome: d.nome_completo, colaborador: d.colaborador ? `${d.colaborador.nome_completo} (RE ${d.colaborador.re})` : null, tem_foto: Boolean(d.foto_url), foto_aceita: d.foto_aceita }
        : { no_banco: false }
    }

    if (body?.simular) return NextResponse.json({ itens: cpfs.map((cpf) => ({ cpf, ...quem(cpf) })) })

    const apagarFoto = Boolean(body?.apagarFoto)
    const itens: Array<{ cpf: string; terminais: RemocaoTerminal[] } & ReturnType<typeof quem>> = []
    for (const cpf of cpfs) {
      const terminais = await removerDasCatracas(cpf)
      const dep = porCpf.get(cpf)
      if (dep) {
        const { error: updError } = await supabaseAdmin
          .from("dependentes")
          .update({
            foto_aceita: null,
            foto_enviada_em: null,
            foto_enviada_por: null,
            ...(apagarFoto ? { foto_url: null } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", dep.id)
        if (updError) console.warn("[admin/facial/remover] situação não atualizada:", updError.message)
      }
      itens.push({ cpf, ...quem(cpf), terminais })
    }

    await audit({ tipo: "admin", id: admin.id }, "remover_catracas", "dependentes", null, { cpfs: cpfs.length, apagarFoto })
    return NextResponse.json({ itens })
  } catch (error) {
    const msg = (error as Error).message
    console.error("[admin/facial/remover] erro:", msg)
    if (msg.includes("não configurada")) {
      return NextResponse.json({ error: "Integração com as catracas não configurada no servidor" }, { status: 503 })
    }
    return NextResponse.json({ error: "Erro ao remover das catracas" }, { status: 500 })
  }
}

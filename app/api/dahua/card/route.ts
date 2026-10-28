import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { getColaboradorId, unauthorized } from "@/lib/auth"
import { upsertCard } from "@/lib/dahua"

export const runtime = "nodejs"

// Cadastra/atualiza o cartão de acesso de um dependente do colaborador logado.
// CPF e nome vêm do banco; IPs, credenciais, portas e senha do cartão, do ambiente.
// Não bloqueia o fluxo: falhas nos terminais retornam 200 com ok=false.
export async function POST(req: Request) {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const dependenteId = typeof body?.dependente_id === "string" ? body.dependente_id : ""
    if (!dependenteId) return NextResponse.json({ error: "dependente_id é obrigatório" }, { status: 400 })

    const { data: dependente, error } = await supabaseAdmin
      .from("dependentes")
      .select("cpf, nome_completo")
      .eq("id", dependenteId)
      .eq("colaborador_id", colaboradorId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!dependente) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    const result = await upsertCard(dependente.cpf, dependente.nome_completo)
    if (!result.ok) console.warn("[dahua/card] falha em todos os terminais:", JSON.stringify(result.results))
    return NextResponse.json({ ok: result.ok })
  } catch (error) {
    console.error("[dahua/card] erro:", (error as Error).message)
    return NextResponse.json({ ok: false, warn: "Erro ao cadastrar o cartão" })
  }
}

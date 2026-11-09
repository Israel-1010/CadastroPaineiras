import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { exigirAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

const LIMITE = 300

/** PD-05: últimos registros do histórico de envios. ?q= filtra por nome ou CPF */
export async function GET(request: NextRequest) {
  try {
    const auth = await exigirAdmin("facial")
    if ("resposta" in auth) return auth.resposta

    // Caracteres que quebrariam o filtro do PostgREST
    const q = (request.nextUrl.searchParams.get("q") ?? "").replace(/[,()*%\\]/g, " ").trim()
    let consulta = supabaseAdmin
      .from("envios_foto")
      .select(
        "id, criado_em, cpf, nome, origem, acao, resultado, foto_url, foto_anterior, ip, dispositivo, detalhes, colaborador:colaboradores(nome_completo, re), admin:administradores(username)",
      )
      .order("criado_em", { ascending: false })
      .limit(LIMITE)
    if (q) {
      const digitos = q.replace(/\D/g, "")
      consulta = digitos.length >= 3 && digitos.length === q.replace(/[.\-\s]/g, "").length
        ? consulta.ilike("cpf", `%${digitos}%`)
        : consulta.ilike("nome", `%${q}%`)
    }

    const { data, error } = await consulta
    if (error) {
      // Tabela ainda não criada (010_log_envios.sql não rodado)
      if (error.code === "PGRST205" || error.code === "42P01" || /envios_foto/.test(error.message)) {
        return NextResponse.json({ error: "O histórico ainda não está ativado: rode o scripts/010_log_envios.sql." }, { status: 503 })
      }
      throw new Error(error.message)
    }
    return NextResponse.json({ envios: data ?? [], limite: LIMITE })
  } catch (error) {
    console.error("[admin/envios] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao carregar o histórico" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { clientIp, setSessionCookie } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { loginColaboradorSchema } from "@/lib/validation"

const INVALID = "RE ou CPF inválidos. Verifique os dados e tente novamente."

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`login:${clientIp(request)}`, 10, 15 * 60 * 1000)
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      )
    }

    const parsed = loginColaboradorSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: INVALID }, { status: 401 })
    }
    const { re, cpf } = parsed.data

    const { data: colaborador, error } = await supabaseAdmin
      .from("colaboradores")
      .select("id, re, nome_completo")
      .eq("re", re)
      .eq("cpf", cpf)
      .maybeSingle()

    if (error) {
      console.error("[login] erro na consulta:", error.message)
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
    }
    if (!colaborador) {
      return NextResponse.json({ error: INVALID }, { status: 401 })
    }

    return setSessionCookie(NextResponse.json({ colaborador }), "colaborador", colaborador.id)
  } catch (error) {
    console.error("[login] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { clientIp, setSessionCookie } from "@/lib/auth"
import { colaboradorParaTela } from "@/lib/mascara"
import { limparFalhas, registrarFalha, respostaBloqueio, segundosBloqueado } from "@/lib/rate-limit"
import { loginColaboradorSchema } from "@/lib/validation"

const INVALID = "RE ou CPF inválidos. Verifique os dados e tente novamente."
// 5 erros no mesmo RE (a partir do mesmo IP) ou 30 erros de um IP em 15 minutos -> bloqueio de 15 minutos.
// Sem IP real (proxy não repassa X-Forwarded-For) o limite por IP é desligado: travaria todos de uma vez.
const MAX_POR_RE = 5
const MAX_POR_IP = 30

export async function POST(request: NextRequest) {
  try {
    const parsed = loginColaboradorSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: INVALID }, { status: 401 })
    }
    const { re, cpf } = parsed.data

    const ip = clientIp(request)
    const chaveRe = `login:${re}:${ip}`
    const chaveIp = ip === "local" ? null : `login-ip:${ip}`
    const espera = Math.max(segundosBloqueado(chaveRe), chaveIp ? segundosBloqueado(chaveIp) : 0)
    if (espera) {
      const { body, init } = respostaBloqueio(espera)
      return NextResponse.json(body, init)
    }

    const { data: colaborador, error } = await supabaseAdmin
      .from("colaboradores")
      .select("id, re, cpf, nome_completo")
      .eq("re", re)
      .eq("cpf", cpf)
      .maybeSingle()

    if (error) {
      console.error("[login] erro na consulta:", error.message)
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
    }
    if (!colaborador) {
      registrarFalha(chaveRe, MAX_POR_RE)
      if (chaveIp) registrarFalha(chaveIp, MAX_POR_IP)
      return NextResponse.json({ error: INVALID }, { status: 401 })
    }

    limparFalhas(chaveRe)
    // PD-01: resposta com nome e CPF mascarados
    return setSessionCookie(
      request,
      NextResponse.json({ colaborador: colaboradorParaTela(colaborador) }),
      "colaborador",
      colaborador.id,
    )
  } catch (error) {
    console.error("[login] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

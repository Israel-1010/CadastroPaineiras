import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { compare, hashSync } from "bcryptjs"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, clientIp, setSessionCookie } from "@/lib/auth"
import { rateLimit, resetRateLimit } from "@/lib/rate-limit"
import { loginAdminSchema } from "@/lib/validation"

const INVALID = "Usuário ou senha inválidos"
// Hash de uma senha aleatória: mantém o tempo de resposta igual quando o usuário não existe
const DUMMY_HASH = hashSync(randomUUID(), 10)

export async function POST(request: NextRequest) {
  try {
    const parsed = loginAdminSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Usuário e senha são obrigatórios" }, { status: 400 })
    }
    const { username, password } = parsed.data

    const ip = clientIp(request)
    const userKey = `admin-login:${username.toLowerCase()}`
    const byIp = rateLimit(`admin-login-ip:${ip}`, 20, 15 * 60 * 1000)
    const byUser = rateLimit(userKey, 5, 15 * 60 * 1000)
    if (!byIp.ok || !byUser.ok) {
      const retry = Math.max(byIp.retryAfterSeconds, byUser.retryAfterSeconds)
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        { status: 429, headers: { "Retry-After": String(retry) } },
      )
    }

    const { data: admin, error } = await supabaseAdmin
      .from("administradores")
      .select("id, username, nome_completo, email, ativo, password_hash")
      .eq("username", username)
      .eq("ativo", true)
      .maybeSingle()

    if (error) {
      console.error("[admin-login] erro na consulta:", error.message)
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
    }

    // Só aceita hash bcrypt; senhas em texto puro no banco nunca são aceitas
    const hasHash = Boolean(admin?.password_hash?.startsWith("$2"))
    const valid = await compare(password, hasHash ? admin!.password_hash : DUMMY_HASH)

    if (!admin || !hasHash || !valid) {
      return NextResponse.json({ error: INVALID }, { status: 401 })
    }

    resetRateLimit(userKey)
    await audit({ tipo: "admin", id: admin.id }, "login", "administradores", admin.id, { ip })

    const { password_hash, ...adminData } = admin
    return setSessionCookie(NextResponse.json({ admin: adminData }), "admin", admin.id)
  } catch (error) {
    console.error("[admin-login] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

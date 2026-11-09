import { type NextRequest, NextResponse } from "next/server"
import { createHash, randomUUID, timingSafeEqual } from "crypto"
import { compare, hashSync } from "bcryptjs"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, clientIp, setSessionCookie } from "@/lib/auth"
import { limparFalhas, registrarFalha, respostaBloqueio, segundosBloqueado } from "@/lib/rate-limit"
import { loginAdminSchema } from "@/lib/validation"

const INVALID = "Usuário ou senha inválidos"
// Hash de uma senha aleatória: mantém o tempo de resposta igual quando o usuário não existe
const DUMMY_HASH = hashSync(randomUUID(), 10)

/** Comparação em tempo constante (compara os SHA-256 para não depender do tamanho) */
const sha = (s: string) => createHash("sha256").update(s).digest()
const sameText = (a: string, b: string) => timingSafeEqual(sha(a), sha(b))

export async function POST(request: NextRequest) {
  try {
    const parsed = loginAdminSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Usuário e senha são obrigatórios" }, { status: 400 })
    }
    const { username, password } = parsed.data
    const ip = clientIp(request)

    // PD-03: 5 erros no mesmo usuário (a partir do mesmo IP) ou 20 de um IP -> 15 minutos de bloqueio
    const chaveUsuario = `admin:${username.toLowerCase()}:${ip}`
    const chaveIp = ip === "local" ? null : `admin-ip:${ip}`
    const espera = Math.max(segundosBloqueado(chaveUsuario), chaveIp ? segundosBloqueado(chaveIp) : 0)
    if (espera) {
      const { body, init } = respostaBloqueio(espera)
      return NextResponse.json(body, init)
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

    const stored: string = admin?.password_hash ?? ""
    const hasHash = stored.startsWith("$2")
    // TEMPORÁRIO: aceita a senha antiga gravada em texto puro, porque com a chave atual do .env
    // (role anon) o scripts/admin-set-password.mjs não consegue gravar o hash bcrypt.
    // Remover depois de trocar SUPABASE_SERVICE_ROLE_KEY e redefinir a senha.
    let valid: boolean
    if (hasHash) {
      valid = await compare(password, stored)
    } else {
      await compare(password, DUMMY_HASH) // mantém o tempo de resposta
      valid = Boolean(admin && stored) && sameText(password, stored)
    }

    if (!admin || !valid) {
      registrarFalha(chaveUsuario, 5)
      if (chaveIp) registrarFalha(chaveIp, 20)
      return NextResponse.json({ error: INVALID }, { status: 401 })
    }

    limparFalhas(chaveUsuario)
    await audit({ tipo: "admin", id: admin.id }, "login", "administradores", admin.id, { ip })

    const { password_hash, ...adminData } = admin
    return setSessionCookie(request, NextResponse.json({ admin: adminData }), "admin", admin.id)
  } catch (error) {
    console.error("[admin-login] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

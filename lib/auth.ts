import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionRole,
} from "@/lib/session"
import type { Admin } from "@/lib/types"

export async function getSessionId(role: SessionRole) {
  const token = cookies().get(SESSION_COOKIE[role])?.value
  const session = await verifySession(token, role)
  return session?.sub ?? null
}

export const unauthorized = () => NextResponse.json({ error: "Sessão inválida ou expirada" }, { status: 401 })

/** Id do colaborador logado, ou null */
export const getColaboradorId = () => getSessionId("colaborador")

/** Admin logado e ativo, ou null. Confere no banco para que desativar um admin derrube a sessão. */
export async function getAdmin(): Promise<Admin | null> {
  const id = await getSessionId("admin")
  if (!id) return null
  const { data } = await supabaseAdmin
    .from("administradores")
    .select("id, username, nome_completo, email, ativo")
    .eq("id", id)
    .eq("ativo", true)
    .maybeSingle()
  return data
}

export async function setSessionCookie(req: Request, res: NextResponse, role: SessionRole, id: string) {
  res.cookies.set(SESSION_COOKIE[role], await signSession(id, role), sessionCookieOptions(req))
  return res
}

export function clearSessionCookie(req: Request, res: NextResponse, role: SessionRole) {
  res.cookies.set(SESSION_COOKIE[role], "", { ...sessionCookieOptions(req), maxAge: 0 })
  return res
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim()
}

/** Registro de auditoria (best effort: falha não interrompe a operação) */
export async function audit(
  ator: { tipo: SessionRole; id: string },
  acao: string,
  entidade: string,
  entidadeId: string | null,
  detalhes?: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin.from("auditoria").insert({
    ator_tipo: ator.tipo,
    ator_id: ator.id,
    acao,
    entidade,
    entidade_id: entidadeId,
    detalhes: detalhes ?? null,
  })
  if (error) console.warn("[auditoria] falha ao registrar:", error.message)
}

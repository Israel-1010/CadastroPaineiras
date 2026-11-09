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
import { MSG_SEM_PERMISSAO, perfilDe, pode, type Permissao } from "@/lib/permissoes"

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
  // select("*"): funciona com ou sem a coluna perfil (009_perfil_rh.sql)
  const { data } = await supabaseAdmin.from("administradores").select("*").eq("id", id).eq("ativo", true).maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    username: data.username,
    nome_completo: data.nome_completo,
    email: data.email,
    ativo: data.ativo,
    perfil: perfilDe(data.perfil),
  }
}

/**
 * Admin logado com a permissão pedida. Uso:
 *   const auth = await exigirAdmin("facial"); if ("resposta" in auth) return auth.resposta
 */
export async function exigirAdmin(permissao: Permissao): Promise<{ admin: Admin } | { resposta: NextResponse }> {
  const admin = await getAdmin()
  if (!admin) return { resposta: unauthorized() }
  if (!pode(admin.perfil, permissao)) return { resposta: NextResponse.json({ error: MSG_SEM_PERMISSAO }, { status: 403 }) }
  return { admin }
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

// Sessão em cookie httpOnly assinado com HMAC-SHA256.
// Usa só Web Crypto para funcionar tanto no middleware (edge) quanto nas rotas (node).

export type SessionRole = "colaborador" | "admin"

export interface SessionPayload {
  sub: string
  role: SessionRole
  exp: number
}

export const SESSION_COOKIE: Record<SessionRole, string> = {
  colaborador: "cad_session",
  admin: "cad_admin_session",
}

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

const encoder = new TextEncoder()

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres)")
  }
  return secret
}

function toBase64Url(bytes: Uint8Array) {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", encoder.encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ])
}

export async function signSession(sub: string, role: SessionRole) {
  const payload: SessionPayload = { sub, role, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS }
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body)))
  return `${body}.${toBase64Url(sig)}`
}

export async function verifySession(token: string | undefined, role: SessionRole): Promise<SessionPayload | null> {
  if (!token) return null
  const [body, sig] = token.split(".")
  if (!body || !sig) return null
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromBase64Url(sig), encoder.encode(body))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload
    if (payload.role !== role || typeof payload.sub !== "string") return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// Cookie "Secure" só quando o acesso é por HTTPS (direto ou via proxy que envia x-forwarded-proto);
// em HTTP o navegador descartaria o cookie. COOKIE_SECURE=true|false força o valor.
function isSecureRequest(req: Request) {
  if (process.env.COOKIE_SECURE === "true") return true
  if (process.env.COOKIE_SECURE === "false") return false
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim()
  return (proto ?? new URL(req.url).protocol.replace(":", "")) === "https"
}

export function sessionCookieOptions(req: Request) {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

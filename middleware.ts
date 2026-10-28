import { type NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE, verifySession } from "@/lib/session"

// Primeira barreira: bloqueia páginas e APIs sem sessão válida.
// As rotas de API também checam a sessão (e o admin no banco) por conta própria.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin")
  const isPublic =
    pathname === "/admin/login" ||
    pathname === "/api/admin/auth/login" ||
    pathname === "/api/admin/auth/logout"

  if (isAdminArea) {
    if (isPublic) return NextResponse.next()
    const session = await verifySession(request.cookies.get(SESSION_COOKIE.admin)?.value, "admin")
    if (session) return NextResponse.next()
    return deny(request, "/admin/login")
  }

  // Área do colaborador
  const session = await verifySession(request.cookies.get(SESSION_COOKIE.colaborador)?.value, "colaborador")
  if (session) return NextResponse.next()
  return deny(request, "/login")
}

function deny(request: NextRequest, loginPath: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessão inválida ou expirada" }, { status: 401 })
  }
  return NextResponse.redirect(new URL(loginPath, request.url))
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/dependentes/:path*",
    "/api/upload",
    "/api/dahua/:path*",
  ],
}

import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { clientIp, getColaboradorId, unauthorized } from "@/lib/auth"
import { termoAceito } from "@/lib/aceite"
import { TERMO_VERSAO } from "@/lib/termo"

/** PD-04: registra o aceite da versão atual do termo (com data, IP e aparelho) */
export async function POST(request: NextRequest) {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const body = await request.json().catch(() => ({}))
    // A tela manda a versão que exibiu: se o termo mudou nesse meio-tempo, o colaborador lê de novo
    if (body?.versao !== TERMO_VERSAO) {
      return NextResponse.json({ error: "O termo foi atualizado. Leia a nova versão.", versao: TERMO_VERSAO }, { status: 409 })
    }

    if (!(await termoAceito(colaboradorId))) {
      const { error } = await supabaseAdmin.from("aceites_termo").insert({
        colaborador_id: colaboradorId,
        versao: TERMO_VERSAO,
        ip: clientIp(request),
        dispositivo: (request.headers.get("user-agent") ?? "").slice(0, 300),
      })
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ ok: true, versao: TERMO_VERSAO })
  } catch (error) {
    console.error("[termo] erro ao registrar aceite:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao registrar o aceite" }, { status: 500 })
  }
}

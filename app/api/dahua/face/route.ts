import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { getColaboradorId, unauthorized } from "@/lib/auth"
import { syncFace } from "@/lib/dahua"
import { getObject, photoKeyFromUrl } from "@/lib/s3"

export const runtime = "nodejs"

// Sincroniza a face de um dependente do colaborador logado com os terminais Dahua.
// CPF, nome e foto vêm do banco; IPs e credenciais, do ambiente.
export async function POST(req: Request) {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const dependenteId = typeof body?.dependente_id === "string" ? body.dependente_id : ""
    if (!dependenteId) return NextResponse.json({ error: "dependente_id é obrigatório" }, { status: 400 })

    const { data: dependente, error } = await supabaseAdmin
      .from("dependentes")
      .select("cpf, nome_completo, foto_url")
      .eq("id", dependenteId)
      .eq("colaborador_id", colaboradorId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!dependente) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    const key = photoKeyFromUrl(dependente.foto_url)
    if (!key) return NextResponse.json({ error: "Dependente sem foto válida" }, { status: 400 })

    const result = await syncFace(dependente.cpf, dependente.nome_completo, await getObject(key))
    if (!result.ok) {
      console.warn("[dahua/face] falha em todos os terminais:", JSON.stringify(result.results))
      return NextResponse.json({ error: "Falha ao cadastrar a face nos terminais" }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[dahua/face] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao sincronizar a face" }, { status: 500 })
  }
}

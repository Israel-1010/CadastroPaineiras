import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, getAdmin, unauthorized } from "@/lib/auth"
import { removeFace } from "@/lib/dahua"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdmin()
    if (!admin) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const { presenca_confirmada } = body
    if (typeof presenca_confirmada !== "boolean") {
      return NextResponse.json({ error: "Campo presenca_confirmada deve ser um boolean" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("dependentes")
      .update({
        presenca_confirmada,
        presenca_confirmada_em: presenca_confirmada ? new Date().toISOString() : null,
      })
      .eq("id", params.id)
      .select("id, presenca_confirmada")
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    await audit({ tipo: "admin", id: admin.id }, "presenca", "dependentes", params.id, { presenca_confirmada })
    return NextResponse.json({ dependente: data })
  } catch (error) {
    console.error("[admin/dependentes] erro ao atualizar presença:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao atualizar presença" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdmin()
    if (!admin) return unauthorized()

    const { data, error } = await supabaseAdmin
      .from("dependentes")
      .delete()
      .eq("id", params.id)
      .select("id, cpf, nome_completo, colaborador_id")
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: "Dependente não encontrado" }, { status: 404 })

    // Dependente excluído não deve continuar com acesso pelos terminais faciais
    await removeFace(data.cpf)
    await audit({ tipo: "admin", id: admin.id }, "excluir", "dependentes", data.id, {
      nome_completo: data.nome_completo,
      colaborador_id: data.colaborador_id,
    })

    return NextResponse.json({ message: "Dependente excluído com sucesso" })
  } catch (error) {
    console.error("[admin/dependentes] erro ao excluir:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao excluir dependente" }, { status: 500 })
  }
}

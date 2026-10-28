import { NextResponse } from "next/server"
import { fetchAll, supabaseAdmin } from "@/lib/supabase/server"
import { getAdmin, unauthorized } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (!(await getAdmin())) return unauthorized()

    const { count: totalColaboradores, error: countError } = await supabaseAdmin
      .from("colaboradores")
      .select("id", { count: "exact", head: true })
    if (countError) throw new Error(countError.message)

    const dependentes = await fetchAll<{ dependencia: string; genero: string; colaborador_id: string }>((from, to) =>
      supabaseAdmin.from("dependentes").select("dependencia, genero, colaborador_id").order("id").range(from, to),
    )

    const contar = (campo: "dependencia" | "genero") =>
      dependentes.reduce<Record<string, number>>((acc, dep) => {
        acc[dep[campo]] = (acc[dep[campo]] || 0) + 1
        return acc
      }, {})

    const colaboradoresComDependentes = new Set(dependentes.map((dep) => dep.colaborador_id)).size

    return NextResponse.json({
      data: {
        totalColaboradores: totalColaboradores ?? 0,
        totalDependentes: dependentes.length,
        dependentesPorTipo: contar("dependencia"),
        dependentesPorGenero: contar("genero"),
        colaboradoresComDependentes,
        colaboradoresSemDependentes: (totalColaboradores ?? 0) - colaboradoresComDependentes,
      },
      message: "Relatórios gerados com sucesso",
    })
  } catch (error) {
    console.error("[admin/relatorios] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

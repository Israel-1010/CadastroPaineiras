import { type NextRequest, NextResponse } from "next/server"
import { fetchAll, isUniqueViolation, supabaseAdmin } from "@/lib/supabase/server"
import { audit, getAdmin, unauthorized } from "@/lib/auth"
import { colaboradorSchema, firstIssue } from "@/lib/validation"

export const dynamic = "force-dynamic"

const DUPLICATE_LABEL: Record<string, string> = { re: "RE", cpf: "CPF", email: "Email" }
const duplicateField = (column = "") => DUPLICATE_LABEL[column] ?? "Registro"

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdmin()
    if (!admin) return unauthorized()

    const parsed = colaboradorSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })

    const { data: colaborador, error } = await supabaseAdmin
      .from("colaboradores")
      .insert(parsed.data)
      .select("id, re, cpf, nome_completo, email, created_at")
      .single()

    if (isUniqueViolation(error)) {
      // O nome da constraint (ex.: colaboradores_cpf_key) indica o campo duplicado
      const field = duplicateField(error?.message.match(/"colaboradores_(\w+?)_key"/)?.[1])
      return NextResponse.json({ error: `${field} já cadastrado no sistema` }, { status: 409 })
    }
    if (error) throw new Error(error.message)

    await audit({ tipo: "admin", id: admin.id }, "criar", "colaboradores", colaborador.id)
    return NextResponse.json({ colaborador, message: "Colaborador cadastrado com sucesso" })
  } catch (error) {
    console.error("[admin/colaboradores] erro ao cadastrar:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function GET() {
  try {
    if (!(await getAdmin())) return unauthorized()

    const colaboradores = await fetchAll((from, to) =>
      supabaseAdmin
        .from("colaboradores")
        .select("id, re, cpf, nome_completo, email, created_at, dependentes:dependentes(count)")
        .order("nome_completo")
        .range(from, to),
    )

    return NextResponse.json({ colaboradores })
  } catch (error) {
    console.error("[admin/colaboradores] erro ao listar:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao buscar colaboradores" }, { status: 500 })
  }
}

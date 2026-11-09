import { type NextRequest, NextResponse } from "next/server"
import { fetchAll, isUniqueViolation, supabaseAdmin } from "@/lib/supabase/server"
import { audit, exigirAdmin } from "@/lib/auth"
import { dependenteSchema, firstIssue } from "@/lib/validation"

export const dynamic = "force-dynamic"

const MSG_CPF_DUPLICADO = "Já existe um dependente cadastrado com este CPF."

/**
 * Cadastro manual de dependente pelo admin (o colaborador não cadastra nem edita).
 * Body: { re, nome_completo, cpf, genero, dependencia, data_nascimento }. A foto o colaborador tira depois.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await exigirAdmin("cadastro")
    if ("resposta" in auth) return auth.resposta
    const { admin } = auth

    const body = await request.json().catch(() => ({}))
    const re = typeof body?.re === "string" ? body.re.trim() : ""
    if (!re) return NextResponse.json({ error: "Informe o RE do colaborador" }, { status: 400 })

    const parsed = dependenteSchema.omit({ foto_url: true }).safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
    const input = parsed.data

    const { data: colaborador, error: colError } = await supabaseAdmin
      .from("colaboradores")
      .select("id")
      .eq("re", re)
      .maybeSingle()
    if (colError) throw new Error(colError.message)
    if (!colaborador) return NextResponse.json({ error: `Nenhum colaborador com RE ${re}` }, { status: 404 })

    // Checagem explícita: a constraint UNIQUE de CPF só existe depois do 005_seguranca.sql
    const { data: existente, error: dupError } = await supabaseAdmin
      .from("dependentes")
      .select("id")
      .eq("cpf", input.cpf)
      .limit(1)
    if (dupError) throw new Error(dupError.message)
    if (existente?.length) return NextResponse.json({ error: MSG_CPF_DUPLICADO }, { status: 409 })

    const { data, error } = await supabaseAdmin
      .from("dependentes")
      .insert({ ...input, colaborador_id: colaborador.id })
      .select("*, colaborador:colaboradores(nome_completo, re)")
      .single()
    if (isUniqueViolation(error)) return NextResponse.json({ error: MSG_CPF_DUPLICADO }, { status: 409 })
    if (error) throw new Error(error.message)

    await audit({ tipo: "admin", id: admin.id }, "criar", "dependentes", data.id, { colaborador_re: re })
    return NextResponse.json({ dependente: data })
  } catch (error) {
    console.error("[admin/dependentes] erro ao cadastrar:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const auth = await exigirAdmin("cadastro")
    if ("resposta" in auth) return auth.resposta

    const dependentes = await fetchAll((from, to) =>
      supabaseAdmin
        .from("dependentes")
        .select("*, colaborador:colaboradores(nome_completo, re)")
        .order("nome_completo")
        .range(from, to),
    )

    // perfil: a tela esconde o que o usuário não pode usar (o servidor bloqueia de qualquer forma)
    return NextResponse.json({ dependentes, perfil: auth.admin.perfil })
  } catch (error) {
    console.error("[admin/dependentes] erro ao listar:", (error as Error).message)
    return NextResponse.json({ error: "Erro ao buscar dependentes" }, { status: 500 })
  }
}

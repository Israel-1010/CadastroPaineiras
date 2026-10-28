import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, getAdmin, unauthorized } from "@/lib/auth"
import { chunk, normalizeCpfCell, readImportFile } from "@/lib/planilha"
import { colaboradorSchema, firstIssue } from "@/lib/validation"
import type { ImportResult } from "@/lib/types"

export const runtime = "nodejs"

type Linha = { row: number; re: string; cpf: string; nome_completo: string; email: string }

async function existentes(coluna: "re" | "cpf" | "email", valores: string[]) {
  const set = new Set<string>()
  for (const lote of chunk(valores, 200)) {
    const { data, error } = await supabaseAdmin.from("colaboradores").select(coluna).in(coluna, lote)
    if (error) throw new Error(error.message)
    for (const r of data as Record<string, string>[]) set.add(String(r[coluna]).toLowerCase())
  }
  return set
}

// Colunas: RE, CPF, Nome Completo, Email
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdmin()
    if (!admin) return unauthorized()

    let rows
    try {
      rows = await readImportFile((await request.formData()).get("file"))
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 })
    }

    const result: ImportResult = { success: 0, errors: [], duplicates: [] }
    const validas: Linha[] = []
    const vistos = { re: new Set<string>(), cpf: new Set<string>(), email: new Set<string>() }

    for (const { row, cells } of rows) {
      const [re = "", cpf = "", nome_completo = "", email = ""] = cells
      const parsed = colaboradorSchema.safeParse({ re, cpf: normalizeCpfCell(cpf), nome_completo, email })
      if (!parsed.success) {
        result.errors.push({ row, error: firstIssue(parsed.error) })
        continue
      }
      const linha = { row, ...parsed.data }
      // Duplicadas dentro do próprio arquivo
      const repetido = (["re", "cpf", "email"] as const).find((c) => vistos[c].has(linha[c].toLowerCase()))
      if (repetido) {
        result.duplicates.push({ row, field: `${repetido.toUpperCase()} (repetido no arquivo)`, value: linha[repetido] })
        continue
      }
      for (const c of ["re", "cpf", "email"] as const) vistos[c].add(linha[c].toLowerCase())
      validas.push(linha)
    }

    // Duplicadas já existentes no banco (consulta em lote)
    const [reDb, cpfDb, emailDb] = await Promise.all([
      existentes("re", validas.map((l) => l.re)),
      existentes("cpf", validas.map((l) => l.cpf)),
      existentes("email", validas.map((l) => l.email)),
    ])
    const novas = validas.filter((l) => {
      const campo = reDb.has(l.re.toLowerCase())
        ? "RE"
        : cpfDb.has(l.cpf)
          ? "CPF"
          : emailDb.has(l.email.toLowerCase())
            ? "Email"
            : null
      if (campo) {
        result.duplicates.push({ row: l.row, field: campo, value: campo === "RE" ? l.re : campo === "CPF" ? l.cpf : l.email })
      }
      return !campo
    })

    // Insere em lotes; se um lote falhar, tenta linha a linha para apontar qual deu erro
    for (const lote of chunk(novas, 200)) {
      const registros = lote.map(({ row, ...dados }) => dados)
      const { error } = await supabaseAdmin.from("colaboradores").insert(registros)
      if (!error) {
        result.success += lote.length
        continue
      }
      for (const { row, ...dados } of lote) {
        const { error: rowError } = await supabaseAdmin.from("colaboradores").insert(dados)
        if (rowError) result.errors.push({ row, error: rowError.code === "23505" ? "Registro duplicado" : "Erro ao inserir no banco de dados" })
        else result.success++
      }
    }

    await audit({ tipo: "admin", id: admin.id }, "importar", "colaboradores", null, {
      sucesso: result.success,
      erros: result.errors.length,
      duplicados: result.duplicates.length,
    })

    return NextResponse.json({ result, message: `Processamento concluído. ${result.success} colaboradores importados.` })
  } catch (error) {
    console.error("[upload-excel] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

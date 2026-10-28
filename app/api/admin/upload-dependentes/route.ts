import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { audit, getAdmin, unauthorized } from "@/lib/auth"
import { chunk, normalizeCpfCell, normalizeDate, readImportFile } from "@/lib/planilha"
import { dependenteSchema, firstIssue } from "@/lib/validation"
import { DEPENDENCIAS, type ImportResult } from "@/lib/types"

export const runtime = "nodejs"

// Gênero é opcional na planilha: quando vazio, é deduzido do parentesco
const GENERO_POR_DEPENDENCIA: Record<string, string> = {
  Filho: "Masculino",
  Esposo: "Masculino",
  Filha: "Feminino",
  Esposa: "Feminino",
}

/** "filho", "FILHO " -> "Filho" */
function normalizeEnum(value: string, opcoes: readonly string[]) {
  const v = value.trim().toLowerCase()
  return opcoes.find((o) => o.toLowerCase() === v) ?? value.trim()
}

type Linha = { row: number; re: string; dados: Record<string, string> }

// Colunas: RE Colaborador, CPF Dependente, Nome Completo, Data Nascimento, Parentesco, Gênero (opcional)
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
    const cpfsVistos = new Set<string>()

    for (const { row, cells } of rows) {
      const [re = "", cpf = "", nome_completo = "", data = "", parentesco = "", generoCelula = ""] = cells
      if (!re.trim()) {
        result.errors.push({ row, error: "RE do colaborador é obrigatório" })
        continue
      }
      const dependencia = normalizeEnum(parentesco, DEPENDENCIAS)
      const genero = normalizeEnum(generoCelula, ["Masculino", "Feminino"]) || GENERO_POR_DEPENDENCIA[dependencia] || ""
      const parsed = dependenteSchema.safeParse({
        nome_completo,
        cpf: normalizeCpfCell(cpf),
        genero,
        dependencia,
        data_nascimento: normalizeDate(data),
      })
      if (!parsed.success) {
        const msg = firstIssue(parsed.error)
        result.errors.push({
          row,
          error: msg === "Dependência inválida" ? `Parentesco inválido. Use: ${DEPENDENCIAS.join(", ")}` : msg,
        })
        continue
      }
      if (cpfsVistos.has(parsed.data.cpf)) {
        result.duplicates.push({ row, field: "CPF (repetido no arquivo)", value: parsed.data.cpf })
        continue
      }
      cpfsVistos.add(parsed.data.cpf)
      const { foto_url, ...dados } = parsed.data
      validas.push({ row, re: re.trim(), dados })
    }

    // Busca colaboradores e CPFs existentes em lote
    const colaboradorPorRe = new Map<string, string>()
    for (const lote of chunk([...new Set(validas.map((l) => l.re))], 200)) {
      const { data, error } = await supabaseAdmin.from("colaboradores").select("id, re").in("re", lote)
      if (error) throw new Error(error.message)
      for (const c of data) colaboradorPorRe.set(c.re, c.id)
    }
    const cpfsNoBanco = new Set<string>()
    for (const lote of chunk(validas.map((l) => l.dados.cpf), 200)) {
      const { data, error } = await supabaseAdmin.from("dependentes").select("cpf").in("cpf", lote)
      if (error) throw new Error(error.message)
      for (const d of data) cpfsNoBanco.add(d.cpf)
    }

    const novas: Array<{ row: number; registro: Record<string, string> }> = []
    for (const l of validas) {
      const colaboradorId = colaboradorPorRe.get(l.re)
      if (!colaboradorId) {
        result.errors.push({ row: l.row, error: `Colaborador com RE ${l.re} não encontrado` })
      } else if (cpfsNoBanco.has(l.dados.cpf)) {
        result.duplicates.push({ row: l.row, field: "CPF", value: l.dados.cpf })
      } else {
        novas.push({ row: l.row, registro: { ...l.dados, colaborador_id: colaboradorId } })
      }
    }

    // Insere em lotes; se um lote falhar, tenta linha a linha para apontar qual deu erro
    for (const lote of chunk(novas, 200)) {
      const { error } = await supabaseAdmin.from("dependentes").insert(lote.map((l) => l.registro))
      if (!error) {
        result.success += lote.length
        continue
      }
      for (const { row, registro } of lote) {
        const { error: rowError } = await supabaseAdmin.from("dependentes").insert(registro)
        if (rowError) result.errors.push({ row, error: rowError.code === "23505" ? "CPF duplicado" : "Erro ao inserir no banco de dados" })
        else result.success++
      }
    }

    await audit({ tipo: "admin", id: admin.id }, "importar", "dependentes", null, {
      sucesso: result.success,
      erros: result.errors.length,
      duplicados: result.duplicates.length,
    })

    return NextResponse.json({ result, message: `Processamento concluído. ${result.success} dependentes importados.` })
  } catch (error) {
    console.error("[upload-dependentes] erro:", (error as Error).message)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

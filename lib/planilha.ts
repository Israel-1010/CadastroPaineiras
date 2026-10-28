// Leitura de planilhas de importação (.xlsx ou .csv separado por "," ou ";").
import ExcelJS from "exceljs"

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_ROWS = 5000

export interface PlanilhaRow {
  /** Número da linha na planilha (1 = cabeçalho) */
  row: number
  cells: string[]
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    // Excel grava datas sem fuso; o exceljs entrega em UTC
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === "object") {
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue)
    if ("text" in value) return String(value.text)
    if ("richText" in value) return value.richText.map((t) => t.text).join("")
    return ""
  }
  return String(value)
}

async function readXlsx(buffer: ArrayBuffer): Promise<PlanilhaRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []
  const rows: PlanilhaRow[] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = row.values as ExcelJS.CellValue[] // índice 0 é vazio
    rows.push({ row: rowNumber, cells: values.slice(1).map((v) => cellToString(v).trim()) })
  })
  return rows
}

/** Parser CSV com suporte a aspas e detecção de separador pelo cabeçalho */
function readCsv(text: string): PlanilhaRow[] {
  text = text.replace(/^﻿/, "")
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","

  const rows: PlanilhaRow[] = []
  let cells: string[] = []
  let cell = ""
  let quoted = false
  let line = 1
  let rowStart = 1
  const pushRow = () => {
    cells.push(cell.trim())
    if (cells.some((c) => c !== "")) rows.push({ row: rowStart, cells })
    cells = []
    cell = ""
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else {
        if (ch === "\n") line++
        cell += ch
      }
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      cells.push(cell.trim())
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      pushRow()
      line++
      rowStart = line
    } else cell += ch
  }
  if (cell !== "" || cells.length) pushRow()
  return rows
}

export async function readPlanilha(file: File): Promise<PlanilhaRow[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith(".xlsx")) return readXlsx(await file.arrayBuffer())
  if (name.endsWith(".csv")) return readCsv(await file.text())
  throw new Error("Formato não suportado. Envie um arquivo .xlsx ou .csv")
}

/** Valida arquivo e devolve as linhas de dados (sem o cabeçalho) */
export async function readImportFile(file: unknown): Promise<PlanilhaRow[]> {
  if (!(file instanceof File)) throw new Error("Nenhum arquivo enviado")
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Arquivo muito grande (máximo 5MB)")
  const rows = await readPlanilha(file)
  if (rows.length < 2) throw new Error("Arquivo deve conter o cabeçalho e pelo menos uma linha de dados")
  if (rows.length - 1 > MAX_IMPORT_ROWS) throw new Error(`Máximo de ${MAX_IMPORT_ROWS} linhas por arquivo`)
  return rows.slice(1)
}

/** Aceita AAAA-MM-DD ou DD/MM/AAAA e devolve AAAA-MM-DD */
export function normalizeDate(value: string) {
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`
  return value.trim().slice(0, 10)
}

/** CPF vindo do Excel como número perde zeros à esquerda; os dígitos verificadores validam o resultado */
export function normalizeCpfCell(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 9 && digits.length < 11 ? digits.padStart(11, "0") : digits
}

export function chunk<T>(items: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

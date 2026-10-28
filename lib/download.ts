/** Arquivos aceitos na importação (validação por extensão: o MIME de CSV varia entre sistemas) */
export const isPlanilhaFile = (name: string) => /\.(xlsx|csv)$/i.test(name)

/** Baixa um CSV separado por ";" com BOM, que o Excel em português abre direto em colunas */
export function downloadCsv(filename: string, rows: string[][]) {
  const content = "﻿" + rows.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

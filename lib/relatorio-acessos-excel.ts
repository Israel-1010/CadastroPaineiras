// Excel de acessos: resumo (com o logo) e uma aba para cada lista do dashboard.
import { baixarArquivo, carregarLogo, type LinhaValor, type RelatorioAcessos, type Tabela } from "@/lib/relatorio-acessos"

const ROSA = "FFEC008B"
const CINZA = "FF52514E"
const FUNDO = "FFF6F6F4"

export async function gerarExcelAcessos(r: RelatorioAcessos) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("exceljs")
  const ExcelJS = mod.default ?? mod
  const wb = new ExcelJS.Workbook()
  wb.creator = "Atualização Cadastral - Clube Paineiras"
  wb.created = new Date()

  // ---------- Resumo ----------
  const ws = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] })
  ws.columns = [{ width: 44 }, { width: 14 }, { width: 10 }]
  let linha = 1
  const logo = await carregarLogo()
  if (logo) {
    const id = wb.addImage({ base64: logo.dataUrl, extension: logo.extensao })
    const altura = 56
    ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: Math.round(altura * (logo.largura / logo.altura)), height: altura } })
    ws.getRow(1).height = 46
    linha = 3
  }
  const texto = (valor: string, fonte: Record<string, unknown>) => {
    const c = ws.getCell(`A${linha++}`)
    c.value = valor
    c.font = fonte
  }
  texto("Relatório de Acessos", { bold: true, size: 16 })
  texto(`Período: ${r.periodo}`, { size: 11 })
  texto(`Gerado em ${r.geradoEm}`, { size: 9, color: { argb: CINZA } })
  if (r.filtros.length) texto(`Filtros: ${r.filtros.join(" · ")}`, { size: 9, color: { argb: CINZA } })
  linha++

  const cabecalho = (row: { eachCell: (f: (c: { fill: unknown; font: unknown; alignment: unknown }) => void) => void }) =>
    row.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROSA } }
      c.font = { bold: true, color: { argb: "FFFFFFFF" } }
      c.alignment = { vertical: "middle" }
    })

  /** Bloco "título | quantidade | %" (% como fração formatada) */
  const bloco = (titulo: string, itens: LinhaValor[], total?: number) => {
    const head = ws.getRow(linha++)
    head.values = total != null ? [titulo, "Quantidade", "%"] : [titulo, "Quantidade"]
    cabecalho(head)
    for (const it of itens) {
      const row = ws.getRow(linha++)
      row.values = [it.detalhe ? `${it.rotulo} (${it.detalhe})` : it.rotulo, it.valor, ...(total != null ? [total ? it.valor / total : 0] : [])]
      row.getCell(2).numFmt = "#,##0"
      if (total != null) row.getCell(3).numFmt = "0%"
    }
    linha++
  }

  const m = r.movimento
  bloco("Movimento", [
    { rotulo: "Entradas", valor: m.entradas },
    { rotulo: "Saídas", valor: m.saidas },
    { rotulo: "Total de acessos", valor: m.entradas + m.saidas },
    { rotulo: "Pessoas diferentes", valor: m.pessoas },
    { rotulo: m.dentroRotulo, valor: m.dentro, detalhe: "última passagem pela entrada" },
    { rotulo: "Leituras de rosto", valor: m.leituras },
  ])
  bloco("Por tipo (pessoas diferentes)", r.porTipo, m.pessoas)
  bloco("Homens, mulheres e crianças (até 11 anos)", r.perfil, m.pessoas)
  if (r.catracas.length) bloco("Por catraca (acessos)", r.catracas, m.entradas + m.saidas)
  if (r.aptos.total) {
    bloco("Dependentes com foto aceita", [
      { rotulo: "Entraram", valor: r.aptos.entraram },
      { rotulo: "Não entraram", valor: r.aptos.total - r.aptos.entraram },
    ], r.aptos.total)
  }

  // ---------- Abas de listas ----------
  const aba = (nome: string, t: Tabela, totais?: Array<string | number>) => {
    const s = wb.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 1 }] })
    s.addRow(t.colunas)
    cabecalho(s.getRow(1))
    for (const l of t.linhas) s.addRow(l)
    if (totais) {
      const row = s.addRow(totais)
      row.eachCell((c: { font: unknown; fill: unknown }) => {
        c.font = { bold: true }
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FUNDO } }
      })
    }
    if (t.linhas.length) s.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.colunas.length } }
    // Largura pelo maior texto da coluna (limite de 50)
    t.colunas.forEach((c, i) => {
      const maior = Math.max(String(c).length, ...t.linhas.map((l) => String(l[i] ?? "").length))
      s.getColumn(i + 1).width = Math.min(50, Math.max(10, maior + 2))
    })
  }

  const totalE = r.grafico.reduce((s, b) => s + b.entrada, 0)
  const totalS = r.grafico.reduce((s, b) => s + b.saida, 0)
  // Por hora: quantos estavam no clube ao fim de cada hora (mesma regra do "No clube agora")
  const comDentro = r.porHora && r.grafico.every((b) => b.dentro != null)
  aba(
    r.porHora ? "Por hora" : "Por dia",
    {
      colunas: [r.porHora ? "Hora" : "Dia", "Entradas", "Saídas", "Total", ...(comDentro ? ["No clube ao fim da hora"] : [])],
      linhas: r.grafico.map((b) => {
        const linha = [b.rotulo, b.entrada, b.saida, b.entrada + b.saida]
        return comDentro ? [...linha, b.dentro!] : linha
      }),
    },
    ["Total", totalE, totalS, totalE + totalS],
  )
  aba("Quem passou", r.pessoas)
  aba("Linha do tempo", r.linhaDoTempo)
  aba("Não entraram", r.naoEntraram)

  const buffer = await wb.xlsx.writeBuffer()
  baixarArquivo(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `relatorio-${r.nomeArquivo}.xlsx`,
  )
}

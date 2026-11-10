// PDF de acessos para a diretoria: cabeçalho com o logo, indicadores, gráfico por hora e tabelas.
import { jsPDF } from "jspdf"
import { autoTable } from "jspdf-autotable"
import { carregarLogo, percentual, type LinhaValor, type RelatorioAcessos } from "@/lib/relatorio-acessos"

type Cor = [number, number, number]
const ROSA: Cor = [236, 0, 139] // identidade do clube
const AZUL: Cor = [42, 120, 214] // entradas (mesma cor do dashboard)
const LARANJA: Cor = [235, 104, 52] // saídas
const TINTA: Cor = [11, 11, 11]
const TINTA2: Cor = [82, 81, 78]
const MUDO: Cor = [137, 135, 129]
const GRADE: Cor = [225, 224, 217]
const EIXO: Cor = [195, 194, 183]
const FUNDO: Cor = [246, 246, 244]

const A4_LARGURA = 210
const A4_ALTURA = 297
const MARGEM = 14
const UTIL = A4_LARGURA - 2 * MARGEM

const n = (v: number) => v.toLocaleString("pt-BR")

/** Passo "redondo" (1, 2, 5 x 10^k) para o eixo */
function passoRedondo(bruto: number) {
  const pot = 10 ** Math.floor(Math.log10(Math.max(bruto, 1)))
  const f = bruto / pot
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot
}

type Doc = jsPDF & { lastAutoTable?: { finalY: number } }

export async function gerarPdfAcessos(r: RelatorioAcessos) {
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as Doc
  const logo = await carregarLogo()
  const cor = (c: Cor, tipo: "texto" | "fundo" | "linha") =>
    tipo === "texto" ? doc.setTextColor(...c) : tipo === "fundo" ? doc.setFillColor(...c) : doc.setDrawColor(...c)
  const fonte = (tamanho: number, estilo: "normal" | "bold" = "normal", c: Cor = TINTA) => {
    doc.setFont("helvetica", estilo)
    doc.setFontSize(tamanho)
    cor(c, "texto")
  }

  // ---------- Cabeçalho ----------
  let y = MARGEM
  let xTitulo = MARGEM
  if (logo) {
    const razao = logo.largura / logo.altura
    let h = 18
    let w = h * razao
    if (w > 48) {
      w = 48
      h = w / razao
    }
    doc.addImage(logo.dataUrl, logo.formato, MARGEM, y + (18 - h) / 2, w, h)
    xTitulo = MARGEM + w + 6
  } else {
    fonte(15, "bold", ROSA)
    doc.text("CLUBE PAINEIRAS", MARGEM, y + 8)
    xTitulo = MARGEM
  }
  if (logo) {
    fonte(18, "bold")
    doc.text("Relatório de Acessos", xTitulo, y + 8)
    fonte(9.5, "normal", TINTA2)
    doc.text("Catracas faciais · Clube Paineiras", xTitulo, y + 14)
  } else {
    fonte(18, "bold")
    doc.text("Relatório de Acessos", MARGEM, y + 16)
  }
  fonte(12, "bold")
  doc.text(r.periodo, A4_LARGURA - MARGEM, y + 8, { align: "right" })
  fonte(8, "normal", MUDO)
  doc.text(`Gerado em ${r.geradoEm}`, A4_LARGURA - MARGEM, y + 14, { align: "right" })
  y += logo ? 22 : 21
  cor(ROSA, "linha")
  doc.setLineWidth(0.8)
  doc.line(MARGEM, y, A4_LARGURA - MARGEM, y)
  y += 6
  if (r.filtros.length) {
    fonte(8.5, "normal", TINTA2)
    doc.text(`Filtros: ${r.filtros.join(" · ")}`, MARGEM, y)
    y += 5
  }

  // ---------- Indicadores ----------
  const cartao = (x: number, yy: number, w: number, rotulo: string, valor: string, marca?: Cor, detalhe?: string) => {
    cor(FUNDO, "fundo")
    doc.roundedRect(x, yy, w, 22, 2, 2, "F")
    let xr = x + 4
    if (marca) {
      cor(marca, "fundo")
      doc.rect(x + 4, yy + 4.1, 2.6, 2.6, "F")
      xr += 4
    }
    fonte(8, "normal", TINTA2)
    doc.text(rotulo, xr, yy + 6.3)
    fonte(18, "bold")
    doc.text(valor, x + 4, yy + 15.5)
    if (detalhe) {
      fonte(6.8, "normal", MUDO)
      doc.text(detalhe, x + 4, yy + 19.6, { maxWidth: w - 8 })
    }
  }
  const linhaCartoes = (itens: Array<[string, string, Cor?, string?]>) => {
    const gap = 4
    const w = (UTIL - gap * (itens.length - 1)) / itens.length
    itens.forEach(([rot, val, marca, det], i) => cartao(MARGEM + i * (w + gap), y, w, rot, val, marca, det))
    y += 26
  }
  const m = r.movimento
  linhaCartoes([
    ["Entradas", n(m.entradas), AZUL],
    ["Saídas", n(m.saidas), LARANJA],
    ["Total de acessos", n(m.entradas + m.saidas)],
    ["Pessoas diferentes", n(m.pessoas)],
  ])
  const perfil = (rotulo: string) => r.perfil.find((p) => p.rotulo.startsWith(rotulo))?.valor ?? 0
  linhaCartoes([
    ["Homens", n(perfil("Homens"))],
    ["Mulheres", n(perfil("Mulheres"))],
    ["Crianças", n(perfil("Crianças")), undefined, "até 11 anos"],
    [m.dentroRotulo, n(m.dentro), undefined, "última passagem pela entrada"],
  ])

  // ---------- Gráfico ----------
  y += 2
  fonte(11, "bold")
  doc.text(`Entradas e saídas por ${r.porHora ? "hora" : "dia"}`, MARGEM, y)
  // Legenda (cor + nome: a identidade nunca fica só na cor)
  const legenda = (x: number, c: Cor, txt: string) => {
    cor(c, "fundo")
    doc.rect(x, y - 2.6, 2.8, 2.8, "F")
    fonte(8, "normal", TINTA2)
    doc.text(txt, x + 4, y)
  }
  legenda(A4_LARGURA - MARGEM - 40, AZUL, "Entradas")
  legenda(A4_LARGURA - MARGEM - 19, LARANJA, "Saídas")
  y += 5

  const g = r.grafico
  const alturaGrafico = 62
  if (g.length === 0) {
    fonte(9, "normal", MUDO)
    doc.text("Nenhum acesso no período.", MARGEM, y + 8)
    y += 16
  } else {
    const x0 = MARGEM + 10
    const largura = UTIL - 10
    const base = y + alturaGrafico
    const maximo = Math.max(1, ...g.map((b) => Math.max(b.entrada, b.saida)))
    const passo = passoRedondo(maximo / 4)
    const topo = Math.ceil(maximo / passo) * passo
    const escala = (v: number) => (v / topo) * alturaGrafico

    // Grade e eixo Y
    doc.setLineWidth(0.15)
    for (let v = 0; v <= topo; v += passo) {
      const yy = base - escala(v)
      cor(v === 0 ? EIXO : GRADE, "linha")
      doc.line(x0, yy, x0 + largura, yy)
      fonte(7, "normal", MUDO)
      doc.text(n(v), x0 - 2, yy + 1, { align: "right" })
    }

    // Barras: entrada e saída lado a lado, 0,6 mm de respiro entre elas
    const grupo = largura / g.length
    const respiro = 0.6
    const barra = Math.min(6, (grupo * 0.72 - respiro) / 2)
    const rotularValores = g.length <= 14
    const pularRotulo = g.length > 16 ? 2 : 1
    g.forEach((b, i) => {
      const cx = x0 + grupo * (i + 0.5)
      ;([
        [b.entrada, AZUL, cx - respiro / 2 - barra],
        [b.saida, LARANJA, cx + respiro / 2],
      ] as Array<[number, Cor, number]>).forEach(([v, c, x]) => {
        if (v <= 0) return
        const h = escala(v)
        const raio = Math.min(0.8, barra / 2, h / 2)
        cor(c, "fundo")
        doc.roundedRect(x, base - h, barra, h, raio, raio, "F")
        doc.rect(x, base - Math.min(h, raio * 2), barra, Math.min(h, raio * 2), "F") // base reta
        if (rotularValores) {
          fonte(6.5, "normal", TINTA2)
          doc.text(n(v), x + barra / 2, base - h - 1, { align: "center" })
        }
      })
      if (i % pularRotulo === 0) {
        fonte(7, "normal", MUDO)
        doc.text(b.rotulo, cx, base + 4, { align: "center" })
      }
    })
    y = base + 10
  }

  // ---------- Tabelas ----------
  const estilo = {
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.8, textColor: TINTA, lineColor: GRADE, lineWidth: 0.1 },
    headStyles: { fillColor: ROSA, textColor: 255, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [250, 250, 249] as Cor },
    theme: "grid" as const,
    // Colunas de número (todas menos a primeira) alinhadas à direita também no título e no total
    didParseCell: (data: { column: { index: number }; cell: { styles: { halign?: string } } }) => {
      if (data.column.index > 0) data.cell.styles.halign = "right"
    },
  }
  const comPct = (linhas: LinhaValor[], total: number) =>
    linhas.map((l) => [l.detalhe ? `${l.rotulo} (${l.detalhe})` : l.rotulo, n(l.valor), `${percentual(l.valor, total)}%`])
  const metade = UTIL / 2 - 2

  autoTable(doc, {
    ...estilo,
    startY: y,
    margin: { left: MARGEM, right: A4_LARGURA - MARGEM - metade },
    head: [["Por tipo", "Pessoas", "%"]],
    body: comPct(r.porTipo, m.pessoas),
    columnStyles: { 1: { halign: "right", cellWidth: 18 }, 2: { halign: "right", cellWidth: 13 } },
  })
  const yEsquerda = doc.lastAutoTable?.finalY ?? y
  autoTable(doc, {
    ...estilo,
    startY: y,
    margin: { left: MARGEM + metade + 4, right: MARGEM },
    head: [["Homens, mulheres e crianças", "Pessoas", "%"]],
    body: comPct(r.perfil, m.pessoas),
    columnStyles: { 1: { halign: "right", cellWidth: 18 }, 2: { halign: "right", cellWidth: 13 } },
  })
  y = Math.max(yEsquerda, doc.lastAutoTable?.finalY ?? y) + 4
  fonte(7.5, "normal", MUDO)
  const notas = [
    r.aptos.total
      ? `Dependentes com foto aceita que entraram: ${n(r.aptos.entraram)} de ${n(r.aptos.total)} (${
          r.aptos.entraram && !percentual(r.aptos.entraram, r.aptos.total) ? "menos de 1" : percentual(r.aptos.entraram, r.aptos.total)
        }%).`
      : "",
    "Criança = até 11 anos, pela data de nascimento do cadastro. Colaboradores e outros não têm sexo no cadastro.",
  ].filter(Boolean)
  notas.forEach((t) => {
    doc.text(t, MARGEM, y)
    y += 3.8
  })
  y += 3

  if (r.catracas.length) {
    autoTable(doc, {
      ...estilo,
      startY: y,
      margin: { left: MARGEM, right: A4_LARGURA - MARGEM - metade },
      head: [["Por catraca", "Acessos", "%"]],
      body: comPct(r.catracas, m.entradas + m.saidas),
      columnStyles: { 1: { halign: "right", cellWidth: 18 }, 2: { halign: "right", cellWidth: 13 } },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 6
  }

  if (g.length) {
    const totalE = g.reduce((s, b) => s + b.entrada, 0)
    const totalS = g.reduce((s, b) => s + b.saida, 0)
    // Quantos estavam no clube ao fim de cada hora (mesma regra do "No clube agora")
    const comDentro = r.porHora && g.every((b) => b.dentro != null)
    const corpo = g.map((b) => {
      const linha = [b.rotulo, n(b.entrada), n(b.saida), n(b.entrada + b.saida)]
      return comDentro ? [...linha, n(b.dentro!)] : linha
    })
    const cabecalho = [r.porHora ? "Hora" : "Dia", "Entradas", "Saídas", "Total", ...(comDentro ? ["No clube ao fim da hora"] : [])]
    const larguraTabela = comDentro ? 150 : 110

    // A tabela inteira na página seguinte quando não cabe aqui (linha ~7 mm)
    const altura = 12 + 7 * (corpo.length + 2)
    if (y + altura > A4_ALTURA - 18) {
      doc.addPage()
      y = MARGEM
    }
    fonte(11, "bold")
    doc.text(`Detalhe por ${r.porHora ? "hora" : "dia"}`, MARGEM, y + 4)
    autoTable(doc, {
      ...estilo,
      startY: y + 7,
      head: [cabecalho],
      body: corpo,
      foot: [["Total", n(totalE), n(totalS), n(totalE + totalS), ...(comDentro ? [""] : [])]],
      footStyles: { fillColor: FUNDO, textColor: TINTA, fontStyle: "bold" },
      showHead: "everyPage",
      tableWidth: larguraTabela,
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 28 }, 2: { cellWidth: 28 }, 3: { cellWidth: 28 }, 4: { cellWidth: 40 } },
      margin: { left: MARGEM, right: MARGEM, bottom: 18 },
    })
  }

  // ---------- Rodapé ----------
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    cor(GRADE, "linha")
    doc.setLineWidth(0.2)
    doc.line(MARGEM, A4_ALTURA - 12, A4_LARGURA - MARGEM, A4_ALTURA - 12)
    fonte(7.5, "normal", MUDO)
    doc.text(`Clube Paineiras · Relatório de Acessos · ${r.periodo}`, MARGEM, A4_ALTURA - 7.5)
    doc.text(`Página ${p} de ${paginas}`, A4_LARGURA - MARGEM, A4_ALTURA - 7.5, { align: "right" })
  }

  doc.save(`relatorio-${r.nomeArquivo}.pdf`)
}

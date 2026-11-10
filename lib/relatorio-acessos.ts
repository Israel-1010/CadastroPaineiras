// Dados do relatório de acessos (PDF para a diretoria e Excel), montados pelo dashboard
// com os mesmos filtros da tela. Só roda no navegador.

export type LinhaValor = { rotulo: string; valor: number; detalhe?: string }
export type Tabela = { colunas: string[]; linhas: Array<Array<string | number>> }

export type RelatorioAcessos = {
  /** "10/11/2026" ou "01/11/2026 a 10/11/2026" */
  periodo: string
  /** Filtros aplicados na tela (vazio = todos) */
  filtros: string[]
  geradoEm: string
  /** Base do nome do arquivo, ex.: "acessos-2026-11-10" */
  nomeArquivo: string
  /** true = gráfico por hora (um dia); false = por dia */
  porHora: boolean
  movimento: { entradas: number; saidas: number; pessoas: number; dentro: number; dentroRotulo: string; leituras: number }
  porTipo: LinhaValor[]
  perfil: LinhaValor[]
  catracas: LinhaValor[]
  aptos: { total: number; entraram: number }
  /** dentro: pessoas no clube ao fim da hora (última passagem foi pela entrada); só no relatório de um dia */
  grafico: Array<{ rotulo: string; entrada: number; saida: number; dentro?: number }>
  pessoas: Tabela
  linhaDoTempo: Tabela
  naoEntraram: Tabela
}

/** Logo do clube: coloque o arquivo em public/logo-clube.png (ou .jpg) */
const LOGOS = ["/logo-clube.png", "/logo-clube.jpg", "/logo-clube.jpeg"]

export type Logo = { dataUrl: string; formato: "PNG" | "JPEG"; extensao: "png" | "jpeg"; largura: number; altura: number }

export async function carregarLogo(): Promise<Logo | null> {
  for (const caminho of LOGOS) {
    try {
      const resp = await fetch(caminho, { cache: "no-store" })
      const tipo = resp.headers.get("content-type") ?? ""
      if (!resp.ok || !tipo.startsWith("image/")) continue
      const blob = await resp.blob()
      const dataUrl = await new Promise<string>((ok, falha) => {
        const leitor = new FileReader()
        leitor.onload = () => ok(String(leitor.result))
        leitor.onerror = () => falha(leitor.error)
        leitor.readAsDataURL(blob)
      })
      const img = await new Promise<HTMLImageElement>((ok, falha) => {
        const i = new Image()
        i.onload = () => ok(i)
        i.onerror = falha
        i.src = dataUrl
      })
      const png = tipo.includes("png")
      return { dataUrl, formato: png ? "PNG" : "JPEG", extensao: png ? "png" : "jpeg", largura: img.naturalWidth, altura: img.naturalHeight }
    } catch {
      // tenta o próximo
    }
  }
  return null
}

export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const percentual = (valor: number, total: number) => (total ? Math.round((valor / total) * 100) : 0)

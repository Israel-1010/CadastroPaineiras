import { onlyDigits } from "@/lib/cpf"
import { dependenciaLabel } from "@/lib/types"

/**
 * PD-09: dashboard de acessos a partir da tabela `passages` (leituras das catracas).
 * - user_id com 11 dígitos = CPF do dependente (UserID cadastrado pelo sistema na catraca)
 * - card_no "4" + RE com 13 dígitos (ex.: 40000000006106) = colaborador de RE 6106
 * - o resto (sócios, terceiros, CPF que não está mais no cadastro) entra como "outro"
 */

export type Passagem = {
  user_id: string | null
  user_name: string | null
  card_no: string | null
  similarity: number | null
  timestamp: string | null
  recorded_at: string | null
  device_ip: string | null
  /** "Entry"/"Exit" informado pela catraca (as do evento mandam sempre "Entry": o sentido vem do IP) */
  type?: string | null
}

export type DependenteBase = {
  id: string
  cpf: string
  nome_completo: string
  dependencia: string
  genero: string | null
  data_nascimento: string | null
  foto_aceita: boolean | null
  colaborador: { re: string; nome_completo: string } | null
}

export type ColaboradorBase = { id: string; re: string; nome_completo: string }

export type TipoPessoa = "dependente" | "colaborador" | "outro"
export type Sentido = "entrada" | "saida"
export type Genero = "Masculino" | "Feminino"

export type Pessoa = {
  tipo: TipoPessoa
  nome: string
  cpf: string | null
  re: string | null
  dependencia: string | null
  /** Para dependente: o colaborador responsável */
  colaborador: { nome: string; re: string } | null
  /** false quando a catraca conhece a pessoa mas o cadastro não (ex.: removida na atualização da planilha) */
  cadastrado: boolean
  /** Só dependentes têm sexo e nascimento no cadastro (colaboradores não) */
  genero: Genero | null
  nascimento: string | null
}

export type Acesso = {
  /** chave em `pessoas` */
  p: string
  /** primeira leitura do acesso (ISO) */
  em: string
  /** quantas leituras de rosto formaram este acesso */
  leituras: number
  catraca: string
  sentido: Sentido
  similaridade: number | null
}

export type Apto = {
  p: string
  nome: string
  cpf: string
  dependencia: string
  colaborador: { nome: string; re: string } | null
}

/** Leituras da mesma pessoa com até 2 min de intervalo contam como um único acesso */
export const JANELA_ACESSO_MS = 2 * 60 * 1000

const PREFIXO_COLABORADOR = /^4\d{13}$/

export const normalizaRe = (re: string | null | undefined) => {
  const d = onlyDigits(String(re ?? ""))
  return d ? String(Number(d)) : ""
}

export const normalizaIp = (ip: string | null | undefined) => (ip ?? "").replace(/^::ffff:/i, "").trim() || "—"

/** "ip=valor;ip=valor" -> { ip: valor } */
function lerPares(valor: string): Record<string, string> {
  const pares: Record<string, string> = {}
  for (const par of valor.split(/[;,]/)) {
    const [ip, ...resto] = par.split("=")
    const v = resto.join("=").trim()
    if (ip?.trim() && v) pares[normalizaIp(ip)] = v
  }
  return pares
}

// Catracas do evento: a 192.168.9.74 é a entrada e a 192.168.9.75 é a saída
const SENTIDO_PADRAO: Record<string, Sentido> = { "192.168.9.74": "entrada", "192.168.9.75": "saida" }
const NOME_PADRAO: Record<string, string> = { "192.168.9.74": "Entrada", "192.168.9.75": "Saída" }

/** CATRACAS_SENTIDO="192.168.9.74=entrada;192.168.9.75=saida" (substitui o padrão) */
export function sentidosCatracas(valor = process.env.CATRACAS_SENTIDO ?? ""): Record<string, Sentido> {
  const lidos = lerPares(valor)
  const sentidos: Record<string, Sentido> = Object.keys(lidos).length ? {} : { ...SENTIDO_PADRAO }
  for (const [ip, s] of Object.entries(lidos)) sentidos[ip] = /^sa/i.test(s) ? "saida" : "entrada"
  return sentidos
}

/** CATRACAS_NOMES="12.0.0.83=Catraca 1;12.0.0.84=Catraca 2" (soma ao padrão: Entrada/Saída) */
export function nomesCatracas(valor = process.env.CATRACAS_NOMES ?? ""): Record<string, string> {
  return { ...NOME_PADRAO, ...lerPares(valor) }
}

/** "feminino" / "Masculino" / "F" -> Genero */
export function normalizaGenero(g: string | null | undefined): Genero | null {
  const v = String(g ?? "").trim().toLowerCase()
  if (v.startsWith("f")) return "Feminino"
  if (v.startsWith("m")) return "Masculino"
  return null
}

/** CPF com os zeros à esquerda (a planilha às vezes os perde; a catraca guarda os 11 dígitos) */
const cpf11 = (cpf: string) => onlyDigits(cpf).padStart(11, "0")

/** A catraca guarda só as primeiras 26 letras do nome */
const NOME_CATRACA = 26
const chaveNome = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim()

/**
 * Colaborador pelo nome gravado na catraca (nome completo ou as 26 primeiras letras).
 * Serve para as leituras antigas, de antes do cartão "4" + RE (crachá físico no card_no).
 * Nome que bate com mais de um colaborador fica de fora (null) para não atribuir errado.
 */
function indicePorNome(colaboradores: ColaboradorBase[]) {
  const indice = new Map<string, ColaboradorBase | null>()
  const guardar = (k: string, c: ColaboradorBase) => {
    if (k.split(" ").length < 2) return
    const atual = indice.get(k)
    indice.set(k, atual === undefined || atual?.id === c.id ? c : null)
  }
  for (const c of colaboradores) {
    const k = chaveNome(c.nome_completo)
    guardar(k, c)
    if (k.length > NOME_CATRACA) guardar(k.slice(0, NOME_CATRACA).trim(), c)
  }
  return (nome: string | null) => (nome ? indice.get(chaveNome(nome)) ?? null : null)
}

export function montarAcessos(
  passagens: Passagem[],
  dependentes: DependenteBase[],
  colaboradores: ColaboradorBase[],
  sentidos: Record<string, Sentido> = sentidosCatracas(),
) {
  const depPorCpf = new Map(dependentes.map((d) => [cpf11(d.cpf), d]))
  const colPorRe = new Map(colaboradores.map((c) => [normalizaRe(c.re), c]))
  const colPorNome = indicePorNome(colaboradores)

  const pessoas: Record<string, Pessoa> = {}
  const leiturasPorPessoa = new Map<string, Array<{ t: number; em: string; catraca: string; sentido: Sentido; sim: number | null }>>()
  // Sentido pelo IP da catraca; sem IP conhecido, vale o "type" informado por ela
  const sentidoDe = (ps: Passagem): Sentido => sentidos[normalizaIp(ps.device_ip)] ?? (ps.type === "Exit" ? "saida" : "entrada")
  const semPerfil = { genero: null, nascimento: null }

  for (const ps of passagens) {
    const em = ps.timestamp ?? ps.recorded_at
    if (!em) continue
    const userId = onlyDigits(ps.user_id ?? "")
    const card = (ps.card_no ?? "").trim()
    let chave: string

    const dep = userId.length === 11 ? depPorCpf.get(userId) : undefined
    if (dep) {
      chave = `d:${dep.id}`
      pessoas[chave] ??= {
        tipo: "dependente",
        nome: dep.nome_completo,
        cpf: cpf11(dep.cpf),
        re: null,
        dependencia: dependenciaLabel(dep.dependencia, dep.genero),
        colaborador: dep.colaborador ? { nome: dep.colaborador.nome_completo, re: dep.colaborador.re } : null,
        cadastrado: true,
        genero: normalizaGenero(dep.genero),
        nascimento: dep.data_nascimento?.slice(0, 10) || null,
      }
    } else if (PREFIXO_COLABORADOR.test(card)) {
      const re = normalizaRe(card.slice(1))
      const col = colPorRe.get(re)
      chave = col ? `c:${col.id}` : `re:${re}`
      pessoas[chave] ??= {
        tipo: "colaborador",
        nome: col?.nome_completo ?? ps.user_name ?? `RE ${re}`,
        cpf: null,
        re,
        dependencia: null,
        colaborador: null,
        cadastrado: Boolean(col),
        ...semPerfil,
      }
    } else if (colPorNome(ps.user_name)) {
      const col = colPorNome(ps.user_name)!
      chave = `c:${col.id}`
      pessoas[chave] ??= {
        tipo: "colaborador",
        nome: col.nome_completo,
        cpf: null,
        re: normalizaRe(col.re),
        dependencia: null,
        colaborador: null,
        cadastrado: true,
        ...semPerfil,
      }
    } else {
      const id = userId || card || ps.user_name || "?"
      chave = `o:${id}`
      pessoas[chave] ??= {
        tipo: "outro",
        nome: ps.user_name?.trim() || "Sem nome",
        // CPF que a catraca ainda tem, mas que saiu do cadastro
        cpf: userId.length === 11 ? userId : null,
        re: null,
        dependencia: null,
        colaborador: null,
        cadastrado: false,
        ...semPerfil,
      }
    }

    const lista = leiturasPorPessoa.get(chave) ?? []
    lista.push({ t: Date.parse(em), em, catraca: normalizaIp(ps.device_ip), sentido: sentidoDe(ps), sim: ps.similarity })
    leiturasPorPessoa.set(chave, lista)
  }

  // Agrupa as leituras repetidas (a catraca lê o rosto várias vezes em poucos segundos).
  // Trocou de sentido (entrou e saiu em seguida) = acesso novo, mesmo dentro da janela
  const acessos: Acesso[] = []
  for (const [p, lista] of leiturasPorPessoa) {
    lista.sort((a, b) => a.t - b.t)
    let atual: Acesso | null = null
    let ultimaLeitura = 0
    for (const l of lista) {
      if (atual && atual.sentido === l.sentido && l.t - ultimaLeitura <= JANELA_ACESSO_MS) {
        atual.leituras++
        if (l.sim != null && (atual.similaridade == null || l.sim > atual.similaridade)) atual.similaridade = l.sim
      } else {
        atual = { p, em: new Date(l.t).toISOString(), leituras: 1, catraca: l.catraca, sentido: l.sentido, similaridade: l.sim }
        acessos.push(atual)
      }
      ultimaLeitura = l.t
    }
  }
  acessos.sort((a, b) => b.em.localeCompare(a.em))

  // Dependentes com foto aceita pela catraca: base para "não passaram"
  const aptos: Apto[] = dependentes
    .filter((d) => d.foto_aceita === true)
    .map((d) => ({
      p: `d:${d.id}`,
      nome: d.nome_completo,
      cpf: cpf11(d.cpf),
      dependencia: dependenciaLabel(d.dependencia, d.genero),
      colaborador: d.colaborador ? { nome: d.colaborador.nome_completo, re: d.colaborador.re } : null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))

  return { pessoas, acessos, aptos }
}

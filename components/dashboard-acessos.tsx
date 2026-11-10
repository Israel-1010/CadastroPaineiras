"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ArrowLeft, Download, Loader2, LogIn, LogOut, RefreshCw, Search } from "lucide-react"
import { formatCPF } from "@/lib/cpf"
import type { Acesso, Apto, Pessoa, Sentido, TipoPessoa } from "@/lib/acessos"

type Resposta = {
  periodo: { de: string; ate: string }
  ultimoDia: string | null
  leituras: number
  limiteAtingido: boolean
  catracas: Record<string, string>
  pessoas: Record<string, Pessoa>
  acessos: Acesso[]
  aptos: Apto[]
  atualizadoEm: string
}

const TIPOS: TipoPessoa[] = ["dependente", "colaborador", "outro"]
const TIPO_LABEL: Record<TipoPessoa, string> = { dependente: "Dependentes", colaborador: "Colaboradores", outro: "Outros" }
const TIPO_SINGULAR: Record<TipoPessoa, string> = { dependente: "Dependente", colaborador: "Colaborador", outro: "Outro" }
const SENTIDO_LABEL: Record<Sentido, string> = { entrada: "Entrada", saida: "Saída" }

// Cores fixas por sentido (a cor segue a série, nunca a posição)
const chartConfig = {
  entrada: { label: "Entradas", color: "#2a78d6" },
  saida: { label: "Saídas", color: "#eb6834" },
} satisfies ChartConfig
const COR_BARRA = "#2a78d6"
const MAX_LINHAS = 300
/** Criança: até 11 anos (ECA: criança é quem tem menos de 12 anos) */
const IDADE_CRIANCA = 12

// Horário de Brasília (sem horário de verão desde 2019)
const FUSO_MS = 3 * 60 * 60 * 1000
const local = (iso: string) => new Date(Date.parse(iso) - FUSO_MS).toISOString()
const hojeLocal = () => local(new Date().toISOString()).slice(0, 10)
const ontemLocal = () => local(new Date(Date.now() - 86_400_000).toISOString()).slice(0, 10)
const dataBR = (dia: string) => dia.split("-").reverse().join("/")
const hora = (iso: string) => local(iso).slice(11, 19)
const diaHora = (iso: string) => `${dataBR(local(iso).slice(0, 10)).slice(0, 5)} ${local(iso).slice(11, 16)}`

const numero = (n: number) => n.toLocaleString("pt-BR")
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "")

/** Idade (anos completos) na data do acesso */
function idadeEm(nascimento: string | null, iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimento ?? "")
  if (!m) return null
  const [a, me, d] = local(iso).slice(0, 10).split("-").map(Number)
  let idade = a - Number(m[1])
  if (me < Number(m[2]) || (me === Number(m[2]) && d < Number(m[3]))) idade--
  return idade
}

type Perfil = "homem" | "mulher" | "crianca" | "sem_info"
const PERFIL_LABEL: Record<Perfil, string> = { homem: "Homens", mulher: "Mulheres", crianca: "Crianças", sem_info: "Sem informação" }
function perfilDe(p: Pessoa, emIso: string): Perfil {
  if (p.tipo !== "dependente") return "sem_info"
  const idade = idadeEm(p.nascimento, emIso)
  if (idade != null && idade < IDADE_CRIANCA) return "crianca"
  return p.genero === "Masculino" ? "homem" : p.genero === "Feminino" ? "mulher" : "sem_info"
}

function baixarCsv(nome: string, linhas: Array<Array<string | number | null>>) {
  const csv = linhas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <Card className="bg-white border-slate-200">
      <CardContent className="p-4">
        <p className="text-sm text-slate-600">{titulo}</p>
        <p className="text-2xl font-semibold text-slate-900">{valor}</p>
        {detalhe && <p className="text-xs text-slate-500 mt-0.5">{detalhe}</p>}
      </CardContent>
    </Card>
  )
}

/** Linhas "rótulo ... valor (%)" com barra proporcional ao total */
function Proporcoes({ linhas, total }: { linhas: Array<{ rotulo: string; valor: number; detalhe?: string }>; total: number }) {
  return (
    <ul className="space-y-3">
      {linhas.map((l) => (
        <li key={l.rotulo} title={`${l.rotulo}: ${numero(l.valor)}`}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="text-slate-700">
              {l.rotulo}
              {l.detalhe && <span className="text-slate-500 text-xs"> · {l.detalhe}</span>}
            </span>
            <span className="font-medium text-slate-900 tabular-nums whitespace-nowrap">
              {numero(l.valor)} <span className="text-slate-500 font-normal text-xs">{pct(l.valor, total)}</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded bg-slate-100">
            <div className="h-2 rounded" style={{ width: total ? `${(l.valor / total) * 100}%` : 0, background: COR_BARRA }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function SentidoTag({ sentido }: { sentido: Sentido }) {
  const Icone = sentido === "entrada" ? LogIn : LogOut
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
      <Icone className="w-3.5 h-3.5" /> {SENTIDO_LABEL[sentido]}
    </span>
  )
}

// PD-09: quem passou pelas catracas, quando, por qual catraca e em que sentido
export function DashboardAcessos() {
  const router = useRouter()
  const [de, setDe] = useState("")
  const [ate, setAte] = useState("")
  const [tipo, setTipo] = useState<"todos" | TipoPessoa>("todos")
  const [catraca, setCatraca] = useState("todas")
  const [busca, setBusca] = useState("")
  const [aba, setAba] = useState("pessoas")
  const [automatico, setAutomatico] = useState(false)
  const [dados, setDados] = useState<Resposta | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(
    async (periodo?: { de: string; ate: string }) => {
      setCarregando(true)
      setErro(null)
      try {
        const qs = periodo ? `?de=${periodo.de}&ate=${periodo.ate}` : ""
        const resp = await fetch(`/api/admin/acessos${qs}`, { cache: "no-store" })
        if (resp.status === 401) return router.replace("/admin/login")
        const json = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(json?.error || "Erro ao carregar os acessos")
        setDados(json)
        setDe(json.periodo.de)
        setAte(json.periodo.ate)
      } catch (e) {
        setErro((e as Error).message)
      } finally {
        setCarregando(false)
      }
    },
    [router],
  )

  useEffect(() => {
    carregar()
  }, [carregar])

  // Atualização automática (útil no dia do evento)
  useEffect(() => {
    if (!automatico || !dados) return
    const id = setInterval(() => carregar(dados.periodo), 60_000)
    return () => clearInterval(id)
  }, [automatico, dados, carregar])

  const nomeCatraca = useCallback((ip: string) => dados?.catracas[ip] ?? ip, [dados])
  const umDia = dados ? dados.periodo.de === dados.periodo.ate : true
  const incluiHoje = dados ? dados.periodo.de <= hojeLocal() && hojeLocal() <= dados.periodo.ate : false

  // Só o filtro de tipo: base para "no clube agora" e "não entraram" (precisam dos dois sentidos)
  const doTipo = useMemo(() => {
    if (!dados) return []
    return dados.acessos.filter((a) => tipo === "todos" || dados.pessoas[a.p]?.tipo === tipo)
  }, [dados, tipo])

  // Tipo + catraca: valem para indicadores, gráfico e listas
  const filtrados = useMemo(() => doTipo.filter((a) => catraca === "todas" || a.catraca === catraca), [doTipo, catraca])

  const resumo = useMemo(() => {
    const pessoas = new Map<string, string>() // pessoa -> primeiro acesso
    const porTipo: Record<TipoPessoa, Set<string>> = { dependente: new Set(), colaborador: new Set(), outro: new Set() }
    let entradas = 0
    let saidas = 0
    let leituras = 0
    // acessos vêm do mais recente para o mais antigo: o último set fica com o primeiro acesso
    for (const a of filtrados) {
      pessoas.set(a.p, a.em)
      porTipo[dados!.pessoas[a.p].tipo].add(a.p)
      if (a.sentido === "entrada") entradas++
      else saidas++
      leituras += a.leituras
    }
    const perfil: Record<Perfil, number> = { homem: 0, mulher: 0, crianca: 0, sem_info: 0 }
    for (const [p, em] of pessoas) perfil[perfilDe(dados!.pessoas[p], em)]++

    // Última passagem de cada pessoa (em qualquer catraca) foi pela entrada = está no clube
    const ultimo = new Map<string, Sentido>()
    for (const a of doTipo) if (!ultimo.has(a.p)) ultimo.set(a.p, a.sentido)
    const dentro = [...ultimo.values()].filter((s) => s === "entrada").length

    const entraram = new Set(doTipo.filter((a) => a.sentido === "entrada").map((a) => a.p))
    const aptos = dados?.aptos.length ?? 0
    const aptosQueEntraram = dados?.aptos.filter((ap) => entraram.has(ap.p)).length ?? 0
    return { pessoas: pessoas.size, porTipo, entradas, saidas, leituras, perfil, ultimo, dentro, entraram, aptos, aptosQueEntraram }
  }, [filtrados, doTipo, dados])

  // Colunas: por hora (um dia) ou por dia (período), entradas e saídas lado a lado
  const grafico = useMemo(() => {
    const baldes = new Map<string, Record<Sentido, number>>()
    for (const a of filtrados) {
      const l = local(a.em)
      const chave = umDia ? l.slice(11, 13) : l.slice(0, 10)
      const b = baldes.get(chave) ?? { entrada: 0, saida: 0 }
      b[a.sentido]++
      baldes.set(chave, b)
    }
    if (baldes.size === 0) return []
    const chaves = [...baldes.keys()].sort()
    const todas: string[] = []
    if (umDia) {
      for (let h = Number(chaves[0]); h <= Number(chaves[chaves.length - 1]); h++) todas.push(String(h).padStart(2, "0"))
    } else {
      for (let t = Date.parse(chaves[0]); t <= Date.parse(chaves[chaves.length - 1]); t += 86_400_000) {
        todas.push(new Date(t).toISOString().slice(0, 10))
      }
    }
    return todas.map((c) => {
      const b = baldes.get(c) ?? { entrada: 0, saida: 0 }
      return { rotulo: umDia ? `${c}h` : dataBR(c).slice(0, 5), ...b }
    })
  }, [filtrados, umDia])
  const sentidosNoGrafico = (["entrada", "saida"] as Sentido[]).filter((s) => grafico.some((g) => g[s] > 0))

  const porCatraca = useMemo(() => {
    const m = new Map<string, { n: number; sentido: Sentido }>()
    for (const a of filtrados) m.set(a.catraca, { n: (m.get(a.catraca)?.n ?? 0) + 1, sentido: a.sentido })
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [filtrados])

  const termo = busca.trim().toLowerCase()
  const termoDigitos = termo.replace(/\D/g, "")
  const casa = useCallback(
    (p: { nome: string; cpf?: string | null; re?: string | null; colaborador?: { nome: string; re: string } | null }) => {
      if (!termo) return true
      if (p.nome.toLowerCase().includes(termo)) return true
      if (p.colaborador?.nome.toLowerCase().includes(termo)) return true
      if (termoDigitos.length >= 3) {
        if (p.cpf?.includes(termoDigitos)) return true
        if (p.re === termoDigitos || p.colaborador?.re === termoDigitos) return true
      }
      return false
    },
    [termo, termoDigitos],
  )

  type LinhaPessoa = {
    chave: string
    pessoa: Pessoa
    entradas: number
    saidas: number
    primeiraEntrada: string | null
    ultimaSaida: string | null
    primeira: string
    ultima: string
    catracas: Set<string>
  }
  const listaPessoas = useMemo(() => {
    if (!dados) return []
    const m = new Map<string, LinhaPessoa>()
    for (const a of filtrados) {
      const l =
        m.get(a.p) ??
        ({ chave: a.p, pessoa: dados.pessoas[a.p], entradas: 0, saidas: 0, primeiraEntrada: null, ultimaSaida: null, primeira: a.em, ultima: a.em, catracas: new Set() } as LinhaPessoa)
      if (a.sentido === "entrada") {
        l.entradas++
        if (!l.primeiraEntrada || a.em < l.primeiraEntrada) l.primeiraEntrada = a.em
      } else {
        l.saidas++
        if (!l.ultimaSaida || a.em > l.ultimaSaida) l.ultimaSaida = a.em
      }
      if (a.em < l.primeira) l.primeira = a.em
      if (a.em > l.ultima) l.ultima = a.em
      l.catracas.add(a.catraca)
      m.set(a.p, l)
    }
    return [...m.values()].filter((l) => casa(l.pessoa)).sort((a, b) => b.ultima.localeCompare(a.ultima))
  }, [filtrados, dados, casa])

  const linhaDoTempo = useMemo(() => (dados ? filtrados.filter((a) => casa(dados.pessoas[a.p])) : []), [filtrados, dados, casa])

  const naoEntraram = useMemo(() => {
    if (!dados) return []
    return dados.aptos.filter((ap) => !resumo.entraram.has(ap.p) && casa(ap))
  }, [dados, resumo, casa])

  const fmt = umDia ? hora : diaHora
  const identificacao = (p: Pessoa) => (p.cpf ? formatCPF(p.cpf) : p.re ? `RE ${p.re}` : "—")
  const responsavel = (c: { nome: string; re: string } | null) => (c ? `${c.nome} (RE ${c.re})` : "—")
  const situacao = (chave: string) =>
    resumo.ultimo.get(chave) === "entrada" ? (incluiHoje ? "No clube" : "Sem saída registrada") : "Saiu"

  function exportar() {
    if (!dados) return
    const periodo = umDia ? dados.periodo.de : `${dados.periodo.de}_a_${dados.periodo.ate}`
    const dataHoraCompleta = (iso: string | null) => (iso ? `${dataBR(local(iso).slice(0, 10))} ${hora(iso)}` : "")
    if (aba === "pessoas") {
      baixarCsv(`acessos-pessoas-${periodo}.csv`, [
        ["Nome", "Tipo", "CPF", "RE", "Parentesco", "Sexo", "Idade", "Colaborador", "RE do colaborador", "Entradas", "Saídas", "Primeira entrada", "Última saída", "Situação"],
        ...listaPessoas.map((l) => [
          l.pessoa.nome, TIPO_SINGULAR[l.pessoa.tipo], l.pessoa.cpf ? formatCPF(l.pessoa.cpf) : "", l.pessoa.re ?? "",
          l.pessoa.dependencia ?? "", l.pessoa.genero ?? "", idadeEm(l.pessoa.nascimento, l.primeira) ?? "",
          l.pessoa.colaborador?.nome ?? "", l.pessoa.colaborador?.re ?? "",
          l.entradas, l.saidas, dataHoraCompleta(l.primeiraEntrada), dataHoraCompleta(l.ultimaSaida), situacao(l.chave),
        ]),
      ])
    } else if (aba === "linha") {
      baixarCsv(`acessos-linha-do-tempo-${periodo}.csv`, [
        ["Data e hora", "Sentido", "Nome", "Tipo", "CPF", "RE", "Colaborador", "Catraca", "Similaridade", "Leituras"],
        ...linhaDoTempo.map((a) => {
          const p = dados.pessoas[a.p]
          return [dataHoraCompleta(a.em), SENTIDO_LABEL[a.sentido], p.nome, TIPO_SINGULAR[p.tipo], p.cpf ? formatCPF(p.cpf) : "", p.re ?? "", p.colaborador ? responsavel(p.colaborador) : "", nomeCatraca(a.catraca), a.similaridade ?? "", a.leituras]
        }),
      ])
    } else {
      baixarCsv(`dependentes-que-nao-entraram-${periodo}.csv`, [
        ["Nome", "CPF", "Parentesco", "Colaborador", "RE do colaborador"],
        ...naoEntraram.map((ap) => [ap.nome, formatCPF(ap.cpf), ap.dependencia, ap.colaborador?.nome ?? "", ap.colaborador?.re ?? ""]),
      ])
    }
  }

  const ips = useMemo(() => {
    if (!dados) return []
    return [...new Set(dados.acessos.map((a) => a.catraca))].sort()
  }, [dados])

  const periodoTexto = dados ? (umDia ? dataBR(dados.periodo.de) : `${dataBR(dados.periodo.de)} a ${dataBR(dados.periodo.ate)}`) : ""
  const qtdLista = aba === "pessoas" ? listaPessoas.length : aba === "linha" ? linhaDoTempo.length : naoEntraram.length

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Dashboard
      </Button>

      {/* Filtros: acima de tudo */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (de && ate) carregar({ de, ate })
            }}
          >
            {/* Período */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="acessos-de">De</Label>
                <Input id="acessos-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="acessos-ate">Até</Label>
                <Input id="acessos-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
              </div>
              <Button type="submit" disabled={carregando || !de || !ate}>
                {carregando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Atualizar
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={carregando} onClick={() => carregar({ de: hojeLocal(), ate: hojeLocal() })}>
                  Hoje
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={carregando} onClick={() => carregar({ de: ontemLocal(), ate: ontemLocal() })}>
                  Ontem
                </Button>
                {dados?.ultimoDia && (
                  <Button type="button" variant="outline" size="sm" disabled={carregando} onClick={() => carregar({ de: dados.ultimoDia!, ate: dados.ultimoDia! })}>
                    Último dia com acessos ({dataBR(dados.ultimoDia)})
                  </Button>
                )}
              </div>
            </div>
            {/* Recortes */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Catraca</Label>
                <Select value={catraca} onValueChange={setCatraca}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {ips.map((ip) => (
                      <SelectItem key={ip} value={ip}>
                        {nomeCatraca(ip)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                <Checkbox checked={automatico} onCheckedChange={(v) => setAutomatico(v === true)} />
                Atualizar sozinho a cada 1 min
              </label>
            </div>
          </form>
          {dados && (
            <p className="text-xs text-slate-500 mt-3">
              {periodoTexto} · atualizado às {hora(dados.atualizadoEm)} · leituras de rosto da mesma pessoa, no mesmo sentido, com até 2 min de intervalo contam como 1 acesso
            </p>
          )}
        </CardContent>
      </Card>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      {dados?.limiteAtingido && (
        <Alert>
          <AlertDescription>O período tem leituras demais e foi cortado. Escolha um período menor.</AlertDescription>
        </Alert>
      )}

      {!dados && carregando && (
        <p className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando acessos...
        </p>
      )}

      {dados && (
        <>
          {/* Movimento */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Indicador titulo="Entradas" valor={numero(resumo.entradas)} detalhe={`${numero(resumo.leituras)} leituras de rosto no total`} />
            <Indicador titulo="Saídas" valor={numero(resumo.saidas)} />
            <Indicador titulo="Pessoas diferentes" valor={numero(resumo.pessoas)} />
            <Indicador
              titulo={incluiHoje ? "No clube agora" : "Sem saída registrada"}
              valor={numero(resumo.dentro)}
              detalhe="última passagem foi pela entrada"
            />
          </div>

          {/* Quem passou: por tipo e por perfil (pessoas diferentes) */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Por tipo</CardTitle>
                <CardDescription>Pessoas diferentes que passaram</CardDescription>
              </CardHeader>
              <CardContent>
                <Proporcoes
                  total={resumo.pessoas}
                  linhas={[
                    {
                      rotulo: "Dependentes",
                      valor: resumo.porTipo.dependente.size,
                      detalhe: resumo.aptos ? `${numero(resumo.aptosQueEntraram)} de ${numero(resumo.aptos)} com foto aceita entraram` : undefined,
                    },
                    { rotulo: "Colaboradores", valor: resumo.porTipo.colaborador.size },
                    { rotulo: "Outros", valor: resumo.porTipo.outro.size, detalhe: "fora do cadastro" },
                  ]}
                />
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Homens, mulheres e crianças</CardTitle>
                <CardDescription>Pelo cadastro dos dependentes; criança = até {IDADE_CRIANCA - 1} anos</CardDescription>
              </CardHeader>
              <CardContent>
                <Proporcoes
                  total={resumo.pessoas}
                  linhas={[
                    { rotulo: PERFIL_LABEL.homem, valor: resumo.perfil.homem },
                    { rotulo: PERFIL_LABEL.mulher, valor: resumo.perfil.mulher },
                    { rotulo: PERFIL_LABEL.crianca, valor: resumo.perfil.crianca },
                    { rotulo: PERFIL_LABEL.sem_info, valor: resumo.perfil.sem_info, detalhe: "colaboradores e outros (o cadastro não tem sexo)" },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Entradas e saídas por hora / por dia */}
            <Card className="bg-white border-slate-200 lg:col-span-2">
              <CardHeader>
                <CardTitle>Entradas e saídas por {umDia ? "hora" : "dia"}</CardTitle>
                <CardDescription>{periodoTexto}</CardDescription>
              </CardHeader>
              <CardContent>
                {grafico.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum acesso no período.</p>
                ) : (
                  <>
                    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
                      <BarChart data={grafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                        <CartesianGrid vertical={false} stroke="#e1e0d9" />
                        <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: "#c3c2b7" }} tickMargin={8} minTickGap={8} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => numero(v)} />
                        <ChartTooltip cursor={{ fill: "rgba(11,11,11,0.05)" }} content={<ChartTooltipContent />} />
                        {sentidosNoGrafico.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
                        {sentidosNoGrafico.map((s) => (
                          <Bar key={s} dataKey={s} fill={chartConfig[s].color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                        ))}
                      </BarChart>
                    </ChartContainer>
                    {sentidosNoGrafico.length === 1 && (
                      <p className="text-xs text-slate-500 mt-2 text-center">{chartConfig[sentidosNoGrafico[0]].label}</p>
                    )}
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-slate-600">Ver os números</summary>
                      <table className="mt-2 w-full text-left tabular-nums">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="py-1 pr-2 font-medium">{umDia ? "Hora" : "Dia"}</th>
                            <th className="py-1 pr-2 font-medium text-right">Entradas</th>
                            <th className="py-1 font-medium text-right">Saídas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {grafico.map((g) => (
                            <tr key={g.rotulo}>
                              <td className="py-1 pr-2">{g.rotulo}</td>
                              <td className="py-1 pr-2 text-right">{numero(g.entrada)}</td>
                              <td className="py-1 text-right">{numero(g.saida)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Por catraca */}
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle>Acessos por catraca</CardTitle>
                <CardDescription>Entrada: 192.168.9.74 · Saída: 192.168.9.75</CardDescription>
              </CardHeader>
              <CardContent>
                {porCatraca.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum acesso no período.</p>
                ) : (
                  <Proporcoes
                    total={filtrados.length}
                    linhas={porCatraca.map(([ip, { n }]) => ({ rotulo: nomeCatraca(ip), valor: n, detalhe: nomeCatraca(ip) !== ip ? ip : undefined }))}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Listas */}
          <Card className="bg-white border-slate-200">
            <CardContent className="p-4 space-y-4">
              <Tabs value={aba} onValueChange={setAba}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="pessoas">Quem passou ({numero(listaPessoas.length)})</TabsTrigger>
                    <TabsTrigger value="linha">Linha do tempo ({numero(linhaDoTempo.length)})</TabsTrigger>
                    <TabsTrigger value="nao">Dependentes que não entraram ({numero(naoEntraram.length)})</TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    <div className="relative flex-1 lg:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, CPF, RE ou colaborador" className="pl-10" />
                    </div>
                    <Button variant="outline" onClick={exportar} disabled={qtdLista === 0}>
                      <Download className="w-4 h-4 mr-2" /> CSV
                    </Button>
                  </div>
                </div>

                {qtdLista > MAX_LINHAS && (
                  <p className="text-xs text-slate-500 mt-3">
                    Mostrando {MAX_LINHAS} de {numero(qtdLista)}. Use a busca para achar alguém ou baixe o CSV com todos.
                  </p>
                )}

                <TabsContent value="pessoas">
                  <Lista vazio={listaPessoas.length === 0}>
                    {listaPessoas.slice(0, MAX_LINHAS).map((l) => {
                      const sit = situacao(l.chave)
                      return (
                        <li key={l.chave} className="px-3 py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-slate-800">
                              {l.pessoa.nome}{" "}
                              <Badge variant="outline" className="ml-1 font-normal">
                                {l.pessoa.dependencia ?? TIPO_SINGULAR[l.pessoa.tipo]}
                              </Badge>
                              {!l.pessoa.cadastrado && l.pessoa.tipo !== "outro" && (
                                <span className="ml-1 text-xs text-amber-700">fora do cadastro</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              {identificacao(l.pessoa)}
                              {l.pessoa.colaborador && <> · de {responsavel(l.pessoa.colaborador)}</>}
                            </p>
                          </div>
                          <div className="text-xs text-slate-600 sm:text-right tabular-nums">
                            <p>
                              {/* Em ordem de horário: primeira entrada e última saída */}
                              {[
                                ...(l.primeiraEntrada ? [{ t: l.primeiraEntrada, txt: `entrou ${fmt(l.primeiraEntrada)}` }] : []),
                                ...(l.ultimaSaida ? [{ t: l.ultimaSaida, txt: `saiu ${fmt(l.ultimaSaida)}` }] : []),
                              ]
                                .sort((a, b) => a.t.localeCompare(b.t))
                                .map((m) => m.txt)
                                .join(" · ")}
                              {(l.entradas > 1 || l.saidas > 1) && ` · ${l.entradas} entrada(s), ${l.saidas} saída(s)`}
                            </p>
                            <p className={sit === "No clube" ? "font-medium text-slate-800" : "text-slate-500"}>{sit}</p>
                          </div>
                        </li>
                      )
                    })}
                  </Lista>
                </TabsContent>

                <TabsContent value="linha">
                  <Lista vazio={linhaDoTempo.length === 0}>
                    {linhaDoTempo.slice(0, MAX_LINHAS).map((a, i) => {
                      const p = dados.pessoas[a.p]
                      return (
                        <li key={`${a.p}-${a.em}-${i}`} className="px-3 py-2 flex gap-3">
                          <div className="w-24 shrink-0">
                            <p className="font-mono text-slate-700">{fmt(a.em)}</p>
                            <SentidoTag sentido={a.sentido} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-800">
                              <span className="font-medium">{p.nome}</span>
                              <span className="text-slate-500"> · {p.dependencia ?? TIPO_SINGULAR[p.tipo]}</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {identificacao(p)}
                              {p.colaborador && <> · de {responsavel(p.colaborador)}</>}
                              {" · "}
                              {nomeCatraca(a.catraca)}
                              {a.similaridade != null && <> · similaridade {a.similaridade}%</>}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </Lista>
                </TabsContent>

                <TabsContent value="nao">
                  <p className="text-xs text-slate-500 mb-2">Dependentes com foto aceita pelas catracas que não entraram no período.</p>
                  {tipo !== "todos" && tipo !== "dependente" ? (
                    <p className="text-sm text-slate-500">Escolha o tipo &quot;Todos&quot; ou &quot;Dependentes&quot; para ver esta lista.</p>
                  ) : (
                    <Lista vazio={naoEntraram.length === 0}>
                      {naoEntraram.slice(0, MAX_LINHAS).map((ap) => (
                        <li key={ap.p} className="px-3 py-2">
                          <p className="font-medium text-slate-800">
                            {ap.nome}{" "}
                            <Badge variant="outline" className="ml-1 font-normal">
                              {ap.dependencia}
                            </Badge>
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatCPF(ap.cpf)} · de {responsavel(ap.colaborador)}
                          </p>
                        </li>
                      ))}
                    </Lista>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Lista({ vazio, children }: { vazio: boolean; children: React.ReactNode }) {
  if (vazio) return <p className="text-sm text-slate-500 mt-3">Nenhum registro encontrado.</p>
  return (
    <ul className="mt-3 max-h-[36rem] overflow-y-auto divide-y divide-slate-100 rounded border border-slate-200 text-sm">{children}</ul>
  )
}

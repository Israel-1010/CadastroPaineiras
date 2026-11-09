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
import { ArrowLeft, Download, Loader2, RefreshCw, Search } from "lucide-react"
import { formatCPF } from "@/lib/cpf"
import type { Acesso, Apto, Pessoa, TipoPessoa } from "@/lib/acessos"

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

// Ordem de empilhamento (de baixo para cima) e cores fixas por tipo: a cor segue o tipo, nunca a posição
const TIPOS: TipoPessoa[] = ["dependente", "colaborador", "outro"]
const TIPO_LABEL: Record<TipoPessoa, string> = { dependente: "Dependentes", colaborador: "Colaboradores", outro: "Outros" }
const TIPO_SINGULAR: Record<TipoPessoa, string> = { dependente: "Dependente", colaborador: "Colaborador", outro: "Outro" }
const chartConfig = {
  dependente: { label: "Dependentes", color: "#2a78d6" },
  colaborador: { label: "Colaboradores", color: "#eb6834" },
  outro: { label: "Outros", color: "#1baf7a" },
} satisfies ChartConfig
const SUPERFICIE = "#ffffff"
const MAX_LINHAS = 300

// Horário de Brasília (sem horário de verão desde 2019)
const FUSO_MS = 3 * 60 * 60 * 1000
const local = (iso: string) => new Date(Date.parse(iso) - FUSO_MS).toISOString()
const hojeLocal = () => local(new Date().toISOString()).slice(0, 10)
const ontemLocal = () => local(new Date(Date.now() - 86_400_000).toISOString()).slice(0, 10)
const dataBR = (dia: string) => dia.split("-").reverse().join("/")
const hora = (iso: string) => local(iso).slice(11, 19)
const diaHora = (iso: string) => `${dataBR(local(iso).slice(0, 10)).slice(0, 5)} ${local(iso).slice(11, 16)}`

const numero = (n: number) => n.toLocaleString("pt-BR")

function baixarCsv(nome: string, linhas: Array<Array<string | number | null>>) {
  const csv = linhas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

/** Segmento da coluna empilhada: só o de cima ganha a ponta arredondada de 4px */
function segmento(tipo: TipoPessoa) {
  return function Segmento(props: any) {
    const { x, y, width, height, payload } = props
    if (!height || height <= 0) return <g />

    const temAcima = TIPOS.slice(TIPOS.indexOf(tipo) + 1).some((t) => payload[t] > 0)
    const r = temAcima ? 0 : Math.min(4, height, width / 2)
    const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
    // O traço na cor do fundo deixa 2px de respiro entre os segmentos
    return <path d={d} fill={chartConfig[tipo].color} stroke={SUPERFICIE} strokeWidth={2} />
  }
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

// PD-09: quem passou pelas catracas, quando e por qual catraca
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

  // Acessos depois dos filtros de tipo e catraca (valem para tudo: indicadores, gráfico e listas)
  const filtrados = useMemo(() => {
    if (!dados) return []
    return dados.acessos.filter(
      (a) => (tipo === "todos" || dados.pessoas[a.p]?.tipo === tipo) && (catraca === "todas" || a.catraca === catraca),
    )
  }, [dados, tipo, catraca])

  const resumo = useMemo(() => {
    const pessoas = new Set<string>()
    const porTipo: Record<TipoPessoa, Set<string>> = { dependente: new Set(), colaborador: new Set(), outro: new Set() }
    let leituras = 0
    for (const a of filtrados) {
      pessoas.add(a.p)
      porTipo[dados!.pessoas[a.p].tipo].add(a.p)
      leituras += a.leituras
    }
    const aptos = dados?.aptos.length ?? 0
    const aptosQuePassaram = dados?.aptos.filter((ap) => porTipo.dependente.has(ap.p)).length ?? 0
    return { pessoas: pessoas.size, porTipo, leituras, aptos, aptosQuePassaram }
  }, [filtrados, dados])

  // Colunas: por hora (um dia) ou por dia (período)
  const grafico = useMemo(() => {
    const baldes = new Map<string, Record<TipoPessoa, number>>()
    for (const a of filtrados) {
      const l = local(a.em)
      const chave = umDia ? l.slice(11, 13) : l.slice(0, 10)
      const b = baldes.get(chave) ?? { dependente: 0, colaborador: 0, outro: 0 }
      b[dados!.pessoas[a.p].tipo]++
      baldes.set(chave, b)
    }
    if (baldes.size === 0) return []
    const chaves = [...baldes.keys()].sort()
    // Preenche as horas/dias sem acesso entre o primeiro e o último
    const todas: string[] = []
    if (umDia) {
      for (let h = Number(chaves[0]); h <= Number(chaves[chaves.length - 1]); h++) todas.push(String(h).padStart(2, "0"))
    } else {
      for (let t = Date.parse(chaves[0]); t <= Date.parse(chaves[chaves.length - 1]); t += 86_400_000) {
        todas.push(new Date(t).toISOString().slice(0, 10))
      }
    }
    return todas.map((c) => {
      const b = baldes.get(c) ?? { dependente: 0, colaborador: 0, outro: 0 }
      return { rotulo: umDia ? `${c}h` : dataBR(c).slice(0, 5), ...b, total: b.dependente + b.colaborador + b.outro }
    })
  }, [filtrados, dados, umDia])

  const tiposNoGrafico = TIPOS.filter((t) => grafico.some((g) => g[t] > 0))

  const porCatraca = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of filtrados) m.set(a.catraca, (m.get(a.catraca) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [filtrados])
  const maxCatraca = Math.max(1, ...porCatraca.map(([, n]) => n))

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

  const listaPessoas = useMemo(() => {
    if (!dados) return []
    const m = new Map<string, { chave: string; pessoa: Pessoa; primeira: string; ultima: string; acessos: number; catracas: Set<string> }>()
    for (const a of filtrados) {
      const atual = m.get(a.p)
      if (atual) {
        atual.acessos++
        if (a.em < atual.primeira) atual.primeira = a.em
        if (a.em > atual.ultima) atual.ultima = a.em
        atual.catracas.add(a.catraca)
      } else {
        m.set(a.p, { chave: a.p, pessoa: dados.pessoas[a.p], primeira: a.em, ultima: a.em, acessos: 1, catracas: new Set([a.catraca]) })
      }
    }
    return [...m.values()].filter((l) => casa(l.pessoa)).sort((a, b) => b.ultima.localeCompare(a.ultima))
  }, [filtrados, dados, casa])

  const linhaDoTempo = useMemo(
    () => (dados ? filtrados.filter((a) => casa(dados.pessoas[a.p])) : []),
    [filtrados, dados, casa],
  )

  const naoPassaram = useMemo(() => {
    if (!dados) return []
    const passaram = resumo.porTipo.dependente
    return dados.aptos.filter((ap) => !passaram.has(ap.p) && casa(ap))
  }, [dados, resumo, casa])

  const fmt = umDia ? hora : diaHora
  const identificacao = (p: Pessoa) => (p.cpf ? formatCPF(p.cpf) : p.re ? `RE ${p.re}` : "—")
  const responsavel = (c: { nome: string; re: string } | null) => (c ? `${c.nome} (RE ${c.re})` : "—")

  function exportar() {
    if (!dados) return
    const periodo = umDia ? dados.periodo.de : `${dados.periodo.de}_a_${dados.periodo.ate}`
    if (aba === "pessoas") {
      baixarCsv(`acessos-pessoas-${periodo}.csv`, [
        ["Nome", "Tipo", "CPF", "RE", "Parentesco", "Colaborador", "RE do colaborador", "Primeiro acesso", "Último acesso", "Acessos", "Catracas"],
        ...listaPessoas.map((l) => [
          l.pessoa.nome, TIPO_SINGULAR[l.pessoa.tipo], l.pessoa.cpf ? formatCPF(l.pessoa.cpf) : "", l.pessoa.re ?? "",
          l.pessoa.dependencia ?? "", l.pessoa.colaborador?.nome ?? "", l.pessoa.colaborador?.re ?? "",
          diaHora(l.primeira), diaHora(l.ultima), l.acessos, [...l.catracas].map(nomeCatraca).join(", "),
        ]),
      ])
    } else if (aba === "linha") {
      baixarCsv(`acessos-linha-do-tempo-${periodo}.csv`, [
        ["Data e hora", "Nome", "Tipo", "CPF", "RE", "Colaborador", "Catraca", "Similaridade", "Leituras"],
        ...linhaDoTempo.map((a) => {
          const p = dados.pessoas[a.p]
          return [`${dataBR(local(a.em).slice(0, 10))} ${hora(a.em)}`, p.nome, TIPO_SINGULAR[p.tipo], p.cpf ? formatCPF(p.cpf) : "", p.re ?? "", p.colaborador ? responsavel(p.colaborador) : "", nomeCatraca(a.catraca), a.similaridade ?? "", a.leituras]
        }),
      ])
    } else {
      baixarCsv(`dependentes-que-nao-passaram-${periodo}.csv`, [
        ["Nome", "CPF", "Parentesco", "Colaborador", "RE do colaborador"],
        ...naoPassaram.map((ap) => [ap.nome, formatCPF(ap.cpf), ap.dependencia, ap.colaborador?.nome ?? "", ap.colaborador?.re ?? ""]),
      ])
    }
  }

  const ips = useMemo(() => {
    if (!dados) return []
    return [...new Set(dados.acessos.map((a) => a.catraca))].sort()
  }, [dados])

  const periodoTexto = dados ? (umDia ? dataBR(dados.periodo.de) : `${dataBR(dados.periodo.de)} a ${dataBR(dados.periodo.ate)}`) : ""
  const qtdLista = aba === "pessoas" ? listaPessoas.length : aba === "linha" ? linhaDoTempo.length : naoPassaram.length

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Dashboard
      </Button>

      {/* Filtros: uma linha acima de tudo */}
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
              {periodoTexto} · atualizado às {hora(dados.atualizadoEm)} · leituras de rosto da mesma pessoa com até 2 min de intervalo contam como 1 acesso
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
          {/* Indicadores */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Indicador titulo="Acessos" valor={numero(filtrados.length)} detalhe={`${numero(resumo.leituras)} leituras de rosto`} />
            <Indicador titulo="Pessoas diferentes" valor={numero(resumo.pessoas)} />
            <Indicador
              titulo="Dependentes"
              valor={numero(resumo.porTipo.dependente.size)}
              detalhe={
                resumo.aptos
                  ? `${numero(resumo.aptosQuePassaram)} de ${numero(resumo.aptos)} com foto aceita (${Math.round((resumo.aptosQuePassaram / resumo.aptos) * 100)}%)`
                  : undefined
              }
            />
            <Indicador titulo="Colaboradores" valor={numero(resumo.porTipo.colaborador.size)} />
            <Indicador titulo="Outros" valor={numero(resumo.porTipo.outro.size)} detalhe="fora do cadastro de colaboradores e dependentes" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Acessos por hora / por dia */}
            <Card className="bg-white border-slate-200 lg:col-span-2">
              <CardHeader>
                <CardTitle>Acessos por {umDia ? "hora" : "dia"}</CardTitle>
                <CardDescription>{periodoTexto}</CardDescription>
              </CardHeader>
              <CardContent>
                {grafico.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum acesso no período.</p>
                ) : (
                  <>
                    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
                      <BarChart data={grafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e1e0d9" />
                        <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: "#c3c2b7" }} tickMargin={8} minTickGap={8} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => numero(v)} />
                        <ChartTooltip cursor={{ fill: "rgba(11,11,11,0.05)" }} content={<ChartTooltipContent />} />
                        {tiposNoGrafico.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
                        {tiposNoGrafico.map((t) => (
                          <Bar key={t} dataKey={t} stackId="acessos" fill={chartConfig[t].color} maxBarSize={24} shape={segmento(t)} isAnimationActive={false} />
                        ))}
                      </BarChart>
                    </ChartContainer>
                    {tiposNoGrafico.length === 1 && (
                      <p className="text-xs text-slate-500 mt-2 text-center">{TIPO_LABEL[tiposNoGrafico[0]]}</p>
                    )}
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-slate-600">Ver os números</summary>
                      <table className="mt-2 w-full text-left tabular-nums">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="py-1 pr-2 font-medium">{umDia ? "Hora" : "Dia"}</th>
                            {tiposNoGrafico.map((t) => (
                              <th key={t} className="py-1 pr-2 font-medium text-right">{TIPO_LABEL[t]}</th>
                            ))}
                            <th className="py-1 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {grafico.map((g) => (
                            <tr key={g.rotulo}>
                              <td className="py-1 pr-2">{g.rotulo}</td>
                              {tiposNoGrafico.map((t) => (
                                <td key={t} className="py-1 pr-2 text-right">{numero(g[t])}</td>
                              ))}
                              <td className="py-1 text-right font-medium">{numero(g.total)}</td>
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
                <CardDescription>Onde as pessoas entraram</CardDescription>
              </CardHeader>
              <CardContent>
                {porCatraca.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum acesso no período.</p>
                ) : (
                  <ul className="space-y-3">
                    {porCatraca.map(([ip, n]) => (
                      <li key={ip} title={`${nomeCatraca(ip)}: ${numero(n)} acessos`}>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-700">
                            {nomeCatraca(ip)}
                            {dados.catracas[ip] && <span className="text-slate-400 text-xs"> · {ip}</span>}
                          </span>
                          <span className="font-medium text-slate-900 tabular-nums">{numero(n)}</span>
                        </div>
                        <div className="mt-1 h-2.5 rounded bg-slate-100">
                          <div className="h-2.5 rounded" style={{ width: `${(n / maxCatraca) * 100}%`, background: "#2a78d6" }} />
                        </div>
                      </li>
                    ))}
                  </ul>
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
                    <TabsTrigger value="nao">Dependentes que não passaram ({numero(naoPassaram.length)})</TabsTrigger>
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
                    {listaPessoas.slice(0, MAX_LINHAS).map((l) => (
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
                            {l.acessos === 1 ? `entrou ${fmt(l.primeira)}` : `${l.acessos} acessos · ${fmt(l.primeira)} a ${fmt(l.ultima)}`}
                          </p>
                          <p className="text-slate-500">{[...l.catracas].map(nomeCatraca).join(", ")}</p>
                        </div>
                      </li>
                    ))}
                  </Lista>
                </TabsContent>

                <TabsContent value="linha">
                  <Lista vazio={linhaDoTempo.length === 0}>
                    {linhaDoTempo.slice(0, MAX_LINHAS).map((a, i) => {
                      const p = dados.pessoas[a.p]
                      return (
                        <li key={`${a.p}-${a.em}-${i}`} className="px-3 py-2 flex gap-3">
                          <span className="w-24 shrink-0 font-mono text-slate-700">{fmt(a.em)}</span>
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
                  <p className="text-xs text-slate-500 mb-2">
                    Dependentes com foto aceita pelas catracas que não tiveram nenhum acesso no período
                    {catraca !== "todas" && ` (na catraca ${nomeCatraca(catraca)})`}.
                  </p>
                  {tipo !== "todos" && tipo !== "dependente" ? (
                    <p className="text-sm text-slate-500">Escolha o tipo &quot;Todos&quot; ou &quot;Dependentes&quot; para ver esta lista.</p>
                  ) : (
                    <Lista vazio={naoPassaram.length === 0}>
                      {naoPassaram.slice(0, MAX_LINHAS).map((ap) => (
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

"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ImageOff,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  WifiOff,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { formatCPF } from "@/lib/cpf"

type Envio = {
  id: string
  criado_em: string
  cpf: string | null
  nome: string | null
  origem: "colaborador" | "admin"
  acao: string
  resultado: string
  foto_url: string | null
  foto_anterior: string | null
  ip: string | null
  dispositivo: string | null
  detalhes: { motivo?: string; terminais?: Array<{ ip: string; face: string; cartao: string }> } | null
  colaborador: { nome_completo: string; re: string } | null
  admin: { username: string } | null
}
type Resumo = { total: number; aceitas: number; recusadas: number; semConexao: number; outros: number }

const ACAO: Record<string, string> = {
  envio: "Primeiro envio",
  troca: "Troca de foto",
  reenvio: "Reenvio",
  carga: "Carga (admin)",
  remocao: "Remoção das catracas",
}
const MOTIVO: Record<string, string> = {
  cpf_alterado: "CPF alterado no cadastro",
  nome_alterado: "Nome alterado no cadastro",
  dependente_excluido: "Dependente removido do cadastro",
}

// Situação: sempre ícone + texto (a cor nunca fala sozinha)
const RESULTADO: Record<string, { texto: string; classe: string; icone: LucideIcon }> = {
  aceita: { texto: "Aceita", classe: "text-green-700 bg-green-50 border-green-200", icone: CheckCircle2 },
  recusada: { texto: "Recusada", classe: "text-red-700 bg-red-50 border-red-200", icone: XCircle },
  sem_conexao: { texto: "Catracas sem resposta", classe: "text-amber-800 bg-amber-50 border-amber-200", icone: WifiOff },
  erro_foto: { texto: "Foto ilegível", classe: "text-red-700 bg-red-50 border-red-200", icone: ImageOff },
  removida: { texto: "Removida das catracas", classe: "text-slate-700 bg-slate-50 border-slate-200", icone: Trash2 },
  erro: { texto: "Erro", classe: "text-red-700 bg-red-50 border-red-200", icone: AlertCircle },
}

/** "Mozilla/5.0 (iPhone; ...) ... Safari" -> "iPhone · Safari" */
function aparelho(ua: string | null) {
  if (!ua) return "—"
  const so = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Outro"
  const nav = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : ""
  return nav ? `${so} · ${nav}` : so
}

const dataHora = (iso: string) =>
  new Date(iso)
    .toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .replace(", ", " às ")

const acaoTexto = (e: Envio) => (e.detalhes?.motivo && MOTIVO[e.detalhes.motivo]) || ACAO[e.acao] || e.acao

function Situacao({ resultado }: { resultado: string }) {
  const r = RESULTADO[resultado] ?? { texto: resultado, classe: "text-slate-700 bg-slate-50 border-slate-200", icone: AlertCircle }
  const Icone = r.icone
  return (
    <span className={`inline-flex w-fit shrink-0 self-start items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${r.classe}`}>
      <Icone className="w-3.5 h-3.5" /> {r.texto}
    </span>
  )
}

/** Foto com aviso quando o arquivo não existe mais (ex.: recusadas antes do histórico guardar a foto) */
function Foto({ url, rotulo, tamanho }: { url: string | null; rotulo: string; tamanho: number }) {
  const [falhou, setFalhou] = useState(false)
  if (!url || falhou) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-[10px] text-center leading-tight"
        style={{ width: tamanho, height: tamanho }}
        title={url ? "O arquivo desta foto não existe mais" : "Sem foto neste registro"}
      >
        <ImageOff className="w-4 h-4" />
        {url ? "foto apagada" : "sem foto"}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={rotulo}
      loading="lazy"
      onError={() => setFalhou(true)}
      className="rounded-md border border-slate-200 object-cover bg-slate-50"
      style={{ width: tamanho, height: tamanho }}
    />
  )
}

// PD-05: auditoria dos envios de foto às catracas, com as fotos
export function HistoricoEnvios() {
  const router = useRouter()
  const [busca, setBusca] = useState("")
  const [resultado, setResultado] = useState("todos")
  const [origem, setOrigem] = useState("todos")
  const [de, setDe] = useState("")
  const [ate, setAte] = useState("")
  const [envios, setEnvios] = useState<Envio[] | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [encontrados, setEncontrados] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<Envio | null>(null)

  const carregar = useCallback(
    async (opcoes: { pagina: number; resultado?: string }) => {
      setCarregando(true)
      setErro(null)
      const res = opcoes.resultado ?? resultado
      const qs = new URLSearchParams()
      if (busca.trim()) qs.set("q", busca.trim())
      if (res !== "todos") qs.set("resultado", res)
      if (origem !== "todos") qs.set("origem", origem)
      if (de) qs.set("de", de)
      if (ate) qs.set("ate", ate)
      qs.set("pagina", String(opcoes.pagina))
      try {
        const resp = await fetch(`/api/admin/envios?${qs}`, { cache: "no-store" })
        if (resp.status === 401) return router.replace("/admin/login")
        const json = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(json?.error || "Erro ao carregar o histórico")
        setEnvios((atual) => (opcoes.pagina === 0 ? json.envios : [...(atual ?? []), ...json.envios]))
        setResumo(json.resumo)
        setEncontrados(json.encontrados)
        setPagina(opcoes.pagina)
      } catch (e) {
        setErro((e as Error).message)
      } finally {
        setCarregando(false)
      }
    },
    [busca, resultado, origem, de, ate, router],
  )

  useEffect(() => {
    carregar({ pagina: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Clicar num número do resumo filtra por aquela situação */
  const filtrarPor = (r: string) => {
    setResultado(r)
    carregar({ pagina: 0, resultado: r })
  }

  const resumoItens: Array<{ chave: string; rotulo: string; valor: number; icone: LucideIcon; classe: string }> = resumo
    ? [
        { chave: "todos", rotulo: "Envios", valor: resumo.total, icone: RefreshCw, classe: "text-slate-700" },
        { chave: "aceita", rotulo: "Aceitas", valor: resumo.aceitas, icone: CheckCircle2, classe: "text-green-700" },
        { chave: "recusada", rotulo: "Recusadas", valor: resumo.recusadas, icone: XCircle, classe: "text-red-700" },
        { chave: "sem_conexao", rotulo: "Catracas sem resposta", valor: resumo.semConexao, icone: WifiOff, classe: "text-amber-700" },
      ]
    : []

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Dashboard
      </Button>

      {/* Filtros */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              carregar({ pagina: 0 })
            }}
          >
            <div className="space-y-1 flex-1 min-w-[220px]">
              <Label htmlFor="hist-busca">Dependente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input id="hist-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou CPF" className="pl-10" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Situação</Label>
              <Select value={resultado} onValueChange={setResultado}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {Object.entries(RESULTADO).map(([k, r]) => (
                    <SelectItem key={k} value={k}>
                      {r.texto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quem enviou</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="admin">Admin / RH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="hist-de">De</Label>
              <Input id="hist-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hist-ate">Até</Label>
              <Input id="hist-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
            </div>
            <Button type="submit" disabled={carregando}>
              {carregando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Resumo (com os filtros, menos o de situação): clicar filtra */}
      {resumo && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {resumoItens.map((it) => {
            const Icone = it.icone
            const ativo = resultado === it.chave
            return (
              <button
                key={it.chave}
                type="button"
                onClick={() => filtrarPor(it.chave)}
                className={`rounded-xl border bg-white p-4 text-left transition-shadow hover:shadow-md ${ativo ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"}`}
              >
                <p className={`flex items-center gap-1.5 text-sm ${it.classe}`}>
                  <Icone className="w-4 h-4" /> {it.rotulo}
                </p>
                <p className="text-2xl font-semibold text-slate-900">{it.valor.toLocaleString("pt-BR")}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Lista */}
      {envios && envios.length === 0 && <p className="text-sm text-slate-500">Nenhum registro encontrado.</p>}
      {envios && envios.length > 0 && (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {envios.map((e) => (
                <li key={e.id} className="flex gap-4 p-4">
                  <button
                    type="button"
                    onClick={() => setAberto(e)}
                    className="flex shrink-0 items-center gap-1.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    title="Ver as fotos"
                  >
                    {e.foto_anterior && (
                      <>
                        <Foto url={e.foto_anterior} rotulo={`Foto anterior de ${e.nome ?? "dependente"}`} tamanho={48} />
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </>
                    )}
                    <Foto url={e.foto_url} rotulo={`Foto enviada de ${e.nome ?? "dependente"}`} tamanho={72} />
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 break-words">{e.nome ?? "—"}</p>
                        <p className="text-xs text-slate-500">
                          {e.cpf ? formatCPF(e.cpf) : "—"}
                          {e.colaborador && <> · de {e.colaborador.nome_completo} (RE {e.colaborador.re})</>}
                        </p>
                      </div>
                      <Situacao resultado={e.resultado} />
                    </div>
                    <p className="text-sm text-slate-700">
                      {acaoTexto(e)} · {e.origem === "admin" ? `por ${e.admin?.username ?? "admin"}` : "pelo colaborador"}
                    </p>
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span>{dataHora(e.criado_em)}</span>
                      <span>IP {e.ip ?? "—"}</span>
                      <span>{aparelho(e.dispositivo)}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {envios && envios.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-slate-500">
            Mostrando {envios.length.toLocaleString("pt-BR")} de {encontrados.toLocaleString("pt-BR")}
          </p>
          {envios.length < encontrados && (
            <Button variant="outline" onClick={() => carregar({ pagina: pagina + 1 })} disabled={carregando}>
              {carregando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Carregar mais
            </Button>
          )}
        </div>
      )}

      {/* Fotos ampliadas */}
      <Dialog open={Boolean(aberto)} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">{aberto.nome ?? "Dependente"}</DialogTitle>
                <DialogDescription>
                  {acaoTexto(aberto)} · {dataHora(aberto.criado_em)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Situacao resultado={aberto.resultado} />
                <span className="text-sm text-slate-600">
                  {aberto.origem === "admin" ? `por ${aberto.admin?.username ?? "admin"}` : "pelo colaborador"}
                </span>
              </div>
              <div className={`grid gap-4 ${aberto.foto_anterior ? "sm:grid-cols-2" : ""}`}>
                {aberto.foto_anterior && (
                  <figure className="space-y-1">
                    <figcaption className="text-sm font-medium text-slate-700">Foto anterior</figcaption>
                    <Foto key={`a-${aberto.id}`} url={aberto.foto_anterior} rotulo="Foto anterior" tamanho={300} />
                  </figure>
                )}
                <figure className="space-y-1">
                  <figcaption className="text-sm font-medium text-slate-700">
                    {aberto.acao === "remocao" ? "Foto removida" : "Foto enviada"}
                  </figcaption>
                  <Foto key={`e-${aberto.id}`} url={aberto.foto_url} rotulo="Foto enviada" tamanho={300} />
                </figure>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-500">CPF</dt>
                <dd className="text-slate-800">{aberto.cpf ? formatCPF(aberto.cpf) : "—"}</dd>
                <dt className="text-slate-500">Colaborador</dt>
                <dd className="text-slate-800">{aberto.colaborador ? `${aberto.colaborador.nome_completo} (RE ${aberto.colaborador.re})` : "—"}</dd>
                <dt className="text-slate-500">IP</dt>
                <dd className="text-slate-800">{aberto.ip ?? "—"}</dd>
                <dt className="text-slate-500">Aparelho</dt>
                <dd className="text-slate-800">{aparelho(aberto.dispositivo)}</dd>
                {aberto.detalhes?.terminais?.length ? (
                  <>
                    <dt className="text-slate-500">Catracas</dt>
                    <dd className="text-slate-800">
                      {aberto.detalhes.terminais.map((t) => `${t.ip}: face ${t.face}, cartão ${t.cartao}`).join(" · ")}
                    </dd>
                  </>
                ) : null}
              </dl>
              {aberto.resultado === "recusada" && (
                <p className="text-xs text-slate-500">
                  Recusas acontecem quando o rosto não está de frente, com pouca luz, com boné ou óculos escuros, ou quando a foto não é de uma pessoa.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

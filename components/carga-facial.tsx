"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Loader2, ScanFace, Square, CheckCircle2, AlertCircle } from "lucide-react"

type Modo = "pendentes" | "recusadas" | "todas"
type Resultado = "aceita" | "recusada" | "sem_conexao" | "erro_foto" | "sem_foto" | "nao_encontrado"
type ItemFila = { id: string; nome_completo: string; colaborador: string | null }
type Resumo = {
  total: number
  comFoto: number
  semFoto: number
  aceitas: number
  recusadas: number
  nuncaEnviadas: number
}
type Execucao = {
  status: "rodando" | "concluida" | "interrompida"
  feitos: number
  total: number
  contagem: Partial<Record<Resultado, number>>
  problemas: Array<ItemFila & { resultado: Resultado }>
  mensagem?: string
}

// Dependentes por pedido: mantém cada chamada curta (cada foto leva alguns segundos)
const LOTE = 5

const ROTULO: Record<Resultado, string> = {
  aceita: "Aceita",
  recusada: "Recusada pelo facial",
  sem_conexao: "Catracas sem resposta",
  erro_foto: "Foto ilegível",
  sem_foto: "Sem foto",
  nao_encontrado: "Não encontrado",
}

export function CargaFacial() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>("pendentes")
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [fila, setFila] = useState<ItemFila[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [execucao, setExecucao] = useState<Execucao | null>(null)
  const parar = useRef(false)

  const rodando = execucao?.status === "rodando"

  const carregar = useCallback(
    async (m: Modo) => {
      setCarregando(true)
      setErro(null)
      try {
        const resp = await fetch(`/api/admin/facial?modo=${m}`, { cache: "no-store" })
        if (resp.status === 401) return router.replace("/admin/login")
        const json = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(json?.error || "Erro ao carregar")
        setResumo(json.resumo)
        setFila(json.fila)
      } catch (e) {
        setErro((e as Error).message)
      } finally {
        setCarregando(false)
      }
    },
    [router],
  )

  useEffect(() => {
    carregar(modo)
  }, [modo, carregar])

  // Avisa antes de fechar a página no meio da carga
  useEffect(() => {
    if (!rodando) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", aviso)
    return () => window.removeEventListener("beforeunload", aviso)
  }, [rodando])

  const iniciar = async () => {
    setConfirmar(false)
    parar.current = false
    const itens = [...fila]
    const porId = new Map(itens.map((d) => [d.id, d]))
    let estado: Execucao = { status: "rodando", feitos: 0, total: itens.length, contagem: {}, problemas: [] }
    setExecucao(estado)

    const finalizar = (status: Execucao["status"], mensagem?: string) => {
      estado = { ...estado, status, mensagem }
      setExecucao(estado)
    }

    for (let i = 0; i < itens.length; i += LOTE) {
      if (parar.current) return finalizar("interrompida", "Carga interrompida. As fotos já enviadas ficaram registradas.")

      const resp = await fetch("/api/admin/facial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: itens.slice(i, i + LOTE).map((d) => d.id) }),
      }).catch(() => null)
      if (resp?.status === 401) return router.replace("/admin/login")
      const json = await resp?.json().catch(() => ({}))
      if (!resp?.ok) {
        return finalizar("interrompida", json?.error || "Falha de conexão com o servidor. Carga interrompida.")
      }

      const resultados: Array<{ id: string; resultado: Resultado }> = json.resultados
      const contagem = { ...estado.contagem }
      const problemas = [...estado.problemas]
      for (const r of resultados) {
        contagem[r.resultado] = (contagem[r.resultado] ?? 0) + 1
        const item = porId.get(r.id)
        if (r.resultado !== "aceita" && r.resultado !== "sem_conexao" && item) problemas.push({ ...item, resultado: r.resultado })
      }
      estado = { ...estado, feitos: estado.feitos + resultados.length, contagem, problemas }
      setExecucao(estado)

      if (resultados.some((r) => r.resultado === "sem_conexao")) {
        return finalizar(
          "interrompida",
          "As catracas não responderam: carga interrompida. Verifique a rede entre o servidor e as catracas e tente de novo.",
        )
      }
    }
    finalizar("concluida")
  }

  // Ao terminar, atualiza o resumo e a fila
  useEffect(() => {
    if (execucao && execucao.status !== "rodando") carregar(modo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execucao?.status])

  const percentual = execucao && execucao.total > 0 ? Math.round((execucao.feitos / execucao.total) * 100) : 0

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push("/admin/dashboard")} disabled={rodando}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Dashboard
      </Button>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Situação das fotos */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {[
          { rotulo: "Com foto", valor: resumo?.comFoto, cor: "text-slate-900" },
          { rotulo: "Aceitas pelo facial", valor: resumo?.aceitas, cor: "text-green-700" },
          { rotulo: "Nunca enviadas", valor: resumo?.nuncaEnviadas, cor: "text-amber-600" },
          { rotulo: "Recusadas", valor: resumo?.recusadas, cor: "text-red-600" },
          { rotulo: "Sem foto", valor: resumo?.semFoto, cor: "text-slate-500" },
        ].map((s) => (
          <Card key={s.rotulo} className="bg-white border-slate-200">
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.cor}`}>{s.valor ?? "–"}</p>
              <p className="text-sm text-slate-600">{s.rotulo}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-pink-600" /> Carga no facial
          </CardTitle>
          <CardDescription>
            Envia às catracas as fotos dos dependentes e registra quais o facial aceitou.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)} disabled={rodando} className="space-y-3">
            <div className="flex items-start gap-3">
              <RadioGroupItem value="pendentes" id="modo-pendentes" className="mt-1" />
              <Label htmlFor="modo-pendentes" className="font-normal leading-snug cursor-pointer">
                <span className="font-medium">Somente fotos ainda não enviadas</span>
                <span className="block text-sm text-slate-500">Envia quem tem foto e nunca passou pelo facial.</span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="recusadas" id="modo-recusadas" className="mt-1" />
              <Label htmlFor="modo-recusadas" className="font-normal leading-snug cursor-pointer">
                <span className="font-medium">Tentar de novo as recusadas</span>
                <span className="block text-sm text-slate-500">Reenvia as fotos que o facial recusou na última tentativa.</span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="todas" id="modo-todas" className="mt-1" />
              <Label htmlFor="modo-todas" className="font-normal leading-snug cursor-pointer">
                <span className="font-medium">Todas as fotos (recarga completa)</span>
                <span className="block text-sm text-slate-500">
                  Reenvia inclusive as já aceitas. Use quando uma catraca for trocada ou resetada.
                </span>
              </Label>
            </div>
          </RadioGroup>

          {rodando ? (
            <Button variant="outline" onClick={() => (parar.current = true)} className="w-full sm:w-auto">
              <Square className="w-4 h-4 mr-2" /> Parar depois do lote atual
            </Button>
          ) : (
            <Button
              onClick={() => setConfirmar(true)}
              disabled={carregando || fila.length === 0}
              className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white"
            >
              {carregando ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando...</>
              ) : fila.length === 0 ? (
                "Nenhuma foto para enviar"
              ) : (
                <><ScanFace className="w-4 h-4 mr-2" /> Iniciar carga ({fila.length} foto{fila.length > 1 ? "s" : ""})</>
              )}
            </Button>
          )}

          {execucao && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  {rodando ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Enviando... não feche esta página
                    </span>
                  ) : execucao.status === "concluida" ? (
                    "Carga concluída"
                  ) : (
                    "Carga interrompida"
                  )}
                </span>
                <span className="text-slate-500">
                  {execucao.feitos} de {execucao.total}
                </span>
              </div>
              <Progress value={percentual} />

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="text-green-700">Aceitas: {execucao.contagem.aceita ?? 0}</span>
                <span className="text-red-600">Recusadas: {execucao.contagem.recusada ?? 0}</span>
                {(execucao.contagem.erro_foto ?? 0) > 0 && (
                  <span className="text-red-600">Foto ilegível: {execucao.contagem.erro_foto}</span>
                )}
                {(execucao.contagem.sem_foto ?? 0) + (execucao.contagem.nao_encontrado ?? 0) > 0 && (
                  <span className="text-slate-500">
                    Ignoradas: {(execucao.contagem.sem_foto ?? 0) + (execucao.contagem.nao_encontrado ?? 0)}
                  </span>
                )}
              </div>

              {execucao.status === "concluida" && (
                <p className="flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Todas as fotos da fila foram processadas.
                </p>
              )}
              {execucao.mensagem && (
                <p className="flex items-start gap-1.5 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {execucao.mensagem}
                </p>
              )}

              {execucao.problemas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    Precisam de foto nova (o colaborador tira outra pelo sistema):
                  </p>
                  <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded border border-slate-200 text-sm">
                    {execucao.problemas.map((p) => (
                      <li key={p.id} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          <span className="font-medium text-slate-800">{p.nome_completo}</span>
                          {p.colaborador && <span className="text-slate-500"> · {p.colaborador}</span>}
                        </span>
                        <span className="text-red-600">{ROTULO[p.resultado]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar {fila.length} foto{fila.length > 1 ? "s" : ""} às catracas?</AlertDialogTitle>
            <AlertDialogDescription>
              {modo === "todas"
                ? "Todas as fotos serão enviadas de novo. Quem já tem face na catraca só tem a face trocada se a nova for aceita; nenhuma é apagada. "
                : modo === "recusadas"
                  ? "As fotos recusadas na última tentativa serão enviadas de novo às catracas. "
                  : "As fotos ainda não enviadas serão cadastradas nas catracas. "}
              Pode levar alguns minutos; mantenha esta página aberta até terminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={iniciar} className="bg-pink-600 hover:bg-pink-700">
              Iniciar carga
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

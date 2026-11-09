"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { History, Loader2, RefreshCw, Search } from "lucide-react"
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
  colaborador: { nome_completo: string; re: string } | null
  admin: { username: string } | null
}

const ACAO: Record<string, string> = {
  envio: "Primeiro envio",
  troca: "Troca de foto",
  reenvio: "Reenvio",
  carga: "Carga (admin)",
  remocao: "Remoção das catracas",
}
const RESULTADO: Record<string, { texto: string; cor: string }> = {
  aceita: { texto: "Aceita", cor: "text-green-700" },
  removida: { texto: "Removida", cor: "text-slate-700" },
  recusada: { texto: "Recusada", cor: "text-red-600" },
  sem_conexao: { texto: "Catracas sem resposta", cor: "text-amber-600" },
  erro_foto: { texto: "Foto ilegível", cor: "text-red-600" },
  erro: { texto: "Erro", cor: "text-red-600" },
}

/** "Mozilla/5.0 (iPhone; ...) ... Safari" -> "iPhone · Safari" */
function aparelho(ua: string | null) {
  if (!ua) return "—"
  const so = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Outro"
  const nav = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : ""
  return nav ? `${so} · ${nav}` : so
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })

// PD-05: histórico de envios, trocas, cargas e remoções de foto nas catracas
export function HistoricoEnvios() {
  const router = useRouter()
  const [busca, setBusca] = useState("")
  const [envios, setEnvios] = useState<Envio[] | null>(null)
  const [limite, setLimite] = useState(300)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(
    async (q: string) => {
      setCarregando(true)
      setErro(null)
      try {
        const resp = await fetch(`/api/admin/envios${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" })
        if (resp.status === 401) return router.replace("/admin/login")
        const json = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(json?.error || "Erro ao carregar o histórico")
        setEnvios(json.envios)
        setLimite(json.limite)
      } catch (e) {
        setErro((e as Error).message)
      } finally {
        setCarregando(false)
      }
    },
    [router],
  )

  useEffect(() => {
    carregar("")
  }, [carregar])

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-700" /> Histórico de envios
        </CardTitle>
        <CardDescription>
          Cada envio, troca, carga e remoção de foto nas catracas, com data, hora, IP, aparelho e resultado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            carregar(busca.trim())
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome do dependente ou CPF" className="pl-10" />
          </div>
          <Button type="submit" variant="outline" disabled={carregando}>
            {carregando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Buscar
          </Button>
        </form>

        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {envios && envios.length === 0 && <p className="text-sm text-slate-500">Nenhum registro encontrado.</p>}

        {envios && envios.length > 0 && (
          <>
            <p className="text-xs text-slate-500">
              {envios.length === limite ? `Mostrando os ${limite} registros mais recentes.` : `${envios.length} registro(s).`}
            </p>
            <ul className="max-h-[32rem] overflow-y-auto divide-y divide-slate-100 rounded border border-slate-200 text-sm">
              {envios.map((e) => {
                const r = RESULTADO[e.resultado] ?? { texto: e.resultado, cor: "text-slate-700" }
                return (
                  <li key={e.id} className="px-3 py-2 space-y-1">
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        <span className="font-medium text-slate-800">{e.nome ?? "—"}</span>
                        {e.cpf && <span className="text-slate-500 font-mono"> · {formatCPF(e.cpf)}</span>}
                        {e.colaborador && <span className="text-slate-500"> · RE {e.colaborador.re}</span>}
                      </span>
                      <span className={`font-medium ${r.cor}`}>{r.texto}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      <span>{dataHora(e.criado_em)}</span>
                      <span>{ACAO[e.acao] ?? e.acao}</span>
                      <span>{e.origem === "admin" ? `por ${e.admin?.username ?? "admin"}` : "pelo colaborador"}</span>
                      <span>IP {e.ip ?? "—"}</span>
                      <span>{aparelho(e.dispositivo)}</span>
                      {e.foto_url && (
                        <a href={e.foto_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          foto enviada
                        </a>
                      )}
                      {e.foto_anterior && (
                        <a href={e.foto_anterior} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          foto anterior
                        </a>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

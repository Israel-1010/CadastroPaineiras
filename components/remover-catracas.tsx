"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Loader2, Search, Trash2 } from "lucide-react"
import { formatCPF } from "@/lib/cpf"

type Terminal = { ip: string; face: string; cartao: string }
type Item = {
  cpf: string
  no_banco: boolean
  nome?: string
  colaborador?: string | null
  tem_foto?: boolean
  foto_aceita?: boolean | null
  terminais?: Terminal[]
}

const LOTE = 10

/** Aceita CPFs um por linha ou separados por vírgula/espaço; completa zeros à esquerda */
function lerCpfs(texto: string) {
  const cpfs = texto
    .split(/[\s,;]+/)
    .map((t) => t.replace(/\D/g, ""))
    .filter(Boolean)
    .map((d) => (d.length < 11 ? d.padStart(11, "0") : d))
  return [...new Set(cpfs)]
}

// PD-08: remove das catracas (face e cartão) cadastros de teste e dependentes que saíram
export function RemoverCatracas() {
  const router = useRouter()
  const [texto, setTexto] = useState("")
  const [apagarFoto, setApagarFoto] = useState(false)
  const [conferidos, setConferidos] = useState<Item[] | null>(null)
  const [resultado, setResultado] = useState<Item[] | null>(null)
  const [ocupado, setOcupado] = useState<"conferindo" | "removendo" | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  const cpfs = useMemo(() => lerCpfs(texto), [texto])
  const invalidos = cpfs.filter((c) => c.length !== 11)

  async function enviar(simular: boolean) {
    const itens: Item[] = []
    for (let i = 0; i < cpfs.length; i += LOTE) {
      const resp = await fetch("/api/admin/facial/remover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpfs: cpfs.slice(i, i + LOTE), simular, apagarFoto }),
      }).catch(() => null)
      if (resp?.status === 401) {
        router.replace("/admin/login")
        return null
      }
      const json = await resp?.json().catch(() => ({}))
      if (!resp?.ok) throw new Error(json?.error || "Falha de conexão com o servidor")
      itens.push(...json.itens)
      if (!simular) setResultado([...itens])
    }
    return itens
  }

  async function conferir() {
    setErro(null)
    setResultado(null)
    setOcupado("conferindo")
    try {
      setConferidos(await enviar(true))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  async function remover() {
    setConfirmar(false)
    setErro(null)
    setOcupado("removendo")
    try {
      const itens = await enviar(false)
      if (itens) setResultado(itens)
    } catch (e) {
      setErro(`${(e as Error).message}. Os CPFs já processados aparecem abaixo.`)
    } finally {
      setOcupado(null)
    }
  }

  const ok = (s: string) => s === "removida" || s === "removido" || s === "não havia"

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-600" /> Remover das catracas
        </CardTitle>
        <CardDescription>
          Apaga a face e o cartão dos CPFs informados em todas as catracas. Use para cadastros de teste e para
          dependentes que saíram da base.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cpfs-remover">CPFs (um por linha ou separados por vírgula)</Label>
          <Textarea
            id="cpfs-remover"
            rows={5}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setConferidos(null)
              setResultado(null)
            }}
            disabled={ocupado !== null}
            placeholder={"52998224725\n111.444.777-35"}
          />
          <p className="text-xs text-slate-500">
            {cpfs.length} CPF{cpfs.length === 1 ? "" : "s"}
            {invalidos.length > 0 && <span className="text-red-600"> · {invalidos.length} com tamanho inválido</span>}
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="apagar-foto"
            checked={apagarFoto}
            onCheckedChange={(v) => setApagarFoto(v === true)}
            disabled={ocupado !== null}
            className="mt-0.5"
          />
          <Label htmlFor="apagar-foto" className="font-normal leading-snug cursor-pointer">
            Apagar também a foto no sistema (o colaborador precisará tirar outra). Indicado para fotos de teste.
          </Label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={conferir} disabled={!cpfs.length || invalidos.length > 0 || ocupado !== null}>
            {ocupado === "conferindo" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Conferir
          </Button>
          <Button
            onClick={() => setConfirmar(true)}
            disabled={!conferidos?.length || ocupado !== null}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {ocupado === "removendo" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Remover das catracas{conferidos?.length ? ` (${conferidos.length})` : ""}
          </Button>
        </div>

        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {(resultado ?? conferidos) && (
          <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded border border-slate-200 text-sm">
            {(resultado ?? conferidos)!.map((item) => (
              <li key={item.cpf} className="px-3 py-2 space-y-1">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="font-mono text-slate-600">{formatCPF(item.cpf)}</span>{" "}
                    {item.no_banco ? (
                      <>
                        <span className="font-medium text-slate-800">{item.nome}</span>
                        {item.colaborador && <span className="text-slate-500"> · {item.colaborador}</span>}
                      </>
                    ) : (
                      <span className="text-slate-500">não está no banco (só sai das catracas)</span>
                    )}
                  </span>
                  {item.no_banco && !item.terminais && (
                    <span className="text-slate-500">
                      {item.foto_aceita ? "face aceita na catraca" : item.tem_foto ? "tem foto" : "sem foto"}
                    </span>
                  )}
                </div>
                {item.terminais && (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    {item.terminais.map((t) => (
                      <span key={t.ip} className={ok(t.face) && ok(t.cartao) ? "text-green-700" : "text-red-600"}>
                        {t.ip}: face {t.face}, cartão {t.cartao}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {conferidos?.length} CPF{conferidos?.length === 1 ? "" : "s"} das catracas?</AlertDialogTitle>
            <AlertDialogDescription>
              A face e o cartão serão apagados em todas as catracas, e essas pessoas deixam de entrar pelo facial.
              {apagarFoto ? " A foto também será desvinculada no sistema." : " A foto no sistema é mantida."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remover} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

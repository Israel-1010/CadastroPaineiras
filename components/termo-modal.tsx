"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, ShieldCheck } from "lucide-react"
import { TERMO_CONCORDO, TERMO_SECOES, TERMO_TITULO, TERMO_VERSAO } from "@/lib/termo"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAceito: () => void
}

// PD-04: termo de consentimento exibido antes de tirar e enviar fotos
export function TermoModal({ open, onOpenChange, onAceito }: Props) {
  const [concordo, setConcordo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setConcordo(false)
      setErro(null)
    }
  }, [open])

  const aceitar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const resp = await fetch("/api/termo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versao: TERMO_VERSAO }),
      })
      const json = await resp.json().catch(() => ({}))
      if (resp.status === 401) throw new Error("Sessão expirada. Faça login novamente.")
      if (resp.status === 409) {
        // O termo mudou depois que a página abriu: recarrega para mostrar a versão nova
        window.location.reload()
        return
      }
      if (!resp.ok) throw new Error(json?.error || "Não foi possível registrar o aceite")
      onAceito()
      onOpenChange(false)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--primary)]" /> {TERMO_TITULO}
          </DialogTitle>
          <DialogDescription>Leia antes de tirar e enviar as fotos dos seus dependentes.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 rounded border border-[var(--border)] p-4 text-sm text-slate-700">
          {TERMO_SECOES.map((s) => (
            <section key={s.titulo} className="space-y-1">
              <h3 className="font-semibold text-slate-900">{s.titulo}</h3>
              {s.paragrafos?.map((p) => <p key={p}>{p}</p>)}
              {s.itens && (
                <ul className="list-disc pl-5 space-y-1">
                  {s.itens.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <p className="text-xs text-slate-400">Versão {TERMO_VERSAO}</p>
        </div>

        <div className="flex items-start gap-2 pt-2">
          <Checkbox id="termo-concordo" checked={concordo} onCheckedChange={(v) => setConcordo(v === true)} className="mt-0.5" />
          <Label htmlFor="termo-concordo" className="font-normal leading-snug cursor-pointer">
            {TERMO_CONCORDO}
          </Label>
        </div>

        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Agora não
          </Button>
          <Button onClick={aceitar} disabled={!concordo || salvando} className="bg-[var(--primary)] text-white hover:opacity-90">
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Aceitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

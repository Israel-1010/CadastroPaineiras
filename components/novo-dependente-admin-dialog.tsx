"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, Loader2, Save } from "lucide-react"
import { isValidCPF, maskCPFInput, onlyDigits } from "@/lib/cpf"
import { DEPENDENCIA_LABEL, DEPENDENCIAS, GENEROS } from "@/lib/types"

type ColaboradorResumo = { id: string; re: string; nome_completo: string }

// Mesmo critério da importação: parentesco que já indica o gênero preenche o campo
const GENERO_POR_DEPENDENCIA: Record<string, string> = {
  Filho: "Masculino",
  Enteado: "Masculino",
  Esposo: "Masculino",
  Filha: "Feminino",
  Esposa: "Feminino",
  Mae: "Feminino",
}

const VAZIO = { re: "", nome_completo: "", cpf: "", genero: "", dependencia: "", data_nascimento: "" }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (dependente: any) => void
}

export function NovoDependenteAdminDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(VAZIO)
  const [colaboradores, setColaboradores] = useState<ColaboradorResumo[] | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Lista de colaboradores para mostrar o nome assim que o RE é digitado
  useEffect(() => {
    if (!open || colaboradores) return
    fetch("/api/admin/colaboradores", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setColaboradores(json.colaboradores))
      .catch(() => setColaboradores([]))
  }, [open, colaboradores])

  useEffect(() => {
    if (open) {
      setForm(VAZIO)
      setErro(null)
    }
  }, [open])

  const colaborador = useMemo(
    () => colaboradores?.find((c) => c.re.trim() === form.re.trim()) ?? null,
    [colaboradores, form.re],
  )

  const set = (campo: keyof typeof VAZIO, valor: string) => setForm((f) => ({ ...f, [campo]: valor }))

  const setDependencia = (valor: string) =>
    setForm((f) => ({ ...f, dependencia: valor, genero: GENERO_POR_DEPENDENCIA[valor] ?? f.genero }))

  const completo = Object.values(form).every((v) => v.trim())

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completo) return setErro("Preencha todos os campos.")
    if (colaboradores?.length && !colaborador) return setErro(`Nenhum colaborador com RE ${form.re.trim()}.`)
    if (!isValidCPF(form.cpf)) return setErro("CPF inválido. Verifique os números digitados.")

    setSalvando(true)
    setErro(null)
    try {
      const resp = await fetch("/api/admin/dependentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, re: form.re.trim(), cpf: onlyDigits(form.cpf) }),
      })
      const json = await resp.json().catch(() => ({}))
      if (resp.status === 401) throw new Error("Sessão expirada. Faça login novamente.")
      if (!resp.ok) throw new Error(json?.error || "Erro ao cadastrar dependente")
      onCreated(json.dependente)
      onOpenChange(false)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo dependente</DialogTitle>
          <DialogDescription>A foto é tirada depois pelo colaborador, na tela dele.</DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nd-re">RE do colaborador *</Label>
            <Input id="nd-re" value={form.re} onChange={(e) => set("re", e.target.value)} inputMode="numeric" />
            {form.re.trim() && colaboradores && (
              colaborador ? (
                <p className="flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> {colaborador.nome_completo}
                </p>
              ) : (
                <p className="text-sm text-red-600">Nenhum colaborador com este RE</p>
              )
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nd-nome">Nome completo *</Label>
            <Input id="nd-nome" value={form.nome_completo} onChange={(e) => set("nome_completo", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nd-cpf">CPF *</Label>
              <Input
                id="nd-cpf"
                value={form.cpf}
                onChange={(e) => set("cpf", maskCPFInput(e.target.value))}
                maxLength={14}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nd-nasc">Data de nascimento *</Label>
              <Input
                id="nd-nasc"
                type="date"
                value={form.data_nascimento}
                onChange={(e) => set("data_nascimento", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Parentesco *</Label>
              <Select value={form.dependencia} onValueChange={setDependencia}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {DEPENDENCIAS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {DEPENDENCIA_LABEL[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gênero *</Label>
              <Select value={form.genero} onValueChange={(v) => set("genero", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {GENEROS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {erro && (
            <Alert variant="destructive">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !completo}>
              {salvando ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Cadastrar</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

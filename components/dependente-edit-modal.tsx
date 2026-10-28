"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PhotoUpload } from "@/components/photo-upload"
import { Save, X, Loader2 } from "lucide-react"
import { isValidCPF, maskCPFInput, onlyDigits } from "@/lib/cpf"
import type { Dependente } from "@/lib/types"

interface DependenteEditModalProps {
  dependente: Dependente | null
  isOpen: boolean
  onClose: () => void
  onSave: (dependente: Dependente) => void
}

/** Normaliza para "YYYY-MM-DD" sem timezone (evita o -1 dia no <input type="date" />) */
function toInputDate(value?: string): string {
  if (!value) return ""
  const s = String(value)
  // se começar com YYYY-MM-DD, pega só isso e ignora o resto (timezone/hora)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  // se vier em outro formato, não arrisca converter (evita -1 dia)
  return ""
}


export function DependenteEditModal({ dependente, isOpen, onClose, onSave }: DependenteEditModalProps) {
  const [formData, setFormData] = useState({
    nome_completo: "",
    cpf: "",
    genero: "",
    dependencia: "",
    data_nascimento: "",
    foto_url: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isSyncingFace, setIsSyncingFace] = useState(false)

  const isLoading = isSaving || isUploadingPhoto || isSyncingFace

  useEffect(() => {
    if (dependente) {
      setFormData({
        nome_completo: dependente.nome_completo,
        cpf: maskCPFInput(dependente.cpf),
        genero: dependente.genero,
        dependencia: dependente.dependencia,
        data_nascimento: toInputDate(dependente.data_nascimento),
        foto_url: dependente.foto_url || "",
      })
      setError(null)
    }
  }, [dependente])

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((p) => ({ ...p, cpf: maskCPFInput(e.target.value) }))
  }

  const handlePhotoChange = (photoUrl: string) => {
    setFormData((p) => ({ ...p, foto_url: photoUrl }))
  }

  const canSubmit = useMemo(() => {
    return Boolean(
      formData.nome_completo &&
      formData.cpf &&
      formData.genero &&
      formData.dependencia &&
      formData.data_nascimento
    )
  }, [formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dependente) return
    if (!canSubmit) return setError("Preencha os campos obrigatórios.")
    if (!isValidCPF(formData.cpf)) return setError("CPF inválido. Verifique os números digitados.")

    setIsSaving(true)
    setError(null)

    try {
      // 1) Salvar dependente
      const resp = await fetch(`/api/dependentes/${dependente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_completo: formData.nome_completo,
          cpf: onlyDigits(formData.cpf),
          genero: formData.genero,
          dependencia: formData.dependencia,
          data_nascimento: formData.data_nascimento, // "YYYY-MM-DD", sem timezone
          foto_url: formData.foto_url || null,
        }),
      })
      const result = await resp.json().catch(() => ({}))
      if (resp.status === 401) throw new Error("Sessão expirada. Faça login novamente.")
      if (!resp.ok) throw new Error(result?.error || "Erro ao salvar alterações")

      // Os dados já estão salvos: atualiza a lista mesmo que a sincronização da face falhe
      onSave({ ...dependente, ...result.dependente })

      // 2) Cartão de acesso (não bloqueia; servidor usa CPF e nome já salvos no banco)
      await fetch("/api/dahua/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependente_id: dependente.id }),
      }).catch(() => null)

      // 3) Face nos terminais (servidor usa CPF, nome e foto já salvos no banco)
      if (formData.foto_url) {
        setIsSyncingFace(true)
        try {
          const faceRes = await fetch("/api/dahua/face", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dependente_id: dependente.id }),
          })
          if (!faceRes.ok) {
            const faceJson = await faceRes.json().catch(() => ({}))
            setError(
              `Dados salvos, mas a foto não foi enviada às catracas (${faceJson?.error || "erro desconhecido"}). ` +
                "Clique em Salvar para tentar novamente.",
            )
            return
          }
        } finally {
          setIsSyncingFace(false)
        }
      }

      onClose()
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar")
    } finally {
      setIsSaving(false)
    }
  }

  if (!dependente) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Dependente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Foto */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Foto do Dependente</Label>
            <PhotoUpload
              currentPhotoUrl={formData.foto_url}
              onPhotoChange={handlePhotoChange}
              onUploadingChange={setIsUploadingPhoto} // mantém desabilitado durante upload
              userName={formData.nome_completo}
            />
            <p className="text-xs text-gray-500">Dica: clique na foto para abrir a câmera.</p>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nome Completo *</Label>
            <Input
              value={formData.nome_completo}
              onChange={(e) => setFormData((p) => ({ ...p, nome_completo: e.target.value }))}
              required
            />
          </div>

          {/* CPF */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">CPF *</Label>
            <Input value={formData.cpf} onChange={handleCPFChange} maxLength={14} required />
          </div>

          {/* Gênero & Dependência */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Gênero *</Label>
              <Select value={formData.genero} onValueChange={(v) => setFormData((p) => ({ ...p, genero: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Dependência *</Label>
              <Select value={formData.dependencia} onValueChange={(v) => setFormData((p) => ({ ...p, dependencia: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Filho">Filho</SelectItem>
                  <SelectItem value="Filha">Filha</SelectItem>
                  <SelectItem value="Esposa">Esposa</SelectItem>
                  <SelectItem value="Esposo">Esposo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data de nascimento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data de Nascimento *</Label>
            <Input
              type="date"
              value={formData.data_nascimento}
              onChange={(e) => setFormData((p) => ({ ...p, data_nascimento: e.target.value }))}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !canSubmit} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aguarde...</>) : (<><Save className="w-4 h-4 mr-2" /> Salvar</>)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

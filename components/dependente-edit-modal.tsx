"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PhotoUpload } from "@/components/photo-upload"
import { Save, X, Loader2, Send } from "lucide-react"
import { isValidCPF, maskCPFInput, onlyDigits } from "@/lib/cpf"
import { enviarAsCatracas } from "@/lib/terminais"
import { DEPENDENCIA_LABEL, DEPENDENCIAS, normalizeDependencia, type Dependente } from "@/lib/types"

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
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isSyncingFace, setIsSyncingFace] = useState(false)
  // Foto já gravada no banco (é a que o servidor envia às catracas)
  const [savedFotoUrl, setSavedFotoUrl] = useState("")

  const isLoading = isSaving || isUploadingPhoto || isSyncingFace
  // Botão de reenvio só faz sentido se a foto exibida já está salva
  const canResendPhoto = Boolean(savedFotoUrl) && formData.foto_url === savedFotoUrl

  useEffect(() => {
    if (dependente) {
      setFormData({
        nome_completo: dependente.nome_completo,
        cpf: maskCPFInput(dependente.cpf),
        genero: dependente.genero,
        dependencia: normalizeDependencia(dependente.dependencia), // "filha" do banco -> "Filha"
        data_nascimento: toInputDate(dependente.data_nascimento),
        foto_url: dependente.foto_url || "",
      })
      setSavedFotoUrl(dependente.foto_url || "")
      setError(null)
      setSuccess(null)
    }
  }, [dependente])

  const syncTerminals = async (dependenteId: string) => {
    setIsSyncingFace(true)
    try {
      return await enviarAsCatracas(dependenteId)
    } finally {
      setIsSyncingFace(false)
    }
  }

  const handleResendPhoto = async () => {
    if (!dependente) return
    setError(null)
    setSuccess(null)
    const faceError = await syncTerminals(dependente.id)
    if (faceError) setError(`Não foi possível enviar a foto às catracas (${faceError}). Tente novamente.`)
    else setSuccess("Foto enviada às catracas com sucesso.")
  }

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
      formData.data_nascimento &&
      formData.foto_url
    )
  }, [formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dependente) return
    if (!formData.foto_url) return setError("Tire a foto do dependente para continuar.")
    if (!canSubmit) return setError("Preencha os campos obrigatórios.")
    if (!isValidCPF(formData.cpf)) return setError("CPF inválido. Verifique os números digitados.")

    setIsSaving(true)
    setError(null)
    setSuccess(null)

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
      setSavedFotoUrl(formData.foto_url)

      // 2) Cartão e face nos terminais
      const faceError = await syncTerminals(dependente.id)
      if (faceError) {
        setError(
          `Dados salvos, mas a foto não foi enviada às catracas (${faceError}). ` +
            'Clique em "Enviar foto às catracas" para tentar novamente.',
        )
        return
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
            {formData.foto_url ? (
              <p className="text-xs text-gray-500">Dica: clique na foto para abrir a câmera.</p>
            ) : (
              <p className="text-xs text-amber-600">Este dependente ainda não tem foto. Tire a foto para poder salvar.</p>
            )}
            {canResendPhoto && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendPhoto}
                disabled={isLoading}
                className="w-full"
              >
                {isSyncingFace ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Enviar foto às catracas</>
                )}
              </Button>
            )}
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
                  {DEPENDENCIAS.map((d) => (
                    <SelectItem key={d} value={d}>{DEPENDENCIA_LABEL[d]}</SelectItem>
                  ))}
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
          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <AlertDescription>{success}</AlertDescription>
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

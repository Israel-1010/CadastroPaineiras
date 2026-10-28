"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PhotoUpload } from "@/components/photo-upload"
import { Save, X, UserPlus } from "lucide-react"
import { isValidCPF, maskCPFInput, onlyDigits } from "@/lib/cpf"
import { DEPENDENCIA_LABEL, DEPENDENCIAS, type Dependente } from "@/lib/types"

interface NovoDependenteModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (dependente: Dependente) => void
  colaboradorId: string
}

export function NovoDependenteModal({ isOpen, onClose, onSave, colaboradorId }: NovoDependenteModalProps) {
  const [formData, setFormData] = useState({
    nome_completo: "",
    cpf: "",
    genero: "",
    dependencia: "",
    data_nascimento: "",
    foto_url: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  // Muda a cada reset para remontar o PhotoUpload e limpar a prévia da foto anterior
  const [formKey, setFormKey] = useState(0)

  const resetForm = () => {
    setFormData({
      nome_completo: "",
      cpf: "",
      genero: "",
      dependencia: "",
      data_nascimento: "",
      foto_url: "",
    })
    setError(null)
    setFormKey((k) => k + 1)
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((p) => ({ ...p, cpf: maskCPFInput(e.target.value) }))
  }

  const handlePhotoChange = (photoUrl: string) => {
    setFormData((p) => ({ ...p, foto_url: photoUrl }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!isValidCPF(formData.cpf)) {
        throw new Error("CPF inválido. Verifique os números digitados.")
      }
      if (!formData.genero || !formData.dependencia) {
        throw new Error("Selecione o gênero e a dependência.")
      }

      // O colaborador é identificado pela sessão no servidor
      const response = await fetch("/api/dependentes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome_completo: formData.nome_completo,
          cpf: onlyDigits(formData.cpf),
          genero: formData.genero,
          dependencia: formData.dependencia,
          data_nascimento: formData.data_nascimento,
          foto_url: formData.foto_url || null,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (response.status === 401) throw new Error("Sessão expirada. Faça login novamente.")
      if (!response.ok) {
        throw new Error(result.error || "Erro ao cadastrar dependente")
      }

      onSave(result.dependente as Dependente)
      resetForm()
      onClose()
    } catch (error: any) {
      setError(error.message || "Erro ao cadastrar dependente")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <span>Adicionar Novo Dependente</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Upload de foto */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Foto do Dependente (opcional)</Label>
            <PhotoUpload
              key={formKey}
              currentPhotoUrl={formData.foto_url}
              onPhotoChange={handlePhotoChange}
              userName={formData.nome_completo || "Novo Dependente"}
            />
          </div>

          {/* Nome completo */}
          <div className="space-y-2">
            <Label htmlFor="nome_completo" className="text-sm font-medium">
              Nome Completo *
            </Label>
            <Input
              id="nome_completo"
              type="text"
              placeholder="Digite o nome completo"
              value={formData.nome_completo}
              onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
              required
            />
          </div>

          {/* CPF */}
          <div className="space-y-2">
            <Label htmlFor="cpf" className="text-sm font-medium">
              CPF *
            </Label>
            <Input
              id="cpf"
              type="text"
              placeholder="000.000.000-00"
              value={formData.cpf}
              onChange={handleCPFChange}
              maxLength={14}
              required
            />
          </div>

          {/* Gênero e Dependência */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="genero" className="text-sm font-medium">
                Gênero *
              </Label>
              <Select value={formData.genero} onValueChange={(value) => setFormData({ ...formData, genero: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dependencia" className="text-sm font-medium">
                Dependência *
              </Label>
              <Select
                value={formData.dependencia}
                onValueChange={(value) => setFormData({ ...formData, dependencia: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
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
            <Label htmlFor="data_nascimento" className="text-sm font-medium">
              Data de Nascimento *
            </Label>
            <Input
              id="data_nascimento"
              type="date"
              value={formData.data_nascimento}
              onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex space-x-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

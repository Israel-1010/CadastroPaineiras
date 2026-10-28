"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Save, X, UserPlus, ArrowLeft } from "lucide-react"
import { isValidCPF, maskCPFInput, onlyDigits } from "@/lib/cpf"

export function NovoColaboradorForm() {
  const [formData, setFormData] = useState({
    re: "",
    cpf: "",
    nome_completo: "",
    email: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, cpf: maskCPFInput(e.target.value) })
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const resetForm = () => {
    setFormData({
      re: "",
      cpf: "",
      nome_completo: "",
      email: "",
    })
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Validações
      if (!isValidCPF(formData.cpf)) {
        throw new Error("CPF inválido. Verifique os números digitados.")
      }

      if (!validateEmail(formData.email)) {
        throw new Error("Email inválido. Verifique o formato do email.")
      }

      const cleanCPF = onlyDigits(formData.cpf)

      const response = await fetch("/api/admin/colaboradores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          re: formData.re,
          cpf: cleanCPF,
          nome_completo: formData.nome_completo,
          email: formData.email,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Erro ao cadastrar colaborador")
      }

      resetForm()
      setSuccess("Colaborador cadastrado com sucesso!")
    } catch (error: any) {
      setError(error.message || "Erro ao cadastrar colaborador")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.push("/admin/dashboard")}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Dashboard</span>
        </Button>
      </div>

      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <span>Dados do Colaborador</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* RE */}
            <div className="space-y-2">
              <Label htmlFor="re" className="text-sm font-medium">
                Registro de Empregado (RE) *
              </Label>
              <Input
                id="re"
                type="text"
                placeholder="Digite o RE do colaborador"
                value={formData.re}
                onChange={(e) => setFormData({ ...formData, re: e.target.value })}
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

            {/* Nome Completo */}
            <div className="space-y-2">
              <Label htmlFor="nome_completo" className="text-sm font-medium">
                Nome Completo *
              </Label>
              <Input
                id="nome_completo"
                type="text"
                placeholder="Digite o nome completo do colaborador"
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="colaborador@empresa.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            <div className="flex space-x-4 pt-4">
              <Button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? "Cadastrando..." : "Cadastrar Colaborador"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} disabled={isLoading}>
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

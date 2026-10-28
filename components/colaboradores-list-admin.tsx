"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, UserPlus, Users, Mail, Award as IdCard, Calendar, Eye, EyeOff } from "lucide-react"
import { formatCPF, maskCPF, onlyDigits } from "@/lib/cpf"

interface Colaborador {
  id: string
  re: string
  cpf: string
  nome_completo: string
  email: string
  created_at: string
  dependentes: { count: number }[]
}

export function ColaboradoresListAdmin() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [filteredColaboradores, setFilteredColaboradores] = useState<Colaborador[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCPF, setShowCPF] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function loadColaboradores() {
      try {
        const response = await fetch("/api/admin/colaboradores", { cache: "no-store" })
        if (response.status === 401) {
          router.replace("/admin/login")
          return
        }
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Erro ao carregar colaboradores")
        }

        setColaboradores(data.colaboradores)
        setFilteredColaboradores(data.colaboradores)
      } catch (error) {
        setLoadError((error as Error).message || "Erro ao carregar colaboradores")
      } finally {
        setLoading(false)
      }
    }

    loadColaboradores()
  }, [router])

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase()
    const termDigits = onlyDigits(term)
    const filtered = colaboradores.filter(
      (colaborador) =>
        colaborador.nome_completo.toLowerCase().includes(term) ||
        colaborador.re.toLowerCase().includes(term) ||
        (termDigits.length > 0 && colaborador.cpf.includes(termDigits)) ||
        colaborador.email.toLowerCase().includes(term),
    )
    setFilteredColaboradores(filtered)
  }, [searchTerm, colaboradores])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("pt-BR")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando colaboradores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.push("/admin/dashboard")}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Dashboard</span>
        </Button>

        <Button onClick={() => router.push("/admin/colaboradores/novo")} className="bg-blue-600 hover:bg-blue-700">
          <UserPlus className="w-4 h-4 mr-2" />
          Novo Colaborador
        </Button>
      </div>

      {loadError && <p className="text-sm text-red-700">{loadError}</p>}

      {/* Barra de pesquisa */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Pesquisar por nome, RE, CPF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={() => setShowCPF((v) => !v)} title="Mostrar/ocultar CPFs">
            {showCPF ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showCPF ? "Ocultar CPFs" : "Mostrar CPFs"}
          </Button>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-slate-900">{colaboradores.length}</p>
                <p className="text-sm text-slate-600">Total de Colaboradores</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-slate-900">{filteredColaboradores.length}</p>
                <p className="text-sm text-slate-600">Resultados da Pesquisa</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {colaboradores.reduce((acc, col) => acc + (col.dependentes[0]?.count || 0), 0)}
                </p>
                <p className="text-sm text-slate-600">Total de Dependentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de colaboradores */}
      {filteredColaboradores.length === 0 ? (
        <Card className="text-center py-12 bg-white border-slate-200">
          <CardContent>
            <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {searchTerm ? "Nenhum colaborador encontrado" : "Nenhum colaborador cadastrado"}
            </h3>
            <p className="text-slate-600 mb-6">
              {searchTerm
                ? "Tente ajustar os termos da pesquisa"
                : "Comece adicionando o primeiro colaborador ao sistema"}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => router.push("/admin/colaboradores/novo")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Primeiro Colaborador
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredColaboradores.map((colaborador) => (
            <Card key={colaborador.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900 leading-tight break-words">
                  {colaborador.nome_completo}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-blue-100 text-blue-800">RE: {colaborador.re}</Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {colaborador.dependentes[0]?.count || 0} dependente
                    {colaborador.dependentes[0]?.count !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <IdCard className="w-4 h-4" />
                  <span>CPF: {showCPF ? formatCPF(colaborador.cpf) : maskCPF(colaborador.cpf)}</span>
                </div>

                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{colaborador.email}</span>
                </div>

                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Cadastrado em: {formatDate(colaborador.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, Users, Calendar, Award as IdCard, User, CheckCircle2, Clock3, Loader2, Eye, EyeOff } from "lucide-react"
import { formatCPF, maskCPF, onlyDigits } from "@/lib/cpf"

interface Dependente {
  id: string
  nome_completo: string
  cpf: string
  genero: string
  dependencia: string
  data_nascimento: string
  foto_url?: string
  colaborador_id: string
  presenca_confirmada?: boolean
  colaborador: {
    nome_completo: string
    re: string
  }
}

export function DependentesAdminList() {
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [filteredDependentes, setFilteredDependentes] = useState<Dependente[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDependencia, setFilterDependencia] = useState("todos")
  const [filterGenero, setFilterGenero] = useState("todos")
  const [loading, setLoading] = useState(true)
  const [updatingPresencaId, setUpdatingPresencaId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCPF, setShowCPF] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function loadDependentes() {
      try {
        const response = await fetch("/api/admin/dependentes", { cache: "no-store" })
        if (response.status === 401) {
          router.replace("/admin/login")
          return
        }
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Erro ao carregar dependentes")
        }

        setDependentes(data.dependentes)
        setFilteredDependentes(data.dependentes)
      } catch (error) {
        setLoadError((error as Error).message || "Erro ao carregar dependentes")
      } finally {
        setLoading(false)
      }
    }

    loadDependentes()
  }, [router])

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase()
    const termDigits = onlyDigits(term)
    const filtered = dependentes.filter((dependente) => {
      const matchesSearch =
        dependente.nome_completo.toLowerCase().includes(term) ||
        (termDigits.length > 0 && dependente.cpf.includes(termDigits)) ||
        (dependente.colaborador?.nome_completo ?? "").toLowerCase().includes(term) ||
        (dependente.colaborador?.re ?? "").toLowerCase().includes(term)

      const matchesDependencia = filterDependencia === "todos" || dependente.dependencia === filterDependencia
      const matchesGenero = filterGenero === "todos" || dependente.genero === filterGenero

      return matchesSearch && matchesDependencia && matchesGenero
    })

    setFilteredDependentes(filtered)
  }, [searchTerm, filterDependencia, filterGenero, dependentes])

  // Data sem timezone: new Date("2010-05-15") é UTC e mostraria o dia anterior no Brasil
  const formatDate = (raw: string) => {
    const m = String(raw || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(raw || "")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getDependenciaColor = (dependencia: string) => {
    switch (dependencia.toLowerCase()) {
      case "filho":
      case "filha":
        return "bg-green-100 text-green-800"
      case "esposa":
      case "esposo":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  const getGeneroColor = (genero: string) => {
    switch (genero.toLowerCase()) {
      case "masculino":
        return "bg-blue-50 text-blue-700"
      case "feminino":
        return "bg-pink-50 text-pink-700"
      default:
        return "bg-slate-50 text-slate-700"
    }
  }

  const handleDeleteDependente = async (dependenteId: string) => {
    if (!confirm("Tem certeza que deseja excluir este dependente?")) return

    try {
      const response = await fetch(`/api/admin/dependentes/${dependenteId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Erro ao excluir dependente")
      }

      setDependentes((prev) => prev.filter((dep) => dep.id !== dependenteId))
    } catch {
      alert("Erro ao excluir dependente")
    }
  }

  const handleTogglePresenca = async (dependenteId: string, presencaAtual: boolean) => {
    const novoStatus = !presencaAtual
    setUpdatingPresencaId(dependenteId)

    try {
      const response = await fetch(`/api/admin/dependentes/${dependenteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ presenca_confirmada: novoStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao atualizar presença")
      }

      const presencaRetornada =
        typeof data?.dependente?.presenca_confirmada === "boolean"
          ? data.dependente.presenca_confirmada
          : novoStatus

      setDependentes((prev) =>
        prev.map((dep) => (dep.id === dependenteId ? { ...dep, presenca_confirmada: presencaRetornada } : dep))
      )
    } catch {
      alert("Erro ao atualizar presença")
    } finally {
      setUpdatingPresencaId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando dependentes...</p>
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
      </div>

      {loadError && <p className="text-sm text-red-700">{loadError}</p>}

      {/* Filtros */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Pesquisar por nome, CPF ou colaborador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterDependencia} onValueChange={setFilterDependencia}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por dependência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as dependências</SelectItem>
                <SelectItem value="Filho">Filho</SelectItem>
                <SelectItem value="Filha">Filha</SelectItem>
                <SelectItem value="Esposa">Esposa</SelectItem>
                <SelectItem value="Esposo">Esposo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterGenero} onValueChange={setFilterGenero}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por gênero" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os gêneros</SelectItem>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Feminino">Feminino</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => setShowCPF((v) => !v)} title="Mostrar/ocultar CPFs">
              {showCPF ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showCPF ? "Ocultar CPFs" : "Mostrar CPFs"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-slate-900">{dependentes.length}</p>
                <p className="text-sm text-slate-600">Total de Dependentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-slate-900">{filteredDependentes.length}</p>
                <p className="text-sm text-slate-600">Resultados Filtrados</p>
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
                  {dependentes.filter((d) => d.dependencia === "Filho" || d.dependencia === "Filha").length}
                </p>
                <p className="text-sm text-slate-600">Filhos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {dependentes.filter((d) => d.dependencia === "Esposa" || d.dependencia === "Esposo").length}
                </p>
                <p className="text-sm text-slate-600">Cônjuges</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de dependentes */}
      {filteredDependentes.length === 0 ? (
        <Card className="text-center py-12 bg-white border-slate-200">
          <CardContent>
            <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {searchTerm || filterDependencia !== "todos" || filterGenero !== "todos"
                ? "Nenhum dependente encontrado"
                : "Nenhum dependente cadastrado"}
            </h3>
            <p className="text-slate-600">
              {searchTerm || filterDependencia !== "todos" || filterGenero !== "todos"
                ? "Tente ajustar os filtros de pesquisa"
                : "Os dependentes aparecerão aqui conforme forem cadastrados pelos colaboradores"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDependentes.map((dependente) => (
            <Card key={dependente.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={dependente.foto_url || "/placeholder.svg"} alt={dependente.nome_completo} />
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {getInitials(dependente.nome_completo)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg leading-tight break-words">{dependente.nome_completo}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className={getDependenciaColor(dependente.dependencia)}>{dependente.dependencia}</Badge>
                      <Badge variant="outline" className={getGeneroColor(dependente.genero)}>
                        {dependente.genero}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  {dependente.presenca_confirmada ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-green-700">Presença confirmada</span>
                    </>
                  ) : (
                    <>
                      <Clock3 className="w-4 h-4 text-amber-500" />
                      <span className="text-slate-700">Presença pendente</span>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <IdCard className="w-4 h-4" />
                  <span>CPF: {showCPF ? formatCPF(dependente.cpf) : maskCPF(dependente.cpf)}</span>
                </div>

                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Nascimento: {formatDate(dependente.data_nascimento)}</span>
                </div>

                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <User className="w-4 h-4" />
                  <span className="truncate">
                    {dependente.colaborador?.nome_completo ?? "—"} (RE: {dependente.colaborador?.re ?? "—"})
                  </span>
                </div>

                <div className="flex space-x-2 pt-2">
                  <Button
                    variant={dependente.presenca_confirmada ? "outline" : "default"}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleTogglePresenca(dependente.id, Boolean(dependente.presenca_confirmada))}
                    disabled={updatingPresencaId === dependente.id}
                  >
                    {updatingPresencaId === dependente.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : dependente.presenca_confirmada ? (
                      <>
                        <Clock3 className="w-4 h-4 mr-2" />
                        Marcar como pendente
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirmar presença
                      </>
                    )}
                  </Button>

                  
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

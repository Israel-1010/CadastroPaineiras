"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Users, UserCheck, TrendingUp, Calendar, Download } from "lucide-react"

interface RelatorioData {
  totalColaboradores: number
  totalDependentes: number
  dependentesPorTipo: Record<string, number>
  dependentesPorGenero: Record<string, number>
  colaboradoresSemDependentes: number
  colaboradoresComDependentes: number
}

export function RelatoriosAdmin() {
  const [data, setData] = useState<RelatorioData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadRelatorios() {
      try {
        const response = await fetch("/api/admin/relatorios", { cache: "no-store" })
        if (response.status === 401) {
          router.replace("/admin/login")
          return
        }
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Erro ao carregar relatórios")
        }

        setData(result.data)
      } catch (error) {
        console.error("Erro ao carregar relatórios:", (error as Error).message)
      } finally {
        setLoading(false)
      }
    }

    loadRelatorios()
  }, [router])

  const exportarRelatorio = () => {
    if (!data) return

    const csvContent = [
      "Relatório do Sistema de Atualização Cadastral",
      `Data de Geração: ${new Date().toLocaleDateString("pt-BR")}`,
      "",
      "RESUMO GERAL",
      `Total de Colaboradores: ${data.totalColaboradores}`,
      `Total de Dependentes: ${data.totalDependentes}`,
      `Colaboradores com Dependentes: ${data.colaboradoresComDependentes}`,
      `Colaboradores sem Dependentes: ${data.colaboradoresSemDependentes}`,
      "",
      "DEPENDENTES POR TIPO",
      ...Object.entries(data.dependentesPorTipo).map(([tipo, count]) => `${tipo}: ${count}`),
      "",
      "DEPENDENTES POR GÊNERO",
      ...Object.entries(data.dependentesPorGenero).map(([genero, count]) => `${genero}: ${count}`),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `relatorio_sistema_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando relatórios...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Erro ao carregar dados dos relatórios</p>
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

        <Button onClick={exportarRelatorio} className="bg-green-600 hover:bg-green-700">
          <Download className="w-4 h-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      {/* Resumo Geral */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{data.totalColaboradores}</div>
            <p className="text-xs text-slate-600">Cadastrados no sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Dependentes</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{data.totalDependentes}</div>
            <p className="text-xs text-slate-600">Cadastrados no sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Com Dependentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{data.colaboradoresComDependentes}</div>
            <p className="text-xs text-slate-600">
              {data.totalColaboradores > 0
                ? `${((data.colaboradoresComDependentes / data.totalColaboradores) * 100).toFixed(1)}% do total`
                : "0% do total"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Sem Dependentes</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{data.colaboradoresSemDependentes}</div>
            <p className="text-xs text-slate-600">
              {data.totalColaboradores > 0
                ? `${((data.colaboradoresSemDependentes / data.totalColaboradores) * 100).toFixed(1)}% do total`
                : "0% do total"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dependentes por Tipo */}
      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle>Dependentes por Tipo de Dependência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.dependentesPorTipo).map(([tipo, count]) => (
              <div key={tipo} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-900">{tipo}</span>
                <span className="text-2xl font-bold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dependentes por Gênero */}
      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle>Dependentes por Gênero</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(data.dependentesPorGenero).map(([genero, count]) => (
              <div key={genero} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-900">{genero}</span>
                <span className="text-2xl font-bold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Métricas Adicionais */}
      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle>Métricas do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Média de Dependentes por Colaborador</p>
              <p className="text-2xl font-bold text-blue-900">
                {data.totalColaboradores > 0 ? (data.totalDependentes / data.totalColaboradores).toFixed(1) : "0"}
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Taxa de Colaboradores com Dependentes</p>
              <p className="text-2xl font-bold text-green-900">
                {data.totalColaboradores > 0
                  ? `${((data.colaboradoresComDependentes / data.totalColaboradores) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Total de Registros no Sistema</p>
              <p className="text-2xl font-bold text-purple-900">{data.totalColaboradores + data.totalDependentes}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Stats {
  totalColaboradores: number
  totalDependentes: number
}

interface AdminStatsProps {
  stats: Stats
}

export function AdminStats({ stats }: AdminStatsProps) {
  const avgDependentesPorColaborador =
    stats.totalColaboradores > 0 ? (stats.totalDependentes / stats.totalColaboradores).toFixed(1) : "0"

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <Card className="bg-white border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Total de Colaboradores</CardTitle>
          <span className="text-blue-600">👥</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">{stats.totalColaboradores}</div>
          <p className="text-xs text-slate-600">Colaboradores cadastrados</p>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Total de Dependentes</CardTitle>
          <span className="text-green-600">✅</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">{stats.totalDependentes}</div>
          <p className="text-xs text-slate-600">Dependentes cadastrados</p>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Média de Dependentes</CardTitle>
          <span className="text-purple-600">📈</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">{avgDependentesPorColaborador}</div>
          <p className="text-xs text-slate-600">Por colaborador</p>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Total de Registros</CardTitle>
          <span className="text-orange-600">🗄️</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">{stats.totalColaboradores + stats.totalDependentes}</div>
          <p className="text-xs text-slate-600">No sistema</p>
        </CardContent>
      </Card>
    </div>
  )
}

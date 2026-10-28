"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function AdminNavigation() {
  const router = useRouter()

  const navigationItems = [
    {
      title: "Cadastrar Colaborador",
      description: "Adicionar novo colaborador manualmente",
      icon: "👤➕",
      color: "bg-blue-50 border-blue-200",
      action: () => router.push("/admin/colaboradores/novo"),
    },
    {
      title: "Gerenciar Colaboradores",
      description: "Visualizar e editar colaboradores existentes",
      icon: "👥",
      color: "bg-green-50 border-green-200",
      action: () => router.push("/admin/colaboradores"),
    },
    {
      title: "Upload Colaboradores",
      description: "Importar colaboradores via arquivo Excel",
      icon: "📊",
      color: "bg-purple-50 border-purple-200",
      action: () => router.push("/admin/upload"),
    },
    {
      title: "Upload Dependentes",
      description: "Importar dependentes via arquivo Excel",
      icon: "👶📊",
      color: "bg-orange-50 border-orange-200",
      action: () => router.push("/admin/upload-dependentes"),
    },
    {
      title: "Gerenciar Dependentes",
      description: "Visualizar e gerenciar todos os dependentes",
      icon: "👶",
      color: "bg-pink-50 border-pink-200",
      action: () => router.push("/admin/dependentes"),
    },
    {
      title: "Relatórios",
      description: "Visualizar relatórios e estatísticas",
      icon: "📈",
      color: "bg-indigo-50 border-indigo-200",
      action: () => router.push("/admin/relatorios"),
    },
    {
      title: "Configurações",
      description: "Configurações do sistema",
      icon: "⚙️",
      color: "bg-slate-50 border-slate-200",
      action: () => router.push("/admin/configuracoes"),
    },
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {navigationItems.map((item, index) => (
        <Card key={index} className={`${item.color} hover:shadow-md transition-shadow cursor-pointer`}>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg">
                <span className="text-lg">{item.icon}</span>
              </div>
              <CardTitle className="text-lg text-slate-900">{item.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{item.description}</p>
            <Button
              onClick={item.action}
              className="w-full bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              variant="outline"
            >
              Acessar
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Baby, BarChart3, FileSpreadsheet, FileUp, ScanFace, Settings, Users, type LucideIcon } from "lucide-react"
import { pode, type Perfil, type Permissao } from "@/lib/permissoes"

export function AdminNavigation({ perfil }: { perfil: Perfil }) {
  const router = useRouter()

  const navigationItems: Array<{
    title: string
    description: string
    icon: LucideIcon
    iconColor: string
    color: string
    permissao: Permissao
    action: () => void
  }> = [
    {
      title: "Gerenciar Colaboradores",
      // O cadastro manual fica no botão dentro desta tela (o card próprio foi retirado)
      description: "Visualizar, cadastrar e editar colaboradores",
      icon: Users,
      iconColor: "text-green-600",
      color: "bg-green-50 border-green-200",
      permissao: "cadastro",
      action: () => router.push("/admin/colaboradores"),
    },
    {
      title: "Upload Colaboradores",
      description: "Importar colaboradores via arquivo Excel",
      icon: FileSpreadsheet,
      iconColor: "text-purple-600",
      color: "bg-purple-50 border-purple-200",
      permissao: "cadastro",
      action: () => router.push("/admin/upload"),
    },
    {
      title: "Upload Dependentes",
      description: "Importar dependentes via arquivo Excel",
      icon: FileUp,
      iconColor: "text-orange-600",
      color: "bg-orange-50 border-orange-200",
      permissao: "cadastro",
      action: () => router.push("/admin/upload-dependentes"),
    },
    {
      title: "Gerenciar Dependentes",
      description: "Visualizar e gerenciar todos os dependentes",
      icon: Baby,
      iconColor: "text-pink-600",
      color: "bg-pink-50 border-pink-200",
      permissao: "cadastro",
      action: () => router.push("/admin/dependentes"),
    },
    {
      title: "Carga no Facial",
      description: "Enviar às catracas as fotos dos dependentes",
      icon: ScanFace,
      iconColor: "text-rose-600",
      color: "bg-rose-50 border-rose-200",
      permissao: "facial",
      action: () => router.push("/admin/facial"),
    },
    {
      title: "Relatórios",
      description: "Visualizar relatórios e estatísticas",
      icon: BarChart3,
      iconColor: "text-indigo-600",
      color: "bg-indigo-50 border-indigo-200",
      permissao: "relatorios",
      action: () => router.push("/admin/relatorios"),
    },
    {
      title: "Configurações",
      description: "Configurações do sistema",
      icon: Settings,
      iconColor: "text-slate-600",
      color: "bg-slate-50 border-slate-200",
      permissao: "sistema",
      action: () => router.push("/admin/configuracoes"),
    },
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {navigationItems.filter((item) => pode(perfil, item.permissao)).map((item, index) => (
        <Card key={index} className={`${item.color} hover:shadow-md transition-shadow cursor-pointer`}>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg">
                <item.icon className={`w-5 h-5 ${item.iconColor}`} />
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

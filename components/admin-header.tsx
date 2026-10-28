"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import type { Admin } from "@/lib/types"

interface AdminHeaderProps {
  admin: Admin
}

export function AdminHeader({ admin }: AdminHeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null)
    router.replace("/admin/login")
  }

  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-full">
              <div className="w-5 h-5 bg-slate-600 rounded"></div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Sistema Administrativo</h1>
              <p className="text-sm text-slate-600">Gestão de colaboradores e dependentes</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-3">
                <div className="text-sm">
                  <p className="font-medium text-slate-900 flex items-center">👤 {admin.nome_completo}</p>
                  <p className="text-slate-600">@{admin.username}</p>
                  <p className="text-slate-600">{admin.email}</p>
                </div>
              </CardContent>
            </Card>

            <Button variant="outline" onClick={handleLogout} className="flex items-center space-x-2 bg-transparent">
              <span>🚪 Sair</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminHeader } from "@/components/admin-header"
import { AdminStats } from "@/components/admin-stats"
import { AdminNavigation } from "@/components/admin-navigation"
import type { Admin } from "@/lib/types"

interface Stats {
  totalColaboradores: number
  totalDependentes: number
}

export function AdminDashboardClient() {
  const [data, setData] = useState<{ admin: Admin; stats: Stats } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Remove dados de sessão da versão antiga (antes do cookie httpOnly)
    try {
      localStorage.removeItem("admin")
      sessionStorage.removeItem("admin")
    } catch {}

    async function loadSession() {
      try {
        const response = await fetch("/api/admin/auth/session", { cache: "no-store" })
        if (response.status === 401) {
          router.replace("/admin/login")
          return
        }
        if (!response.ok) throw new Error()
        setData(await response.json())
      } catch {
        setError("Não foi possível carregar o painel. Tente novamente em instantes.")
      }
    }

    loadSession()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <p className="text-slate-700 text-center">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando painel administrativo...</p>
        </div>
      </div>
    )
  }

  const { admin, stats } = data

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader admin={admin} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Painel Administrativo</h1>
          <p className="text-slate-600">Gerencie colaboradores e dependentes do sistema</p>
        </div>

        <AdminStats stats={stats} />
        <AdminNavigation />
      </div>
    </div>
  )
}

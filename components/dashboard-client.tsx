"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { DependentesList } from "@/components/dependentes-list"
import type { Colaborador, Dependente } from "@/lib/types"

export function DashboardClient() {
  const [data, setData] = useState<{ colaborador: Colaborador; dependentes: Dependente[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Remove dados de sessão da versão antiga (antes do cookie httpOnly)
    try {
      localStorage.removeItem("colaborador")
      sessionStorage.removeItem("colaborador")
    } catch {}

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        if (response.status === 401) {
          router.replace("/login")
          return
        }
        if (!response.ok) throw new Error()
        setData(await response.json())
      } catch {
        setError("Não foi possível carregar seus dados. Tente novamente em instantes.")
      }
    }

    loadSession()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-700 text-center">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  const { colaborador, dependentes } = data

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader colaborador={colaborador} />
      <main className="container mx-auto px-4 py-8">
        <DependentesList dependentes={dependentes} colaboradorId={colaborador.id} />
      </main>
    </div>
  )
}

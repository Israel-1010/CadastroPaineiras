"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LogOut, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { formatCPF } from "@/lib/cpf"
import type { Colaborador } from "@/lib/types"

interface DashboardHeaderProps {
  colaborador: Colaborador
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("")
}

export function DashboardHeader({ colaborador }: DashboardHeaderProps) {
  const router = useRouter()
  const sigla = useMemo(() => initials(colaborador?.nome_completo || ""), [colaborador?.nome_completo])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
    router.replace("/login")
  }

  return (
    <header className="bg-white border-b">
      {/* faixa magenta */}
      <div className="h-1 w-full bg-[var(--primary)]" />

      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* título + ícone */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="grid h-10 w-10 place-items-center rounded-full text-white shadow-[0_10px_24px_-12px_rgba(236,0,139,.35)]"
              style={{ background: "var(--primary)" }}
              aria-hidden
            >
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg sm:text-xl font-semibold tracking-tight">
                Atualização Cadastral
              </h1>
              <p className="hidden sm:block text-sm text-[var(--muted-foreground)]">
                Gerencie os dados dos seus dependentes
              </p>
            </div>
          </div>

          {/* cartão do colaborador + sair */}
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <Card className="flex-1 sm:flex-none sm:min-w-[280px] bg-[var(--secondary)] border-[var(--border)] rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-3">
                <div
                  className="grid h-10 w-10 place-items-center rounded-full text-white"
                  style={{ background: "var(--primary)" }}
                  aria-label={`Perfil de ${colaborador.nome_completo}`}
                >
                  <span className="text-sm font-semibold">{sigla || "?"}</span>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{colaborador.nome_completo}</p>
                  <div className="mt-0.5 grid grid-cols-1 gap-0.5 text-xs text-[var(--accent-foreground)] sm:grid-cols-2 sm:gap-x-3">
                    <span className="truncate">
                      <span className="text-[var(--muted-foreground)]">RE:</span> {colaborador.re}
                    </span>
                    <span className="truncate">
                      <span className="text-[var(--muted-foreground)]">CPF:</span> {formatCPF(colaborador.cpf)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botão SAIR visível (magenta sólido) */}
            <Button
              onClick={handleLogout}
              className="shrink-0 bg-[var(--primary)] text-white hover:opacity-95 shadow-[0_10px_24px_-12px_rgba(236,0,139,.35)] px-4"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span> Sair </span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

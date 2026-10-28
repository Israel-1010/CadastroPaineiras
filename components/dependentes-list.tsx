"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Edit, Calendar, Award as IdCard, Users } from "lucide-react"
import { DependenteEditModal } from "@/components/dependente-edit-modal"
import { NovoDependenteModal } from "@/components/novo-dependente-modal"
import { formatCPF } from "@/lib/cpf"
import { dependenciaLabel, normalizeDependencia, type Dependente } from "@/lib/types"

interface DependentesListProps {
  dependentes: Dependente[]
  colaboradorId: string
}

export function DependentesList({ dependentes: initialDependentes, colaboradorId }: DependentesListProps) {
  const [dependentes, setDependentes] = useState(initialDependentes)
  const [selectedDependente, setSelectedDependente] = useState<Dependente | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)

  const formatDate = (raw: string) => {
  const m = String(raw || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(raw || "")
  const [, y, mo, d] = m
  return `${d}/${mo}/${y}` // pt-BR, sem timezone
}

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  // pills com identidade do clube
  const getDependenciaClass = (dependencia: string) => {
    const d = normalizeDependencia(dependencia)
    if (["Filho", "Filha", "Enteado"].includes(d)) return "bg-[var(--accent)] text-[var(--accent-foreground)] border border-transparent"
    if (["Conjuge", "Companheiro", "Esposa", "Esposo"].includes(d)) return "bg-[var(--secondary)] text-[var(--accent-foreground)] border border-[var(--border)]"
    return "bg-[var(--secondary)] text-[var(--accent-foreground)] border border-[var(--border)]"
  }

  const getGeneroClass = (genero: string) => {
    const g = genero.toLowerCase()
    if (g === "feminino") return "bg-[var(--secondary)] text-[var(--accent-foreground)] border border-[var(--border)]"
    if (g === "masculino") return "bg-[var(--secondary)] text-[var(--accent-foreground)] border border-[var(--border)]"
    return "bg-[var(--secondary)] text-[var(--accent-foreground)] border border-[var(--border)]"
  }

  const handleEditDependente = (dependente: Dependente) => {
    setSelectedDependente(dependente)
    setIsEditModalOpen(true)
  }

  const handleSaveDependente = (updatedDependente: Dependente) => {
    setDependentes((prev) => prev.map((dep) => (dep.id === updatedDependente.id ? updatedDependente : dep)))
  }

  const handleAddDependente = (novoDependente: Dependente) => {
    setDependentes((prev) => [...prev, novoDependente])
  }

  const handleOpenNewModal = () => setIsNewModalOpen(true)

  return (
    <div className="space-y-6">
      {/* Cabeçalho da seção */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-[var(--color-foreground)] tracking-tight">Dependentes</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {dependentes.length === 0
              ? "Nenhum dependente cadastrado"
              : `${dependentes.length} dependente${dependentes.length > 1 ? "s" : ""} cadastrado${
                  dependentes.length > 1 ? "s" : ""
                }`}
          </p>
        </div>

        
      </div>

      {/* Estado vazio */}
      {dependentes.length === 0 ? (
        <Card className="rounded-2xl border-[var(--border)] bg-white text-center shadow-sm">
          <CardContent className="py-12">
            <Users className="w-16 h-16 text-[var(--border)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--color-foreground)] mb-2">Nenhum dependente cadastrado</h3>
            <p className="text-[var(--muted-foreground)] mb-6">Comece adicionando informações dos seus dependentes</p>
           
          </CardContent>
        </Card>
      ) : (
        // Grid responsivo
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dependentes.map((dependente) => (
            <Card
              key={dependente.id}
              className="rounded-2xl border-[var(--border)] hover:shadow-[0_16px_36px_-14px_rgba(236,0,139,.25)] transition-shadow bg-white"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 ring-2 ring-[var(--accent)]">
                    <AvatarImage src={dependente.foto_url || "/placeholder.svg"} alt={dependente.nome_completo} />
                    <AvatarFallback className="bg-[var(--secondary)] text-[var(--primary)] font-semibold">
                      {getInitials(dependente.nome_completo)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg leading-tight break-words">
                      {dependente.nome_completo}
                    </CardTitle>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge className={getDependenciaClass(dependente.dependencia)}>{dependenciaLabel(dependente.dependencia)}</Badge>
                      <Badge variant="outline" className={getGeneroClass(dependente.genero)}>
                        {dependente.genero}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-[var(--accent-foreground)]">
                  <IdCard className="w-4 h-4 text-[var(--primary)]" />
                  <span className="truncate">CPF: {formatCPF(dependente.cpf)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-[var(--accent-foreground)]">
                  <Calendar className="w-4 h-4 text-[var(--primary)]" />
                  <span className="truncate">Nascimento: {formatDate(dependente.data_nascimento)}</span>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-transparent hover:bg-[var(--secondary)]"
                    onClick={() => handleEditDependente(dependente)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de edição */}
      <DependenteEditModal
        dependente={selectedDependente}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedDependente(null)
        }}
        onSave={handleSaveDependente}
      />

      {/* Modal de novo dependente */}
      <NovoDependenteModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSave={handleAddDependente}
        colaboradorId={colaboradorId}
      />
    </div>
  )
}

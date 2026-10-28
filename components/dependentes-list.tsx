"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Award as IdCard, Users, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { NovoDependenteModal } from "@/components/novo-dependente-modal"
import { PhotoUpload } from "@/components/photo-upload"
import { formatCPF } from "@/lib/cpf"
import { dependenciaLabel, normalizeDependencia, type Dependente } from "@/lib/types"

type EstadoEnvio = { status: "enviando" | "ok" | "erro"; mensagem?: string }

interface DependentesListProps {
  dependentes: Dependente[]
  colaboradorId: string
}

export function DependentesList({ dependentes: initialDependentes, colaboradorId }: DependentesListProps) {
  const [dependentes, setDependentes] = useState(initialDependentes)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  // Situação do envio às catracas, por dependente
  const [envio, setEnvio] = useState<Record<string, EstadoEnvio>>({})
  // Foto nova escolhida e ainda não enviada, por dependente
  const [pendente, setPendente] = useState<Record<string, string>>({})

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

  const setEnvioDe = (id: string, estado: EstadoEnvio) => setEnvio((prev) => ({ ...prev, [id]: estado }))

  /** Foto nova escolhida (já no S3), ainda não enviada: mostra no cartão e habilita "Enviar foto" */
  const handleNovaFoto = (id: string, fotoUrl: string) => {
    setPendente((prev) => ({ ...prev, [id]: fotoUrl }))
    setEnvio((prev) => {
      const { [id]: _, ...resto } = prev
      return resto
    })
  }

  const descartarPendente = (id: string) =>
    setPendente((prev) => {
      const { [id]: _, ...resto } = prev
      return resto
    })

  /**
   * Envia às catracas a foto nova (se houver) ou reenvia a já salva.
   * O servidor só grava a foto nova se o facial aceitar e registra o resultado em foto_aceita.
   */
  const handleEnviar = async (dependente: Dependente) => {
    const fotoNova = pendente[dependente.id]
    setEnvioDe(dependente.id, { status: "enviando" })
    const resp = await fetch(`/api/dependentes/${dependente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fotoNova ? { foto_url: fotoNova } : {}),
    }).catch(() => null)
    const json = await resp?.json().catch(() => ({}))
    if (json?.dependente) handleSaveDependente({ ...dependente, ...json.dependente })
    if (!resp?.ok) {
      // Recusada: o servidor já apagou o arquivo novo, então é preciso tirar outra
      if (json?.descartada) descartarPendente(dependente.id)
      const mensagem =
        resp?.status === 401
          ? "Sessão expirada. Faça login novamente."
          : json?.error || "Não foi possível enviar a foto (erro de conexão). Tente novamente."
      return setEnvioDe(dependente.id, { status: "erro", mensagem })
    }
    descartarPendente(dependente.id)
    setEnvioDe(dependente.id, { status: "ok", mensagem: "Foto enviada às catracas com sucesso!" })
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
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20 shrink-0 ring-2 ring-[var(--accent)]">
                    <AvatarImage
                      src={pendente[dependente.id] || dependente.foto_url || "/placeholder.svg"}
                      alt={dependente.nome_completo}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-[var(--secondary)] text-[var(--primary)] text-xl font-semibold">
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

                <div className="pt-2 space-y-2">
                  {dependente.foto_url || pendente[dependente.id] ? (
                    <p className="text-xs text-[var(--muted-foreground)]">Trocar foto:</p>
                  ) : (
                    <p className="text-xs text-amber-600">Sem foto. Tire ou escolha uma foto do dependente:</p>
                  )}
                  <PhotoUpload
                    variant="buttons"
                    userName={dependente.nome_completo}
                    onPhotoChange={(url) => url && handleNovaFoto(dependente.id, url)}
                  />

                  {(() => {
                    const estado = envio[dependente.id]?.status
                    const temNova = Boolean(pendente[dependente.id])
                    // Foto salva ainda não aceita pelo facial (nunca enviada ou recusada): pode (re)enviar
                    const podeEnviar = temNova || (Boolean(dependente.foto_url) && dependente.foto_aceita !== true)
                    if (!temNova && dependente.foto_aceita === true) {
                      return (
                        <Button disabled className="w-full bg-green-600 text-white disabled:opacity-100">
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Foto enviada
                        </Button>
                      )
                    }
                    return (
                      <Button
                        className="w-full bg-[var(--primary)] text-white hover:opacity-90"
                        onClick={() => handleEnviar(dependente)}
                        disabled={!podeEnviar || estado === "enviando"}
                        title={podeEnviar ? undefined : "Tire ou escolha uma foto para enviar"}
                      >
                        {estado === "enviando" ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                          <><Send className="w-4 h-4 mr-2" /> Enviar foto</>
                        )}
                      </Button>
                    )
                  })()}

                  {/* Recusa registrada em envio anterior (some quando há resultado novo nesta tela) */}
                  {!envio[dependente.id] && !pendente[dependente.id] && dependente.foto_aceita === false && (
                    <p className="flex items-start gap-1.5 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> A catraca recusou a última foto. Tire outra foto.
                    </p>
                  )}
                  {envio[dependente.id]?.status === "ok" && (
                    <p className="flex items-center gap-1.5 text-sm text-green-700">
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> {envio[dependente.id].mensagem}
                    </p>
                  )}
                  {envio[dependente.id]?.status === "erro" && (
                    <p className="flex items-start gap-1.5 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {envio[dependente.id].mensagem}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

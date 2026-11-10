import { supabaseAdmin } from "@/lib/supabase/server"
import { onlyDigits } from "@/lib/cpf"

type DependenteEnvio = { id: string; cpf: string; foto_enviada_em?: string | null }

/** A catraca guarda o CPF com 11 dígitos; o banco às vezes perde os zeros à esquerda */
const variantesCpf = (cpf: string) => {
  const d = onlyDigits(cpf)
  return [...new Set([d, d.padStart(11, "0")])]
}

/**
 * Primeira passagem pelo facial (tabela `passages`, user_id = CPF) de cada dependente
 * DEPOIS do envio da foto atual (foto_enviada_em). Retorna id do dependente -> data da passagem.
 *
 * Passou com a foto atual = a foto já funcionou na catraca, então o colaborador não troca mais.
 * Passagens de antes do envio (ex.: evento de 12/2025, com outra foto) não contam.
 * Se o admin remover das catracas ou reenviar pela Carga, foto_enviada_em muda e a contagem recomeça.
 * Erro na consulta não bloqueia ninguém (só avisa no log).
 */
export async function passagensDepoisDoEnvio(dependentes: DependenteEnvio[]): Promise<Map<string, string>> {
  const resultado = new Map<string, string>()
  const enviados = dependentes.filter((d) => d.foto_enviada_em && onlyDigits(d.cpf))
  await Promise.all(
    enviados.map(async (d) => {
      const { data, error } = await supabaseAdmin
        .from("passages")
        .select("timestamp")
        .in("user_id", variantesCpf(d.cpf))
        .gte("timestamp", d.foto_enviada_em!)
        .order("timestamp")
        .limit(1)
      if (error) return console.warn("[passagens] consulta falhou:", error.message)
      if (data?.[0]?.timestamp) resultado.set(d.id, data[0].timestamp)
    }),
  )
  return resultado
}

/** "10/11/2026 às 07:47" no horário de Brasília */
export const dataHoraBrasilia = (iso: string) =>
  new Date(iso)
    .toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(", ", " às ")

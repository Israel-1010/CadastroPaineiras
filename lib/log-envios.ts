// PD-05 (servidor): histórico de envios, trocas, cargas e remoções de foto nas catracas.
// Best effort: falha ao gravar (ex.: tabela ainda não criada) nunca interrompe o envio.
import { supabaseAdmin } from "@/lib/supabase/server"
import { clientIp } from "@/lib/auth"

export type AcaoEnvio = "envio" | "troca" | "reenvio" | "carga" | "remocao"
export type ResultadoEnvio = "aceita" | "recusada" | "sem_conexao" | "erro_foto" | "removida" | "erro"

export type RegistroEnvio = {
  origem: "colaborador" | "admin"
  acao: AcaoEnvio
  resultado: ResultadoEnvio
  dependente?: { id: string; cpf: string; nome_completo: string; colaborador_id?: string | null } | null
  cpf?: string
  colaboradorId?: string | null
  adminId?: string | null
  fotoUrl?: string | null
  fotoAnterior?: string | null
  detalhes?: unknown
}

/** IP e aparelho de quem fez a ação, para o histórico */
export const origemDaRequisicao = (req: Request) => ({
  ip: clientIp(req),
  dispositivo: (req.headers.get("user-agent") ?? "").slice(0, 300),
})

export async function registrarEnvio(req: Request, r: RegistroEnvio) {
  try {
    const { error } = await supabaseAdmin.from("envios_foto").insert({
      dependente_id: r.dependente?.id ?? null,
      colaborador_id: r.colaboradorId ?? r.dependente?.colaborador_id ?? null,
      admin_id: r.adminId ?? null,
      cpf: r.dependente?.cpf ?? r.cpf ?? null,
      nome: r.dependente?.nome_completo ?? null,
      origem: r.origem,
      acao: r.acao,
      resultado: r.resultado,
      foto_url: r.fotoUrl ?? null,
      foto_anterior: r.fotoAnterior ?? null,
      detalhes: r.detalhes ?? null,
      ...origemDaRequisicao(req),
    })
    if (error) console.warn("[log-envios] não gravado:", error.message)
  } catch (err) {
    console.warn("[log-envios] não gravado:", (err as Error).message)
  }
}

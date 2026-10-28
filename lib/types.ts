export const GENEROS = ["Masculino", "Feminino"] as const
// Valores como estão gravados no banco (sem acento); DEPENDENCIA_LABEL é só para exibir
export const DEPENDENCIAS = [
  "Filho",
  "Filha",
  "Enteado",
  "Conjuge",
  "Companheiro",
  "Esposa",
  "Esposo",
  "Mae",
  "Outros",
] as const

export type Genero = (typeof GENEROS)[number]
export type Dependencia = (typeof DEPENDENCIAS)[number]

export const DEPENDENCIA_LABEL: Record<Dependencia, string> = {
  Filho: "Filho",
  Filha: "Filha",
  Enteado: "Enteado",
  Conjuge: "Cônjuge",
  Companheiro: "Companheiro(a)",
  Esposa: "Esposa",
  Esposo: "Esposo",
  Mae: "Mãe",
  Outros: "Outros",
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

/** "filha", "CÔNJUGE ", "Mãe" -> valor canônico; devolve o texto original se não reconhecer */
export function normalizeDependencia(value: string): string {
  const v = semAcento(value)
  return DEPENDENCIAS.find((d) => semAcento(d) === v) ?? value.trim()
}

export const dependenciaLabel = (value: string) =>
  DEPENDENCIA_LABEL[normalizeDependencia(value) as Dependencia] ?? value

export interface Colaborador {
  id: string
  re: string
  cpf: string
  nome_completo: string
  email: string
}

export interface Dependente {
  id: string
  nome_completo: string
  cpf: string
  genero: string
  dependencia: string
  data_nascimento: string
  foto_url?: string | null
  colaborador_id: string
  /** null = foto nunca enviada às catracas; true = facial aceitou; false = recusou */
  foto_aceita?: boolean | null
  foto_enviada_em?: string | null
}

export interface Admin {
  id: string
  username: string
  nome_completo: string
  email: string
  ativo: boolean
}

export interface ImportResult {
  success: number
  errors: Array<{ row: number; error: string }>
  duplicates: Array<{ row: number; field: string; value: string }>
}

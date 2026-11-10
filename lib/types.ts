import type { Perfil } from "@/lib/permissoes"

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

// A planilha usa "FILHO (A)", "ENTEADO", "COMPANHEIRO" para os dois sexos: a etiqueta segue o gênero
const LABEL_FEMININO: Partial<Record<Dependencia, string>> = {
  Filho: "Filha",
  Enteado: "Enteada",
  Companheiro: "Companheira",
}
const LABEL_MASCULINO: Partial<Record<Dependencia, string>> = {
  Filha: "Filho",
  Companheiro: "Companheiro",
}

export const dependenciaLabel = (value: string, genero?: string | null) => {
  const dep = normalizeDependencia(value) as Dependencia
  if (genero === "Feminino" && LABEL_FEMININO[dep]) return LABEL_FEMININO[dep]!
  if (genero === "Masculino" && LABEL_MASCULINO[dep]) return LABEL_MASCULINO[dep]!
  return DEPENDENCIA_LABEL[dep] ?? value
}

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
  /** "colaborador" quando o último envio foi feito pelo próprio colaborador; a carga do admin não preenche */
  foto_enviada_por?: string | null
  /** Primeira passagem pelo facial depois do envio da foto atual: a partir daí o colaborador não troca a foto */
  passou_facial_em?: string | null
}

export interface Admin {
  id: string
  username: string
  nome_completo: string
  email: string
  ativo: boolean
  perfil: Perfil
}

export interface ImportResult {
  success: number
  errors: Array<{ row: number; error: string }>
  duplicates: Array<{ row: number; field: string; value: string }>
}

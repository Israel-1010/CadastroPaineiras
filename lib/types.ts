export const GENEROS = ["Masculino", "Feminino"] as const
export const DEPENDENCIAS = ["Filho", "Filha", "Esposa", "Esposo"] as const

export type Genero = (typeof GENEROS)[number]
export type Dependencia = (typeof DEPENDENCIAS)[number]

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

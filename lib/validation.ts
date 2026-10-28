import { z } from "zod"
import { isValidCPF, onlyDigits } from "@/lib/cpf"
import { DEPENDENCIAS, GENEROS } from "@/lib/types"

/** "YYYY-MM-DD" válida, entre 1900-01-01 e hoje */
export function isValidBirthDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return false
  return y >= 1900 && date.getTime() <= Date.now()
}

const nome = z
  .string()
  .trim()
  .min(3, "Nome deve ter pelo menos 3 caracteres")
  .max(150, "Nome muito longo")

export const cpfSchema = z
  .string()
  .transform(onlyDigits)
  .refine(isValidCPF, "CPF inválido")

export const dependenteSchema = z.object({
  nome_completo: nome,
  cpf: cpfSchema,
  genero: z.enum(GENEROS, { errorMap: () => ({ message: "Gênero inválido" }) }),
  dependencia: z.enum(DEPENDENCIAS, { errorMap: () => ({ message: "Dependência inválida" }) }),
  data_nascimento: z.string().refine(isValidBirthDate, "Data de nascimento inválida"),
  foto_url: z.string().url().max(1000).nullish(),
})

export const colaboradorSchema = z.object({
  re: z.string().trim().regex(/^\d{1,20}$/, "RE deve conter apenas números"),
  cpf: cpfSchema,
  nome_completo: nome,
  email: z.string().trim().toLowerCase().email("Email inválido").max(255),
})

export const loginColaboradorSchema = z.object({
  re: z.string().trim().regex(/^\d{1,20}$/),
  cpf: cpfSchema,
})

export const loginAdminSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
})

/** Primeira mensagem de erro do zod, para devolver ao usuário */
export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message || "Dados inválidos"
}

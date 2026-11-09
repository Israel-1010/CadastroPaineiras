// PD-01: dados pessoais que vão para a tela do colaborador saem do servidor já mascarados.
// O CPF completo continua só no banco e no servidor (envio às catracas usa o id do dependente).
import { maskCPF } from "@/lib/cpf"

const CONECTIVOS = new Set(["DA", "DE", "DO", "DAS", "DOS", "E", "D"])

/** "PIETRO RODRIGUES RIBEIRO DOS SANTOS" -> "PIETRO R. R. S." */
export function mascararNome(nome: string | null | undefined) {
  const [primeiro = "", ...resto] = String(nome ?? "").trim().split(/\s+/)
  const iniciais = resto.filter((p) => !CONECTIVOS.has(p.toUpperCase())).map((p) => p[0].toUpperCase() + ".")
  return [primeiro, ...iniciais].join(" ")
}

/** "2015-05-12" -> "12/05/****" */
export function mascararNascimento(iso: string | null | undefined) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/****` : ""
}

export function colaboradorParaTela(c: { id: string; re: string; cpf: string; nome_completo: string }) {
  return { id: c.id, re: c.re, nome_completo: mascararNome(c.nome_completo), cpf: maskCPF(c.cpf) }
}

export function dependenteParaTela<T extends { nome_completo: string; cpf: string; data_nascimento: string }>(d: T): T {
  return {
    ...d,
    nome_completo: mascararNome(d.nome_completo),
    cpf: maskCPF(d.cpf),
    data_nascimento: mascararNascimento(d.data_nascimento),
  }
}

// PD-02: perfis do painel administrativo. Usado pelo servidor (bloqueio) e pela tela (o que aparece).

export type Perfil = "admin" | "rh"
export type Permissao = "cadastro" | "presenca" | "excluir" | "relatorios" | "facial" | "sistema"

const DO_PERFIL: Record<Perfil, readonly Permissao[]> = {
  admin: ["cadastro", "presenca", "excluir", "relatorios", "facial", "sistema"],
  // RH: cadastra, corrige e remove colaboradores e dependentes (inclusive por planilha). Nada de catracas,
  // exceto que remover um dependente também tira a face dele das catracas.
  // "excluir" só é usado na remoção de dependentes.
  rh: ["cadastro", "excluir"],
}

/**
 * Sem a coluna perfil (antes do 009_perfil_rh.sql) todo usuário é admin, como sempre foi.
 * Valor desconhecido cai no perfil mais restrito.
 */
export const perfilDe = (valor: unknown): Perfil => (valor == null || valor === "admin" ? "admin" : "rh")

export const pode = (perfil: unknown, permissao: Permissao) => DO_PERFIL[perfilDe(perfil)].includes(permissao)

export const MSG_SEM_PERMISSAO = "Seu usuário não tem acesso a esta função."

// PD-02: perfis do painel administrativo. Usado pelo servidor (bloqueio) e pela tela (o que aparece).

export type Perfil = "admin" | "rh"
// "historico": só consultar o Histórico de Fotos (separado de "facial", que envia e remove faces nas catracas)
export type Permissao = "cadastro" | "presenca" | "excluir" | "relatorios" | "facial" | "historico" | "sistema"

const DO_PERFIL: Record<Perfil, readonly Permissao[]> = {
  admin: ["cadastro", "presenca", "excluir", "relatorios", "facial", "historico", "sistema"],
  // RH: cadastra, corrige e remove colaboradores e dependentes (inclusive por planilha) e consulta o
  // Histórico de Fotos. Não faz carga nem remoção direta nas catracas; remover um dependente, porém,
  // também tira a face dele das catracas. "excluir" só é usado na remoção de dependentes.
  rh: ["cadastro", "excluir", "historico"],
}

/**
 * Sem a coluna perfil (antes do 009_perfil_rh.sql) todo usuário é admin, como sempre foi.
 * Valor desconhecido cai no perfil mais restrito.
 */
export const perfilDe = (valor: unknown): Perfil => (valor == null || valor === "admin" ? "admin" : "rh")

export const pode = (perfil: unknown, permissao: Permissao) => DO_PERFIL[perfilDe(perfil)].includes(permissao)

export const MSG_SEM_PERMISSAO = "Seu usuário não tem acesso a esta função."

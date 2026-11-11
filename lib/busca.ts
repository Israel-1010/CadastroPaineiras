// Pesquisa das listas do painel: sem diferença de maiúsculas e acentos, e aceitando campos vazios.

/** Texto em minúsculas e sem acentos ("JOÃO" -> "joao"); vazio quando o campo não existe */
export const semAcento = (valor: unknown) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Todas as palavras pesquisadas aparecem no texto, em qualquer ordem ("israel lima" acha "ISRAEL DE LIMA ALVES") */
export const temPalavras = (valor: unknown, termo: string) => {
  const texto = semAcento(valor)
  return semAcento(termo)
    .split(/\s+/)
    .filter(Boolean)
    .every((palavra) => texto.includes(palavra))
}

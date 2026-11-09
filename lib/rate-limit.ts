// PD-03: bloqueio por tentativas de login erradas (em memória: vale para um container).
// Conta só falhas; um login certo zera a chave daquele usuário.

const JANELA_MS = 15 * 60 * 1000

type Registro = { falhas: number; inicio: number; bloqueadoAte: number }
const registros = new Map<string, Registro>()

function atual(chave: string, agora: number) {
  const r = registros.get(chave)
  if (!r) return null
  if (r.bloqueadoAte <= agora && agora - r.inicio > JANELA_MS) {
    registros.delete(chave)
    return null
  }
  return r
}

/** Segundos até liberar (0 = liberado) */
export function segundosBloqueado(chave: string) {
  const agora = Date.now()
  const r = atual(chave, agora)
  return r && r.bloqueadoAte > agora ? Math.ceil((r.bloqueadoAte - agora) / 1000) : 0
}

/** Registra uma falha; ao chegar em `max` falhas na janela, bloqueia por 15 minutos */
export function registrarFalha(chave: string, max: number) {
  const agora = Date.now()
  if (registros.size > 20_000) {
    for (const [k, r] of registros) if (r.bloqueadoAte <= agora && agora - r.inicio > JANELA_MS) registros.delete(k)
  }
  const r = atual(chave, agora) ?? { falhas: 0, inicio: agora, bloqueadoAte: 0 }
  r.falhas++
  if (r.falhas >= max) r.bloqueadoAte = agora + JANELA_MS
  registros.set(chave, r)
}

export function limparFalhas(chave: string) {
  registros.delete(chave)
}

/** Mensagem de bloqueio com o tempo restante em minutos */
export function respostaBloqueio(segundos: number) {
  const minutos = Math.max(1, Math.ceil(segundos / 60))
  return {
    body: { error: `Muitas tentativas erradas. Tente de novo em ${minutos} minuto${minutos > 1 ? "s" : ""}.` },
    init: { status: 429, headers: { "Retry-After": String(segundos) } },
  }
}

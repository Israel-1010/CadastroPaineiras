export const onlyDigits = (value: string) => String(value ?? "").replace(/\D/g, "")

/** Máscara progressiva para inputs: 000.000.000-00 */
export function maskCPFInput(value: string) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

export function formatCPF(cpf: string) {
  return onlyDigits(cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

/** Exibe só os dígitos do meio: ***.456.789-** */
export function maskCPF(cpf: string) {
  const n = onlyDigits(cpf)
  if (n.length !== 11) return "***.***.***-**"
  return `***.${n.slice(3, 6)}.${n.slice(6, 9)}-**`
}

export function isValidCPF(value: string) {
  const s = onlyDigits(value)
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false
  const dv = (base: string, factorStart: number) => {
    let sum = 0
    let factor = factorStart
    for (const c of base) sum += Number(c) * factor--
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  const dv1 = dv(s.slice(0, 9), 10)
  const dv2 = dv(s.slice(0, 9) + dv1, 11)
  return s.endsWith(`${dv1}${dv2}`)
}

/**
 * Envia cartão e face da foto JÁ SALVA do dependente às catracas (uso no navegador).
 * Retorna null em caso de sucesso ou a mensagem de erro do envio da face.
 */
export async function enviarAsCatracas(dependenteId: string): Promise<string | null> {
  const body = JSON.stringify({ dependente_id: dependenteId })
  const headers = { "Content-Type": "application/json" }

  // Cartão de acesso: não bloqueia (servidor usa CPF e nome já salvos no banco)
  await fetch("/api/dahua/card", { method: "POST", headers, body }).catch(() => null)

  // Face nos terminais (servidor usa CPF, nome e foto já salvos no banco)
  const faceRes = await fetch("/api/dahua/face", { method: "POST", headers, body }).catch(() => null)
  if (faceRes?.ok) return null
  if (faceRes?.status === 401) return "sessão expirada, faça login novamente"
  const faceJson = await faceRes?.json().catch(() => ({}))
  return faceJson?.error || "erro de conexão"
}

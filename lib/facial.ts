// Envio da foto de um dependente às catracas, com o resultado classificado.
// Usado pelo cartão do colaborador e pela carga em lote do admin.
import { syncFace, upsertCard } from "@/lib/dahua"
import { getObject } from "@/lib/s3"

/**
 * aceita:      ao menos um terminal cadastrou a face
 * recusada:    os terminais responderam, mas recusaram a foto (a face anterior já foi removida deles)
 * sem_conexao: nenhum terminal respondeu (ou integração não configurada): problema de rede, não da foto
 * erro_foto:   não foi possível ler/processar a imagem
 */
export type ResultadoFacial = "aceita" | "recusada" | "sem_conexao" | "erro_foto"

export async function enviarFaceDependente(
  dependente: { cpf: string; nome_completo: string },
  photoKey: string,
): Promise<ResultadoFacial> {
  // Cartão de acesso: best effort, não decide o resultado
  await upsertCard(dependente.cpf, dependente.nome_completo).catch((err) =>
    console.warn("[facial] cartão não enviado:", (err as Error).message),
  )

  let face: Awaited<ReturnType<typeof syncFace>>
  try {
    face = await syncFace(dependente.cpf, dependente.nome_completo, await getObject(photoKey))
  } catch (err) {
    const msg = (err as Error).message
    console.warn("[facial] foto não enviada:", msg)
    return msg.includes("não configurada") ? "sem_conexao" : "erro_foto"
  }

  if (face.ok) return "aceita"
  if (face.results.every((r) => "error" in r)) {
    console.warn("[facial] catracas inacessíveis:", JSON.stringify(face.results))
    return "sem_conexao"
  }
  console.warn("[facial] facial recusou a foto:", JSON.stringify(face.results))
  return "recusada"
}

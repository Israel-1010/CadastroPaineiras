import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import sharp from "sharp"
import { getColaboradorId, unauthorized } from "@/lib/auth"
import { photoPrefixFor, publicUrlForKey, putObject } from "@/lib/s3"

export const runtime = "nodejs"

const MAX_BYTES = 5 * 1024 * 1024

// Recebe a imagem crua no corpo. A chave no S3 é gerada aqui, nunca pelo cliente.
export async function POST(request: Request) {
  try {
    const colaboradorId = await getColaboradorId()
    if (!colaboradorId) return unauthorized()

    const declared = Number(request.headers.get("content-length") || 0)
    if (declared > MAX_BYTES) {
      return NextResponse.json({ error: "A imagem deve ter no máximo 5MB" }, { status: 413 })
    }
    const input = Buffer.from(await request.arrayBuffer())
    if (input.length === 0) return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 })
    if (input.length > MAX_BYTES) {
      return NextResponse.json({ error: "A imagem deve ter no máximo 5MB" }, { status: 413 })
    }

    // Re-encoda como JPEG: valida que é imagem, corrige a orientação e remove metadados (EXIF/GPS)
    let jpeg: Buffer
    try {
      jpeg = await sharp(input, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
    } catch {
      return NextResponse.json({ error: "Arquivo não é uma imagem válida" }, { status: 400 })
    }

    const key = `${photoPrefixFor(colaboradorId)}${randomUUID()}.jpg`
    await putObject(key, jpeg, "image/jpeg")

    return NextResponse.json({ url: publicUrlForKey(key) })
  } catch (error) {
    console.error("[upload] erro:", (error as Error).message)
    return NextResponse.json({ error: "Falha no upload" }, { status: 500 })
  }
}

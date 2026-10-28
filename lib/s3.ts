import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

export const PHOTO_PREFIX = "dependentes/"

let client: S3Client | null = null

function s3() {
  client ??= new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
  return client
}

function publicBase() {
  return (
    process.env.S3_PUBLIC_BASE_URL || `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`
  ).replace(/\/+$/, "")
}

export function publicUrlForKey(key: string) {
  return `${publicBase()}/${encodeURIComponent(key).replace(/%2F/g, "/")}`
}

/** Extrai a chave S3 de uma URL pública nossa; null se a URL não for do nosso bucket/prefixo de fotos */
export function photoKeyFromUrl(url: string | null | undefined) {
  if (!url) return null
  const base = publicBase() + "/"
  if (!url.startsWith(base)) return null
  const key = decodeURIComponent(url.slice(base.length).split(/[?#]/)[0])
  if (!key.startsWith(PHOTO_PREFIX) || key.includes("..")) return null
  return key
}

/** Prefixo das fotos enviadas por um colaborador */
export const photoPrefixFor = (colaboradorId: string) => `${PHOTO_PREFIX}${colaboradorId}/`

/** A URL é de uma foto enviada por este colaborador? */
export function isOwnPhotoUrl(url: string, colaboradorId: string) {
  return photoKeyFromUrl(url)?.startsWith(photoPrefixFor(colaboradorId)) ?? false
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
      // sem ACL (Bucket Owner Enforced)
    }),
  )
}

export async function getObject(key: string) {
  const out = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }))
  const chunks: Buffer[] = []
  for await (const chunk of out.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

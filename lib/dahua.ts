// Integração com os terminais de reconhecimento facial Dahua.
// IPs e credenciais vêm SOMENTE do ambiente: nunca aceitar do cliente.
import crypto from "crypto"
import sharp from "sharp"

const MAX_BYTES = 200 * 1024
const MAX_SIZE = 512
const REMOVE_ADD_DELAY_MS = 250
const TIMEOUT_MS = 8000

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex")

function config() {
  const user = process.env.DAHUA_USER
  const pass = process.env.DAHUA_PASS
  const ips = (process.env.DAHUA_IPS || process.env.DAHUA_DEFAULT_IP || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (!user || !pass || ips.length === 0) {
    throw new Error("Integração Dahua não configurada (DAHUA_USER, DAHUA_PASS, DAHUA_IPS)")
  }
  return { user, pass, ips }
}

type DigestChallenge = { realm: string; nonce: string; qop?: string; opaque?: string; algorithm?: string; stale?: string }

function parseWwwAuthenticateDigest(header?: string | null): DigestChallenge | null {
  if (!header) return null
  const m = header.match(/^Digest\s+(.*)$/i)
  if (!m) return null
  const re = /([a-zA-Z]+)="?([^",]+)"?/g
  const out: Record<string, string> = {}
  let k
  while ((k = re.exec(m[1])) !== null) out[k[1].toLowerCase()] = k[2]
  return { realm: out.realm, nonce: out.nonce, qop: out.qop, opaque: out.opaque, algorithm: out.algorithm, stale: out.stale }
}

function buildDigestHeader(opts: {
  method: "POST" | "GET"
  uri: string
  user: string
  pass: string
  challenge: DigestChallenge
  body?: string
}) {
  const { method, uri, user, pass, challenge, body = "" } = opts
  const realm = challenge.realm,
    nonce = challenge.nonce
  const qopTokens = (challenge.qop || "auth").split(",").map((s) => s.trim().toLowerCase())
  const qop = qopTokens.includes("auth") ? "auth" : qopTokens[0] || "auth"
  const algo = (challenge.algorithm || "MD5").toUpperCase() as "MD5" | "MD5-SESS"
  const nc = "00000001",
    cnonce = crypto.randomBytes(8).toString("hex")
  let HA1 = md5(`${user}:${realm}:${pass}`)
  if (algo === "MD5-SESS") HA1 = md5(`${HA1}:${nonce}:${cnonce}`)
  const HA2 = qop === "auth-int" ? md5(`${method}:${uri}:${md5(body)}`) : md5(`${method}:${uri}`)
  const response = md5(`${HA1}:${nonce}:${nc}:${cnonce}:${qop}:${HA2}`)
  const parts = [
    `username="${user}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
    `qop=${qop}`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`,
    `algorithm=${algo === "MD5-SESS" ? "MD5-sess" : "MD5"}`,
  ]
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`)
  return `Digest ${parts.join(", ")}`
}

async function dahuaFetch({
  url,
  method,
  headers = {},
  body,
  user,
  pass,
}: {
  url: string
  method: "GET" | "POST"
  headers?: Record<string, string>
  body?: string
  user: string
  pass: string
}) {
  const send = (extra: Record<string, string> = {}) =>
    fetch(url, {
      method,
      headers: { ...headers, ...extra },
      body: method === "POST" ? body : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  const challengeOf = (r: Response) => parseWwwAuthenticateDigest(r.headers.get("www-authenticate"))

  let probe = await send()
  if (probe.ok) return { r: probe, auth: "none" as const }
  let chal = challengeOf(probe)
  if (!chal) {
    const basic = Buffer.from(`${user}:${pass}`).toString("base64")
    const rb = await send({ Authorization: `Basic ${basic}` })
    if (rb.ok) return { r: rb, auth: "basic" as const }
    chal = challengeOf(rb)
    probe = rb
  }
  if (!chal) return { r: probe, auth: "none" as const }

  const u = new URL(url)
  const withQuery = u.pathname + (u.search || "")
  let r = await send({ Authorization: buildDigestHeader({ method, uri: withQuery, user, pass, challenge: chal, body }) })
  if (r.status === 401) {
    const chal2 = challengeOf(r)
    if (chal2?.stale === "true") {
      r = await send({ Authorization: buildDigestHeader({ method, uri: withQuery, user, pass, challenge: chal2, body }) })
      if (r.ok) return { r, auth: "digest-stale-retry" as const }
    }
  }
  if (r.status === 401) {
    const chal3 = challengeOf(r) || chal
    r = await send({ Authorization: buildDigestHeader({ method, uri: u.pathname, user, pass, challenge: chal3, body }) })
    return { r, auth: "digest-uri-pathonly" as const }
  }
  return { r, auth: "digest" as const }
}

export async function compressToUnder200KB(input: Buffer): Promise<Buffer> {
  let size = MAX_SIZE,
    quality = 85
  const encode = () =>
    sharp(input)
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: false, progressive: false, chromaSubsampling: "4:2:0" })
      .toBuffer()
  let out = await encode()
  while (out.length > MAX_BYTES && (quality > 40 || size > 320)) {
    if (quality > 40) quality -= 10
    else size -= 64
    out = await encode()
  }
  if (out.length > MAX_BYTES) throw new Error(`Imagem > 200KB mesmo após compressão (${out.length})`)
  return out
}

async function removeOnIp(ip: string, cpf: string, user: string, pass: string) {
  const url = `http://${ip}/cgi-bin/FaceInfoManager.cgi?action=remove&UserID=${encodeURIComponent(cpf)}`
  const rem = await dahuaFetch({ url, method: "GET", user, pass })
  const text = await rem.r.text().catch(() => "")
  return { status: rem.r.status, auth: rem.auth, body: text.slice(0, 300) }
}

async function removeAndAddOnIp(ip: string, cpf: string, userName: string, jpgB64: string, user: string, pass: string) {
  const remove = await removeOnIp(ip, cpf, user, pass)
  await new Promise((r) => setTimeout(r, REMOVE_ADD_DELAY_MS))

  // add (PhotoData), fallback FaceData
  const addUrl = `http://${ip}/cgi-bin/FaceInfoManager.cgi?action=add`
  const post = (field: "PhotoData" | "FaceData") =>
    dahuaFetch({
      url: addUrl,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ UserID: cpf, Info: { UserName: userName, [field]: [jpgB64] } }),
      user,
      pass,
    })
  let variant: "PhotoData" | "FaceData" = "PhotoData"
  let add = await post(variant)
  let addText = await add.r.text().catch(() => "")
  if (!add.r.ok) {
    variant = "FaceData"
    add = await post(variant)
    addText = await add.r.text().catch(() => "")
  }
  return {
    ip,
    remove,
    add: { status: add.r.status, auth: add.auth, body: addText.slice(0, 600), variant },
    ok: add.r.ok,
  }
}

/** Cadastra/atualiza a face em todos os terminais. Retorna resultado por IP. */
export async function syncFace(cpf: string, nomeCompleto: string, photo: Buffer) {
  const { user, pass, ips } = config()
  const userName = nomeCompleto.replace(/\+/g, " ").trim().slice(0, 32)
  const b64 = (await compressToUnder200KB(photo)).toString("base64")
  const results = await Promise.allSettled(ips.map((ip) => removeAndAddOnIp(ip, cpf, userName, b64, user, pass)))
  const perIp = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { ip: ips[i], ok: false, error: (r.reason as Error)?.message || "erro" },
  )
  return { ok: perIp.some((r) => r.ok), results: perIp }
}

// ===== Cartão de acesso (recordUpdater AccessControlCard) =====

/** Data no formato do Dahua: "YYYYMMDD%20HHMMSS" (horário local do servidor) */
function dahuaDateParam(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}%20${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function buildCardQuery(p: { nome: string; cpf: string; password: string | null; start: string; end: string; cardType: number }) {
  const q = [
    "name=AccessControlCard",
    `CardName=${encodeURIComponent(p.nome)}`,
    `CardNo=${encodeURIComponent(p.cpf)}`,
    `UserID=${encodeURIComponent(p.cpf)}`,
    "CardStatus=0",
    `CardType=${p.cardType}`,
  ]
  if (p.password) q.push(`Password=${encodeURIComponent(p.password)}`)
  q.push(`VTOPosition=${process.env.DAHUA_VTO_POSITION || "01018001"}`, `ValidDateStart=${p.start}`, `ValidDateEnd=${p.end}`)
  return q.join("&")
}

const isExistsMessage = (txt: string) => /exist|duplicate/i.test(txt || "")

async function upsertCardOnIp(ip: string, cpf: string, nome: string, user: string, pass: string) {
  const base = `http://${ip}/cgi-bin/recordUpdater.cgi`
  const now = new Date()
  const end = new Date(now)
  end.setFullYear(now.getFullYear() + 10)
  const dates = { start: dahuaDateParam(now), end: dahuaDateParam(end) }
  const cardPassword = process.env.DAHUA_CARD_PASSWORD || "123456"

  const get = async (url: string) => {
    const r = await dahuaFetch({ url, method: "GET", user, pass })
    const body = await r.r.text().catch(() => "")
    return { status: r.r.status, body }
  }
  const update = async (query: string) => {
    const rU = await get(`${base}?action=update&${query}&Where=UserID%3D${encodeURIComponent(cpf)}`)
    return { ip, ok: rU.status === 200, mode: rU.status === 200 ? "update" : "update-failed", status: rU.status }
  }

  // Tentativas na mesma ordem da versão anterior: com senha, sem senha, CardType=1
  const variants = [
    { mode: "insert-A", query: buildCardQuery({ nome, cpf, password: cardPassword, cardType: 0, ...dates }) },
    { mode: "insert-B", query: buildCardQuery({ nome, cpf, password: null, cardType: 0, ...dates }) },
    { mode: "insert-C", query: buildCardQuery({ nome, cpf, password: cardPassword, cardType: 1, ...dates }) },
  ]
  let last = { status: 0 }
  for (const [i, v] of variants.entries()) {
    const r = await get(`${base}?action=insert&${v.query}`)
    if (r.status === 200) return { ip, ok: true, mode: v.mode, status: r.status }
    if (i < 2 && isExistsMessage(r.body)) return update(v.query)
    last = r
  }
  return { ip, ok: false, mode: "skipped-card-error", status: last.status }
}

/** Cadastra/atualiza o cartão de acesso (CardNo = UserID = CPF) em todos os terminais */
export async function upsertCard(cpf: string, nomeCompleto: string) {
  const { user, pass, ips } = config()
  const nome = nomeCompleto.replace(/\+/g, " ").trim()
  const results = await Promise.allSettled(ips.map((ip) => upsertCardOnIp(ip, cpf, nome, user, pass)))
  const perIp = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { ip: ips[i], ok: false, error: (r.reason as Error)?.message || "erro" },
  )
  return { ok: perIp.some((r) => r.ok), results: perIp }
}

/** Remove a face de todos os terminais (best effort; nunca lança) */
export async function removeFace(cpf: string) {
  try {
    const { user, pass, ips } = config()
    const results = await Promise.allSettled(ips.map((ip) => removeOnIp(ip, cpf, user, pass)))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) console.warn(`[dahua] remoção da face falhou em ${failed}/${ips.length} terminais`)
  } catch (err) {
    console.warn("[dahua] remoção da face não executada:", (err as Error).message)
  }
}

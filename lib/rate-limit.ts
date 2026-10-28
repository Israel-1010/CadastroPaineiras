// Limitador em memória (janela fixa). Vale por instância do servidor:
// em ambiente com várias instâncias/serverless, trocar por Redis/Upstash.

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSeconds: 0 }
  }
  bucket.count++
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfterSeconds: 0 }
}

export function resetRateLimit(key: string) {
  buckets.delete(key)
}

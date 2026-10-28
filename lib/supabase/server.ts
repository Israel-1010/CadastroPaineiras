import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

function getClient() {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return client
}

// Cliente com service role: usar SOMENTE no servidor (rotas de API).
// Ignora RLS, então toda rota deve checar sessão/propriedade antes de usar.
// Criado no primeiro uso, para o `next build` (ex.: no Docker) não exigir as variáveis de ambiente.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getClient()
    const value = Reflect.get(real, prop, real)
    return typeof value === "function" ? value.bind(real) : value
  },
})

const PAGE_SIZE = 1000

/**
 * Busca todas as linhas de uma consulta paginando de 1000 em 1000
 * (o PostgREST limita cada resposta a 1000 linhas por padrão).
 */
export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

export const isUniqueViolation = (error: { code?: string } | null) => error?.code === "23505"

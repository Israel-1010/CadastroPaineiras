import { createClient } from "@supabase/supabase-js"

// Cliente com service role: usar SOMENTE no servidor (rotas de API).
// Ignora RLS, então toda rota deve checar sessão/propriedade antes de usar.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

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

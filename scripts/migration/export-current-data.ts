import { createClient } from "@supabase/supabase-js"

// Usando as credenciais atuais para exportar dados
const currentSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function exportAllData() {
  console.log("[v0] Iniciando exportação de dados...")

  try {
    // Exportar administradores
    const { data: admins, error: adminsError } = await currentSupabase.from("administradores").select("*")

    if (adminsError) throw adminsError
    console.log(`[v0] Exportados ${admins?.length || 0} administradores`)

    // Exportar colaboradores
    const { data: colaboradores, error: colaboradoresError } = await currentSupabase.from("colaboradores").select("*")

    if (colaboradoresError) throw colaboradoresError
    console.log(`[v0] Exportados ${colaboradores?.length || 0} colaboradores`)

    // Exportar dependentes
    const { data: dependentes, error: dependentesError } = await currentSupabase.from("dependentes").select("*")

    if (dependentesError) throw dependentesError
    console.log(`[v0] Exportados ${dependentes?.length || 0} dependentes`)

    const exportData = {
      administradores: admins || [],
      colaboradores: colaboradores || [],
      dependentes: dependentes || [],
    }

    console.log("[v0] Exportação concluída com sucesso!")
    return exportData
  } catch (error) {
    console.error("[v0] Erro na exportação:", error)
    throw error
  }
}

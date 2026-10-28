import { createClient } from "@supabase/supabase-js"

// SUBSTITUA ESTAS VARIÁVEIS PELAS NOVAS CREDENCIAIS
const NEW_SUPABASE_URL = "SUA_NOVA_URL_AQUI"
const NEW_SUPABASE_SERVICE_KEY = "SUA_NOVA_SERVICE_KEY_AQUI"

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_KEY)

export async function importAllData(exportedData: any) {
  console.log("[v0] Iniciando importação para nova conta...")

  try {
    // Importar administradores
    if (exportedData.administradores.length > 0) {
      const { error: adminsError } = await newSupabase.from("administradores").insert(exportedData.administradores)

      if (adminsError) throw adminsError
      console.log(`[v0] Importados ${exportedData.administradores.length} administradores`)
    }

    // Importar colaboradores
    if (exportedData.colaboradores.length > 0) {
      const { error: colaboradoresError } = await newSupabase.from("colaboradores").insert(exportedData.colaboradores)

      if (colaboradoresError) throw colaboradoresError
      console.log(`[v0] Importados ${exportedData.colaboradores.length} colaboradores`)
    }

    // Importar dependentes
    if (exportedData.dependentes.length > 0) {
      const { error: dependentesError } = await newSupabase.from("dependentes").insert(exportedData.dependentes)

      if (dependentesError) throw dependentesError
      console.log(`[v0] Importados ${exportedData.dependentes.length} dependentes`)
    }

    console.log("[v0] Importação concluída com sucesso!")
  } catch (error) {
    console.error("[v0] Erro na importação:", error)
    throw error
  }
}

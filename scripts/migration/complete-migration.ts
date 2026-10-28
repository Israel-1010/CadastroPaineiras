import { exportAllData } from "./export-current-data"
import { importAllData } from "./import-to-new-account"

async function completeMigration() {
  try {
    console.log("[v0] === INICIANDO MIGRAÇÃO COMPLETA ===")

    // 1. Exportar dados da conta atual
    console.log("[v0] Passo 1: Exportando dados da conta atual...")
    const exportedData = await exportAllData()

    // 2. Importar dados para nova conta
    console.log("[v0] Passo 2: Importando dados para nova conta...")
    await importAllData(exportedData)

    console.log("[v0] === MIGRAÇÃO CONCLUÍDA COM SUCESSO ===")
    console.log("[v0] Resumo:")
    console.log(`[v0] - Administradores: ${exportedData.administradores.length}`)
    console.log(`[v0] - Colaboradores: ${exportedData.colaboradores.length}`)
    console.log(`[v0] - Dependentes: ${exportedData.dependentes.length}`)
  } catch (error) {
    console.error("[v0] ERRO NA MIGRAÇÃO:", error)
  }
}

// Executar migração
completeMigration()

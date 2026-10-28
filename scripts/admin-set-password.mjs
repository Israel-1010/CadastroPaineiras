// Define (ou redefine) a senha de um administrador, gravando o hash bcrypt no banco.
//
// Uso:
//   node scripts/admin-set-password.mjs <usuario> <nova-senha> [arquivo-env]
//
// Ex.: node scripts/admin-set-password.mjs admin "MinhaSenhaForte#2026"
//      node scripts/admin-set-password.mjs admin "MinhaSenhaForte#2026" .env.production
//
// Se o usuário não existir, ele é criado (ativo) com nome/email provisórios.
import { existsSync } from "node:fs"
import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"

const [username, password, envFile = ".env.local"] = process.argv.slice(2)

if (!username || !password) {
  console.error("Uso: node scripts/admin-set-password.mjs <usuario> <nova-senha> [arquivo-env]")
  process.exit(1)
}
if (password.length < 10) {
  console.error("A senha deve ter pelo menos 10 caracteres.")
  process.exit(1)
}

if (existsSync(envFile)) process.loadEnvFile(envFile)

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error(`SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não encontrados (arquivo: ${envFile}).`)
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const password_hash = await bcrypt.hash(password, 12)

const { data: existente, error: findError } = await supabase
  .from("administradores")
  .select("id")
  .eq("username", username)
  .maybeSingle()
if (findError) {
  console.error("Erro ao buscar administrador:", findError.message)
  process.exit(1)
}

const { error } = existente
  ? await supabase
      .from("administradores")
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq("id", existente.id)
  : await supabase.from("administradores").insert({
      username,
      password_hash,
      nome_completo: username,
      email: `${username}@definir.local`,
      ativo: true,
    })

if (error) {
  console.error("Erro ao salvar senha:", error.message)
  process.exit(1)
}

console.log(existente ? `Senha de "${username}" atualizada.` : `Administrador "${username}" criado.`)

"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { isValidCPF, maskCPFInput } from "@/lib/cpf"

export default function LoginPage() {
  const [re, setRe] = useState("")
  const [cpf, setCpf] = useState("")
  const [cpfError, setCpfError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const reRef = useRef<HTMLInputElement>(null)
  const cpfRef = useRef<HTMLInputElement>(null)

  const isCPFFormat = (s: string) => /^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$/.test(s)

  const focusIntoView = (el: HTMLInputElement | null) => {
    if (el && typeof el.scrollIntoView === "function") {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 80)
    }
  }

  const handleReChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRe(e.target.value.replace(/\D/g, ""))
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCPFInput(e.target.value)
    setCpf(masked)
    if (isCPFFormat(masked)) {
      setCpfError(isValidCPF(masked) ? null : "CPF inválido")
    } else {
      setCpfError(masked.replace(/\D/g, "").length >= 11 ? "Formato inválido. Use 000.000.000-00" : null)
    }
  }

  const handleCPFBlur = () => {
    if (!cpf) return setCpfError("Informe o CPF")
    if (!isCPFFormat(cpf)) return setCpfError("Formato inválido. Use 000.000.000-00")
    setCpfError(isValidCPF(cpf) ? null : "CPF inválido")
  }

  const canSubmit = re.length > 0 && isCPFFormat(cpf) && isValidCPF(cpf) && !isLoading

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      if (!isCPFFormat(cpf) || !isValidCPF(cpf)) {
        setCpfError(!isCPFFormat(cpf) ? "Formato inválido. Use 000.000.000-00" : "CPF inválido")
        setIsLoading(false)
        return
      }
      const cleanCPF = cpf.replace(/\D/g, "")
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ re, cpf: cleanCPF }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao fazer login")
      // A sessão fica num cookie httpOnly definido pelo servidor
      router.push("/dashboard")
    } catch (err: any) {
      setError(err?.message || "Erro ao fazer login. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[100svh] flex items-center justify-center bg-gradient-to-br from-pink-50 to-pink-100 p-4 overflow-auto">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg border border-gray-100">
        {/* Logo (usar <img> para evitar erro do next/image com domínio externo) */}
        <div className="text-center mb-6">
          <img
            src="https://clubepaineiras.org.br/wp-content/uploads/2016/06/IMG_0025-450x450.jpg"
            alt="Clube Paineiras"
            width={90}
            height={90}
            className="mx-auto rounded-full shadow-md mb-3"
          />
          <h1 className="text-2xl font-bold text-gray-900">Atualização Cadastral</h1>
          <p className="text-sm text-gray-600">Entre com seu RE e CPF para acessar o sistema</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="re" className="block text-sm font-medium text-gray-700 mb-1">
              Registro de Empregado (RE)
            </label>
            <input
              ref={reRef}
              id="re"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              placeholder="Digite seu RE"
              value={re}
              onFocus={() => focusIntoView(reRef.current)}
              onChange={handleReChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              required
            />
          </div>

          <div>
            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
              CPF
            </label>
            <input
              ref={cpfRef}
              id="cpf"
              type="tel"
              inputMode="numeric"
              // usar [0-9] em vez de \d
              pattern="[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}"
              placeholder="000.000.000-00"
              value={cpf}
              onFocus={() => focusIntoView(cpfRef.current)}
              onChange={handleCPFChange}
              onBlur={handleCPFBlur}
              maxLength={14}
              aria-invalid={Boolean(cpfError)}
              aria-describedby="cpf-help"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                cpfError ? "border-red-400 focus:ring-red-500" : "border-gray-300 focus:ring-pink-500"
              }`}
              required
            />
            <p id="cpf-help" className={`mt-1 text-xs ${cpfError ? "text-red-600" : "text-transparent"}`}>
              {cpfError || "placeholder"}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-2 px-4 rounded-md transition-colors font-medium text-white ${
              canSubmit ? "bg-pink-600 hover:bg-pink-700" : "bg-pink-300"
            }`}
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  )
}

import { NovoColaboradorForm } from "@/components/novo-colaborador-form"

export default function NovoColaboradorPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Cadastrar Novo Colaborador</h1>
          <p className="text-slate-600">Preencha os dados do colaborador para adicionar ao sistema</p>
        </div>

        <NovoColaboradorForm />
      </div>
    </div>
  )
}

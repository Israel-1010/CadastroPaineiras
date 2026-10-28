import { ColaboradoresListAdmin } from "@/components/colaboradores-list-admin"

export default function ColaboradoresAdminPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gerenciar Colaboradores</h1>
          <p className="text-slate-600">Visualize e gerencie todos os colaboradores do sistema</p>
        </div>

        <ColaboradoresListAdmin />
      </div>
    </div>
  )
}

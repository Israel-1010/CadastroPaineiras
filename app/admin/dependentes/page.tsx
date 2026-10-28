import { DependentesAdminList } from "@/components/dependentes-admin-list"

export default function DependentesAdminPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gerenciar Dependentes</h1>
          <p className="text-slate-600">Visualize e gerencie todos os dependentes do sistema</p>
        </div>

        <DependentesAdminList />
      </div>
    </div>
  )
}

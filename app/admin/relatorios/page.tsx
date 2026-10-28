import { RelatoriosAdmin } from "@/components/relatorios-admin"

export default function RelatoriosAdminPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Relatórios e Estatísticas</h1>
          <p className="text-slate-600">Visualize dados e métricas do sistema</p>
        </div>

        <RelatoriosAdmin />
      </div>
    </div>
  )
}

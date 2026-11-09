import { DashboardAcessos } from "@/components/dashboard-acessos"

export default function AcessosPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard de Acessos</h1>
          <p className="text-slate-600">Quem passou pelas catracas, quando e por qual catraca</p>
        </div>

        <DashboardAcessos />
      </div>
    </div>
  )
}

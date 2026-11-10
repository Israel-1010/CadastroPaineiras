import { HistoricoEnvios } from "@/components/historico-envios"

export default function HistoricoFotosPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Histórico de Fotos</h1>
          <p className="text-slate-600">
            Cada envio, troca, carga e remoção de foto nas catracas: quem enviou, quando, de onde e se a catraca aceitou
          </p>
        </div>

        <HistoricoEnvios />
      </div>
    </div>
  )
}

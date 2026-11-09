import { CargaFacial } from "@/components/carga-facial"
import { RemoverCatracas } from "@/components/remover-catracas"

export default function CargaFacialPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Carga no Facial</h1>
          <p className="text-slate-600">Envie às catracas as fotos dos dependentes</p>
        </div>

        <CargaFacial />
        <div className="mt-6">
          <RemoverCatracas />
        </div>
      </div>
    </div>
  )
}

import Link from "next/link"
import { History } from "lucide-react"
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
        {/* O histórico completo (com as fotos) fica em página própria */}
        <Link
          href="/admin/envios"
          className="mt-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-slate-700 hover:shadow-md transition-shadow"
        >
          <History className="w-5 h-5 text-violet-600" />
          <span>
            <span className="font-medium text-slate-900">Histórico de Fotos</span> · quem enviou, quando e se a catraca aceitou, com as fotos
          </span>
        </Link>
      </div>
    </div>
  )
}

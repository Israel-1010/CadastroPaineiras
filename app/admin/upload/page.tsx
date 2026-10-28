import { ExcelUploadForm } from "@/components/excel-upload-form"

export default function UploadExcelPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Upload de Arquivo Excel</h1>
          <p className="text-slate-600">Importe colaboradores em massa através de arquivo Excel</p>
        </div>

        <ExcelUploadForm />
      </div>
    </div>
  )
}

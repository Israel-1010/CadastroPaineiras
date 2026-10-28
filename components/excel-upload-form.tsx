"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Upload, FileSpreadsheet, Download, ArrowLeft, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react"
import { downloadCsv, isPlanilhaFile } from "@/lib/download"
import type { ImportResult as UploadResult } from "@/lib/types"

export function ExcelUploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!isPlanilhaFile(selectedFile.name)) {
        setError("Por favor, selecione um arquivo Excel (.xlsx) ou CSV (.csv)")
        return
      }

      setFile(selectedFile)
      setError(null)
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      // Simular progresso
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch("/api/admin/upload-excel", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar arquivo")
      }

      setResult(data.result)
    } catch (error: any) {
      setError(error.message || "Erro ao processar arquivo")
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadProgress(0), 2000)
    }
  }

  const downloadTemplate = () => {
    // CPFs de exemplo são válidos (dígitos verificadores corretos), mas fictícios
    downloadCsv("template_colaboradores.csv", [
      ["RE", "CPF", "Nome Completo", "Email"],
      ["12345", "52998224725", "João da Silva", "joao@empresa.com"],
      ["67890", "11144477735", "Maria Santos", "maria@empresa.com"],
    ])
  }

  const resetForm = () => {
    setFile(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.push("/admin/dashboard")}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Dashboard</span>
        </Button>
      </div>

      {/* Instruções */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-900">
            <Info className="w-5 h-5" />
            <span>Instruções para Upload</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800">
          <ul className="space-y-2 text-sm">
            <li>• O arquivo deve estar no formato Excel (.xlsx) ou CSV (.csv, separado por ";" ou ",")</li>
            <li>• As colunas devem estar na ordem: RE, CPF, Nome Completo, Email</li>
            <li>• A primeira linha deve conter os cabeçalhos</li>
            <li>• CPF com ou sem pontuação (000.000.000-00 ou 00000000000)</li>
            <li>• Todos os campos são obrigatórios</li>
          </ul>
          <div className="mt-4">
            <Button variant="outline" onClick={downloadTemplate} className="bg-white text-blue-700 border-blue-300">
              <Download className="w-4 h-4 mr-2" />
              Baixar Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload Form */}
      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <span>Upload de Arquivo</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* File Input */}
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
              <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-slate-900">Selecione o arquivo Excel</p>
                <p className="text-sm text-slate-600">Arraste e solte ou clique para selecionar</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4"
                disabled={isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Selecionar Arquivo
              </Button>
            </div>

            {file && (
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-slate-900">{file.name}</p>
                    <p className="text-sm text-slate-600">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={resetForm} disabled={isUploading}>
                  Remover
                </Button>
              </div>
            )}
          </div>

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Processando arquivo...</span>
                <span className="text-sm text-slate-600">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          <div className="flex space-x-4">
            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "Processando..." : "Processar Arquivo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Resultado do Processamento</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-900">{result.success}</p>
                  <p className="text-sm text-green-700">Colaboradores Importados</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-900">{result.errors.length}</p>
                  <p className="text-sm text-red-700">Erros Encontrados</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-yellow-50 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-yellow-900">{result.duplicates.length}</p>
                  <p className="text-sm text-yellow-700">Duplicatas Ignoradas</p>
                </div>
              </div>
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-slate-900">Erros Encontrados:</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.errors.map((error, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-900">Linha {error.row}</p>
                        <p className="text-sm text-red-700">{error.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicates */}
            {result.duplicates.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-slate-900">Duplicatas Ignoradas:</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.duplicates.map((duplicate, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-900">Linha {duplicate.row}</p>
                        <p className="text-sm text-yellow-700">
                          {duplicate.field} já existe: {duplicate.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              <Button onClick={resetForm} variant="outline">
                Processar Novo Arquivo
              </Button>
              <Button onClick={() => router.push("/admin/colaboradores")} className="bg-blue-600 hover:bg-blue-700">
                Ver Colaboradores
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

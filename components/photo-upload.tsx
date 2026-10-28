"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, X, Loader2, Upload, Video, RotateCcw, ImageIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface PhotoUploadProps {
  currentPhotoUrl?: string
  onPhotoChange: (photoUrl: string) => void
  userName: string
  onUploadingChange?: (uploading: boolean) => void
  /** "buttons": só os botões Câmera/Galeria (cartão do dependente sem foto) */
  variant?: "full" | "buttons"
}

export function PhotoUpload({
  currentPhotoUrl,
  onPhotoChange,
  userName,
  onUploadingChange,
  variant = "full",
}: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null)
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  const setUploading = (v: boolean) => {
    setIsUploading(v)
    onUploadingChange?.(v)
  }

  // O <video> só existe depois que o modal abre: liga o stream quando ambos estiverem prontos
  useEffect(() => {
    if (showCameraModal && !capturedPhoto && videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [showCameraModal, capturedPhoto, stream])

  // Desliga a câmera se o componente for desmontado com ela aberta
  const streamRef = useRef<MediaStream | null>(null)
  streamRef.current = stream
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  /** Envia a imagem crua; o servidor gera o nome do arquivo e devolve a URL */
  const uploadImage = async (body: Blob) => {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": body.type || "application/octet-stream" },
      body,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || "Erro ao fazer upload da foto. Tente novamente.")
    return data.url as string
  }

  const startCamera = async () => {
    try {
      setError(null)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: isMobile ? 720 : 640 },
          height: { ideal: isMobile ? 1280 : 480 },
          facingMode,
          aspectRatio: isMobile ? { ideal: 0.75 } : { ideal: 1.33 },
        } as MediaTrackConstraints,
        audio: false,
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
      setShowCameraModal(true)
    } catch (error) {
      console.error("Erro ao acessar câmera:", error)
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.")
    }
  }

  const switchCamera = async () => {
    if (stream) stream.getTracks().forEach((t) => t.stop())
    const newFacingMode = facingMode === "user" ? "environment" : "user"
    setFacingMode(newFacingMode)
    try {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: isMobile ? 720 : 640 },
          height: { ideal: isMobile ? 1280 : 480 },
          facingMode: newFacingMode,
          aspectRatio: isMobile ? { ideal: 0.75 } : { ideal: 1.33 },
        } as MediaTrackConstraints,
        audio: false,
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
    } catch (error) {
      console.error("Erro ao alternar câmera:", error)
      setError("Não foi possível alternar a câmera.")
      setFacingMode(facingMode)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
    setShowCameraModal(false)
    setCapturedPhoto(null)
    setFacingMode("user")
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (ctx) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(video, 0, 0)
        const photoDataUrl = canvas.toDataURL("image/jpeg", 0.9)
        setCapturedPhoto(photoDataUrl)
      }
    }
  }

  const useCapturedPhoto = async () => {
    if (!capturedPhoto) return
    setUploading(true)
    try {
      const blob = await (await fetch(capturedPhoto)).blob()
      const url = await uploadImage(blob)
      setPreviewUrl(url)
      onPhotoChange(url)
      stopCamera()
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // permite escolher o mesmo arquivo de novo (ex.: após a catraca recusar)
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Por favor, selecione apenas arquivos de imagem")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5MB")
      return
    }
    setError(null)
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = (ev) => setPreviewUrl(String(ev.target?.result || ""))
      reader.readAsDataURL(file)

      const url = await uploadImage(file)
      setPreviewUrl(url)
      onPhotoChange(url)
    } catch (error) {
      setError((error as Error).message)
      setPreviewUrl(currentPhotoUrl || null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = () => {
    setPreviewUrl(null)
    onPhotoChange("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const triggerFileInput = () => fileInputRef.current?.click()

  return (
    <div className="space-y-4">
      {variant === "buttons" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={startCamera} disabled={isUploading}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            <span>Câmera</span>
          </Button>
          <Button type="button" variant="outline" onClick={triggerFileInput} disabled={isUploading}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            <span>Galeria</span>
          </Button>
        </div>
      ) : (
      <div className="flex items-center space-x-4">
        {/* Avatar clicável → abre câmera */}
        <div
          className="relative group cursor-pointer"
          onClick={startCamera}
          title="Clique para tirar uma foto"
        >
          <Avatar className="w-20 h-20">
            <AvatarImage src={previewUrl || "/placeholder.svg"} alt={userName} />
            <AvatarFallback className="bg-blue-100 text-blue-600 text-lg">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>

          {/* dica ao passar o mouse */}
          <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/35 rounded-full">
            <Camera className="w-6 h-6 text-white" />
          </div>

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={triggerFileInput} disabled={isUploading} className="bg-transparent">
              <Upload className="w-4 h-4" />
              <span>Arquivo</span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={startCamera} disabled={isUploading} className="bg-transparent">
              <Camera className="w-4 h-4" />
              <span>Câmera</span>
            </Button>
            {previewUrl && (
              <Button type="button" variant="outline" size="sm" onClick={handleRemovePhoto} disabled={isUploading} className="text-red-600 hover:text-red-700 bg-transparent">
                <X className="w-4 h-4" />
                <span>Remover</span>
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500">Formatos: JPG/PNG. Máx 5MB.</p>
        </div>
      </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* Modal da câmera */}
      <Dialog open={showCameraModal} onOpenChange={stopCamera}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Video className="w-5 h-5 text-blue-600" />
                <span>Tirar Foto</span>
              </div>
              <Button variant="ghost" size="sm" onClick={switchCamera} className="flex items-center space-x-1">
                <RotateCcw className="w-4 h-4" />
                <span className="text-xs">{facingMode === "user" ? "Traseira" : "Frontal"}</span>
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!capturedPhoto ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto rounded-lg bg-gray-100"
                  style={{ maxHeight: "400px" }}
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 transform">
                  <Button onClick={capturePhoto} className="bg-blue-600 hover:bg-blue-700 rounded-full w-16 h-16">
                    <Camera className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <img
                  src={capturedPhoto || "/placeholder.svg"}
                  alt="Foto capturada"
                  className="w-full h-auto rounded-lg"
                  style={{ maxHeight: "400px" }}
                />
                <div className="flex space-x-2 justify-center">
                  <Button variant="outline" onClick={() => setCapturedPhoto(null)}>
                    Tirar Novamente
                  </Button>
                  <Button onClick={useCapturedPhoto} disabled={isUploading} className="bg-green-600 hover:bg-green-700">
                    {isUploading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>) : ("Usar Esta Foto")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={stopCamera}>Cancelar</Button>
          </DialogFooter>

          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

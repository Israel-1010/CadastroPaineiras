// PD-04 (servidor): o colaborador só tira e envia fotos depois de aceitar a versão atual do termo.
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { TERMO_VERSAO } from "@/lib/termo"

export async function termoAceito(colaboradorId: string) {
  const { data, error } = await supabaseAdmin
    .from("aceites_termo")
    .select("id")
    .eq("colaborador_id", colaboradorId)
    .eq("versao", TERMO_VERSAO)
    .limit(1)
  if (error) throw new Error(error.message)
  return Boolean(data?.length)
}

/** Resposta padrão quando falta o aceite: a tela abre o termo ao receber termo_pendente */
export const termoPendente = () =>
  NextResponse.json(
    { error: "Aceite o termo de consentimento antes de enviar fotos.", termo_pendente: true },
    { status: 403 },
  )

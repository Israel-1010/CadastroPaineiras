-- PD-05: histórico de envios e trocas de foto às catracas.
-- Uma linha por envio (colaborador), carga (admin) ou remoção das catracas (admin).
-- Guarda nome e CPF para o histórico continuar legível mesmo depois de o dependente ser removido.
-- O sistema funciona com ou sem esta tabela (sem ela, o histórico simplesmente não é gravado).

CREATE TABLE IF NOT EXISTS public.envios_foto (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  dependente_id  UUID REFERENCES public.dependentes(id) ON DELETE SET NULL,
  colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  admin_id       UUID REFERENCES public.administradores(id) ON DELETE SET NULL,
  cpf            TEXT,
  nome           TEXT,
  origem         TEXT NOT NULL,  -- colaborador | admin
  acao           TEXT NOT NULL,  -- envio | troca | reenvio | carga | remocao
  resultado      TEXT NOT NULL,  -- aceita | recusada | sem_conexao | erro_foto | removida | erro
  foto_url       TEXT,           -- foto enviada
  foto_anterior  TEXT,           -- foto que estava antes (troca, ou foto desvinculada na remoção)
  ip             TEXT,
  dispositivo    TEXT,
  detalhes       JSONB           -- ex.: resultado por catraca
);
CREATE INDEX IF NOT EXISTS idx_envios_foto_criado_em ON public.envios_foto (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_envios_foto_dependente ON public.envios_foto (dependente_id);

ALTER TABLE public.envios_foto ENABLE ROW LEVEL SECURITY;

-- TEMPORÁRIO: o servidor ainda usa a chave pública (role anon). Removida pelo 005_seguranca.sql,
-- que só deve rodar depois de trocar SUPABASE_SERVICE_ROLE_KEY pela chave de serviço verdadeira.
DROP POLICY IF EXISTS envios_foto_temporario ON public.envios_foto;
CREATE POLICY envios_foto_temporario ON public.envios_foto FOR ALL TO anon USING (true) WITH CHECK (true);

-- Recarrega o cache de tabelas da API (PostgREST)
NOTIFY pgrst, 'reload schema';

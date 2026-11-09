-- PD-04: registro do aceite do termo de consentimento (LGPD) pelo colaborador.
-- Rodar no SQL Editor do Supabase ANTES de publicar a versão que usa esta tabela.
-- Cada aceite guarda a versão do termo: ao mudar o texto (nova versão), todos aceitam de novo.

CREATE TABLE IF NOT EXISTS public.aceites_termo (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  versao         TEXT NOT NULL,
  aceito_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip             TEXT,
  dispositivo    TEXT
);
CREATE INDEX IF NOT EXISTS idx_aceites_termo_colaborador ON public.aceites_termo (colaborador_id, versao);

ALTER TABLE public.aceites_termo ENABLE ROW LEVEL SECURITY;

-- TEMPORÁRIO: hoje o servidor acessa o banco com a chave pública (role anon), então ela precisa
-- gravar e ler aqui. Esta política é removida pelo 005_seguranca.sql, que só deve rodar depois
-- de trocar SUPABASE_SERVICE_ROLE_KEY pela chave de serviço verdadeira.
DROP POLICY IF EXISTS aceites_termo_temporario ON public.aceites_termo;
CREATE POLICY aceites_termo_temporario ON public.aceites_termo FOR ALL TO anon USING (true) WITH CHECK (true);

-- Recarrega o cache de tabelas da API (PostgREST)
NOTIFY pgrst, 'reload schema';

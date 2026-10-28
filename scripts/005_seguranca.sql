-- =============================================================================
-- 005 - Endurecimento de segurança (executar no SQL Editor do Supabase)
-- Idempotente: pode ser executado mais de uma vez.
--
-- O que faz:
--   1. Remove TODAS as políticas RLS das tabelas do sistema e mantém o RLS ligado.
--      A aplicação acessa o banco só pelo servidor, com a service role (que ignora RLS).
--      Sem políticas, a chave anon (pública no navegador) não lê nem altera nada.
--   2. Garante constraints UNIQUE em RE/CPF/email (colaboradores) e CPF (dependentes).
--   3. Cria a tabela de auditoria.
--   4. Garante as colunas de presença usadas pelo painel admin.
-- =============================================================================

-- 1) RLS sem políticas ---------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('colaboradores', 'dependentes', 'administradores', 'auditoria')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.colaboradores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependentes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;

-- A função usada pela versão antiga para "simular" RLS não é mais necessária
DROP FUNCTION IF EXISTS public.set_session_config(text, text);

-- 2) Constraints UNIQUE --------------------------------------------------------
-- ATENÇÃO: se já houver duplicados, o ALTER falha. Para localizar:
--   SELECT cpf, count(*) FROM public.dependentes GROUP BY cpf HAVING count(*) > 1;
--   SELECT cpf, count(*) FROM public.colaboradores GROUP BY cpf HAVING count(*) > 1;
--   SELECT re, count(*) FROM public.colaboradores GROUP BY re HAVING count(*) > 1;
--   SELECT lower(email), count(*) FROM public.colaboradores GROUP BY lower(email) HAVING count(*) > 1;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'colaboradores_re_key') THEN
    ALTER TABLE public.colaboradores ADD CONSTRAINT colaboradores_re_key UNIQUE (re);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'colaboradores_cpf_key') THEN
    ALTER TABLE public.colaboradores ADD CONSTRAINT colaboradores_cpf_key UNIQUE (cpf);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'colaboradores_email_key') THEN
    ALTER TABLE public.colaboradores ADD CONSTRAINT colaboradores_email_key UNIQUE (email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dependentes_cpf_key') THEN
    ALTER TABLE public.dependentes ADD CONSTRAINT dependentes_cpf_key UNIQUE (cpf);
  END IF;
END $$;

-- 3) Auditoria -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auditoria (
  id          BIGSERIAL PRIMARY KEY,
  ator_tipo   TEXT NOT NULL CHECK (ator_tipo IN ('colaborador', 'admin')),
  ator_id     UUID NOT NULL,
  acao        TEXT NOT NULL,
  entidade    TEXT NOT NULL,
  entidade_id UUID,
  detalhes    JSONB,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON public.auditoria (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON public.auditoria (criado_em DESC);
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- 4) Presença (usada em /admin/dependentes) -----------------------------------
ALTER TABLE public.dependentes ADD COLUMN IF NOT EXISTS presenca_confirmada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.dependentes ADD COLUMN IF NOT EXISTS presenca_confirmada_em TIMESTAMPTZ;

-- 5) Senhas de admin ----------------------------------------------------------
-- O login agora só aceita hash bcrypt. Senhas antigas em texto puro (ex.: 'admin123')
-- deixam de funcionar. Defina uma nova senha com:
--   node scripts/admin-set-password.mjs <usuario> <nova-senha>

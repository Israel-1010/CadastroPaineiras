-- PD-02: perfil de acesso no painel administrativo.
--   admin: acesso total (padrão; os usuários existentes continuam admin)
--   rh:    cadastra e consulta colaboradores e dependentes (inclusive por planilha);
--          não acessa Carga no Facial, Remover das catracas, presença, exclusão nem relatórios.
-- O sistema funciona com ou sem esta coluna (sem ela, todo usuário é admin).
-- O usuário do RH é criado à parte (o comando com a senha não fica no repositório).

ALTER TABLE public.administradores ADD COLUMN IF NOT EXISTS perfil TEXT NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'administradores_perfil_check') THEN
    ALTER TABLE public.administradores
      ADD CONSTRAINT administradores_perfil_check CHECK (perfil IN ('admin', 'rh'));
  END IF;
END $$;

-- Recarrega o cache de colunas da API (PostgREST)
NOTIFY pgrst, 'reload schema';

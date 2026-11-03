-- Quem fez o último envio da foto às catracas pelo cartão do dependente.
-- Rodar no SQL Editor do Supabase ANTES de publicar a versão que usa esta coluna.
--   foto_enviada_por: 'colaborador' = enviada pelo próprio colaborador na tela dele
--                     NULL          = nunca enviada por ele (ex.: só pela carga do admin)
-- O aviso verde "Foto enviada às catracas" no cartão só aparece quando o colaborador enviou.

ALTER TABLE dependentes ADD COLUMN IF NOT EXISTS foto_enviada_por TEXT;

-- Recarrega o cache de colunas da API (PostgREST)
NOTIFY pgrst, 'reload schema';

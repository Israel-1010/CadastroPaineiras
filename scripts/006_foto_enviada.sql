-- Situação do envio da foto do dependente às catracas (facial Dahua).
-- Rodar no SQL Editor do Supabase ANTES de publicar a versão que usa estas colunas.
--   foto_aceita:     NULL = nunca enviada | true = facial aceitou | false = facial recusou
--   foto_enviada_em: data/hora do último envio (aceito ou recusado)

ALTER TABLE dependentes ADD COLUMN IF NOT EXISTS foto_aceita BOOLEAN;
ALTER TABLE dependentes ADD COLUMN IF NOT EXISTS foto_enviada_em TIMESTAMPTZ;

-- Recarrega o cache de colunas da API (PostgREST)
NOTIFY pgrst, 'reload schema';

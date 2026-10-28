-- ATENCAO: SCRIPT LEGADO E INSEGURO. Cria politicas RLS abertas ou senha em texto puro.
-- NAO EXECUTAR. Use scripts/005_seguranca.sql e scripts/admin-set-password.mjs.
-- Criar administrador padrão para o sistema
INSERT INTO administradores (
  id,
  username,
  password_hash,
  nome_completo,
  email,
  ativo,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin',
  'admin123', -- Em produção, usar hash bcrypt
  'Administrador do Sistema',
  'admin@empresa.com',
  true,
  now(),
  now()
) ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  nome_completo = EXCLUDED.nome_completo,
  email = EXCLUDED.email,
  ativo = EXCLUDED.ativo,
  updated_at = now();

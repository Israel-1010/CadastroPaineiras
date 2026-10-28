-- Inserir dados de teste para colaboradores
INSERT INTO colaboradores (re, cpf, nome_completo, email, created_at, updated_at)
VALUES 
  ('12345', '12345678900', 'João Silva Santos', 'joao.silva@empresa.com', NOW(), NOW()),
  ('67890', '98765432100', 'Maria Oliveira Costa', 'maria.oliveira@empresa.com', NOW(), NOW())
ON CONFLICT (re) DO NOTHING;

-- Inserir dados de teste para dependentes
INSERT INTO dependentes (nome_completo, cpf, genero, dependencia, data_nascimento, colaborador_id, created_at, updated_at)
SELECT 
  'Ana Silva Santos',
  '11122233344',
  'Feminino',
  'Filha',
  '2010-05-15',
  c.id,
  NOW(),
  NOW()
FROM colaboradores c 
WHERE c.re = '12345'
ON CONFLICT (cpf) DO NOTHING;

INSERT INTO dependentes (nome_completo, cpf, genero, dependencia, data_nascimento, colaborador_id, created_at, updated_at)
SELECT 
  'Pedro Silva Santos',
  '55566677788',
  'Masculino',
  'Filho',
  '2012-08-22',
  c.id,
  NOW(),
  NOW()
FROM colaboradores c 
WHERE c.re = '12345'
ON CONFLICT (cpf) DO NOTHING;

-- Verificar todos os dados na tabela colaboradores
SELECT 
    id,
    re,
    cpf,
    nome_completo,
    email,
    length(re) as re_length,
    length(cpf) as cpf_length,
    pg_typeof(re) as re_type,
    pg_typeof(cpf) as cpf_type
FROM colaboradores;

-- Verificar se existe registro com RE = '12345'
SELECT * FROM colaboradores WHERE re = '12345';

-- Verificar se existe registro com CPF = '12345678900'
SELECT * FROM colaboradores WHERE cpf = '12345678900';

-- Verificar se existe registro com ambos RE e CPF
SELECT * FROM colaboradores WHERE re = '12345' AND cpf = '12345678900';

-- Verificar com CAST para garantir tipos corretos
SELECT * FROM colaboradores WHERE CAST(re AS VARCHAR) = '12345' AND CAST(cpf AS VARCHAR) = '12345678900';

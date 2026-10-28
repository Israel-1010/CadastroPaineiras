-- Script para exportar dados da conta atual
-- Execute este script na conta ATUAL para gerar os dados de migração

-- Exportar colaboradores
COPY (
    SELECT id, re, cpf, nome_completo, email, created_at, updated_at
    FROM public.colaboradores
    ORDER BY created_at
) TO '/tmp/colaboradores_export.csv' WITH CSV HEADER;

-- Exportar dependentes
COPY (
    SELECT id, nome_completo, cpf, genero, dependencia, data_nascimento, 
           colaborador_id, foto_url, created_at, updated_at
    FROM public.dependentes
    ORDER BY created_at
) TO '/tmp/dependentes_export.csv' WITH CSV HEADER;

-- Exportar administradores
COPY (
    SELECT id, username, password_hash, nome_completo, email, ativo, created_at, updated_at
    FROM public.administradores
    ORDER BY created_at
) TO '/tmp/administradores_export.csv' WITH CSV HEADER;

-- Alternativa: Gerar INSERTs para migração manual
-- Colaboradores
SELECT 'INSERT INTO public.colaboradores (id, re, cpf, nome_completo, email, created_at, updated_at) VALUES ' ||
       string_agg(
           '(''' || id || ''', ''' || re || ''', ''' || cpf || ''', ''' || 
           replace(nome_completo, '''', '''''') || ''', ''' || email || ''', ''' || 
           created_at || ''', ''' || updated_at || ''')',
           ', '
       ) || ';'
FROM public.colaboradores;

-- Dependentes
SELECT 'INSERT INTO public.dependentes (id, nome_completo, cpf, genero, dependencia, data_nascimento, colaborador_id, foto_url, created_at, updated_at) VALUES ' ||
       string_agg(
           '(''' || id || ''', ''' || replace(nome_completo, '''', '''''') || ''', ''' || 
           cpf || ''', ''' || genero || ''', ''' || dependencia || ''', ''' || 
           data_nascimento || ''', ''' || colaborador_id || ''', ' ||
           COALESCE('''' || foto_url || '''', 'NULL') || ', ''' ||
           created_at || ''', ''' || updated_at || ''')',
           ', '
       ) || ';'
FROM public.dependentes;

-- Administradores
SELECT 'INSERT INTO public.administradores (id, username, password_hash, nome_completo, email, ativo, created_at, updated_at) VALUES ' ||
       string_agg(
           '(''' || id || ''', ''' || username || ''', ''' || password_hash || ''', ''' || 
           replace(nome_completo, '''', '''''') || ''', ''' || email || ''', ' || ativo || ', ''' || 
           created_at || ''', ''' || updated_at || ''')',
           ', '
       ) || ';'
FROM public.administradores;

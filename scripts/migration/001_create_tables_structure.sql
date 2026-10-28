-- Script para criar a estrutura completa das tabelas na nova conta Supabase
-- Execute este script primeiro na nova instância

-- Criar tabela colaboradores
CREATE TABLE IF NOT EXISTS public.colaboradores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    re VARCHAR(20) UNIQUE NOT NULL,
    cpf VARCHAR(11) UNIQUE NOT NULL,
    nome_completo TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela dependentes
CREATE TABLE IF NOT EXISTS public.dependentes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    cpf VARCHAR(11) UNIQUE NOT NULL,
    genero VARCHAR(20) NOT NULL,
    dependencia VARCHAR(50) NOT NULL,
    data_nascimento DATE NOT NULL,
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela administradores
CREATE TABLE IF NOT EXISTS public.administradores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nome_completo TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_colaboradores_re ON public.colaboradores(re);
CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON public.colaboradores(cpf);
CREATE INDEX IF NOT EXISTS idx_dependentes_colaborador_id ON public.dependentes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_dependentes_cpf ON public.dependentes(cpf);
CREATE INDEX IF NOT EXISTS idx_administradores_username ON public.administradores(username);

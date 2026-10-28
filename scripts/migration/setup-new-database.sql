-- ATENCAO: SCRIPT LEGADO E INSEGURO. Cria politicas RLS abertas ou senha em texto puro.
-- NAO EXECUTAR. Use scripts/005_seguranca.sql e scripts/admin-set-password.mjs.
-- Execute este script na nova conta Supabase ANTES da migração

-- Criar tabela de administradores
CREATE TABLE IF NOT EXISTS administradores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de colaboradores
CREATE TABLE IF NOT EXISTS colaboradores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    data_nascimento DATE NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(100),
    endereco TEXT,
    cargo VARCHAR(100),
    departamento VARCHAR(100),
    data_admissao DATE,
    salario DECIMAL(10,2),
    foto_url TEXT,
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de dependentes
CREATE TABLE IF NOT EXISTS dependentes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    colaborador_id UUID REFERENCES colaboradores(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    data_nascimento DATE NOT NULL,
    parentesco VARCHAR(50) NOT NULL,
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurar RLS (Row Level Security)
ALTER TABLE administradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependentes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para administradores
CREATE POLICY "Administradores podem ver todos os registros" ON administradores FOR ALL USING (true);
CREATE POLICY "Administradores podem inserir registros" ON administradores FOR INSERT WITH CHECK (true);
CREATE POLICY "Administradores podem atualizar registros" ON administradores FOR UPDATE USING (true);
CREATE POLICY "Administradores podem deletar registros" ON administradores FOR DELETE USING (true);

-- Políticas RLS para colaboradores
CREATE POLICY "Administradores podem ver todos os colaboradores" ON colaboradores FOR ALL USING (true);
CREATE POLICY "Administradores podem inserir colaboradores" ON colaboradores FOR INSERT WITH CHECK (true);
CREATE POLICY "Administradores podem atualizar colaboradores" ON colaboradores FOR UPDATE USING (true);
CREATE POLICY "Administradores podem deletar colaboradores" ON colaboradores FOR DELETE USING (true);

-- Políticas RLS para dependentes
CREATE POLICY "Administradores podem ver todos os dependentes" ON dependentes FOR ALL USING (true);
CREATE POLICY "Administradores podem inserir dependentes" ON dependentes FOR INSERT WITH CHECK (true);
CREATE POLICY "Administradores podem atualizar dependentes" ON dependentes FOR UPDATE USING (true);
CREATE POLICY "Administradores podem deletar dependentes" ON dependentes FOR DELETE USING (true);

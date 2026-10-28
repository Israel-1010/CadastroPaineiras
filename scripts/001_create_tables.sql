-- Criar tabelas para o sistema de atualização cadastral
-- Tabela de colaboradores
CREATE TABLE IF NOT EXISTS colaboradores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) UNIQUE NOT NULL,
  data_nascimento DATE NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255),
  endereco TEXT,
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de dependentes
CREATE TABLE IF NOT EXISTS dependentes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID REFERENCES colaboradores(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) UNIQUE NOT NULL,
  data_nascimento DATE NOT NULL,
  parentesco VARCHAR(50) NOT NULL,
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de administradores
CREATE TABLE IF NOT EXISTS administradores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario VARCHAR(100) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON colaboradores(cpf);
CREATE INDEX IF NOT EXISTS idx_dependentes_cpf ON dependentes(cpf);
CREATE INDEX IF NOT EXISTS idx_dependentes_colaborador_id ON dependentes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_administradores_usuario ON administradores(usuario);

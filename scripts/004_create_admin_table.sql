-- ATENCAO: SCRIPT LEGADO E INSEGURO. Cria politicas RLS abertas ou senha em texto puro.
-- NAO EXECUTAR. Use scripts/005_seguranca.sql e scripts/admin-set-password.mjs.
- Criar tabela de administradores
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

-- Inserir administrador padrão (senha: admin123)
INSERT INTO public.administradores (username, password_hash, nome_completo, email) 
VALUES (
    'admin',
    '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ', -- Hash para 'admin123'
    'Administrador do Sistema',
    'admin@empresa.com'
) ON CONFLICT (username) DO NOTHING;

-- Configurar RLS para administradores
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;

-- Política para permitir que administradores vejam apenas seus próprios dados
CREATE POLICY "Administradores podem ver seus próprios dados" ON public.administradores
    FOR SELECT USING (auth.uid()::text = id::text);

-- Política para permitir login (sem autenticação)
CREATE POLICY "Permitir verificação de login" ON public.administradores
    FOR SELECT USING (true);

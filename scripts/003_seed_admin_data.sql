-- ATENCAO: SCRIPT LEGADO E INSEGURO. Cria politicas RLS abertas ou senha em texto puro.
-- NAO EXECUTAR. Use scripts/005_seguranca.sql e scripts/admin-set-password.mjs.
-- Inserir dados iniciais do administrador
INSERT INTO administradores (usuario, senha, nome, email) 
VALUES ('admin', 'admin123', 'Administrador', 'tecnologia.cpm@clubepaineiras.com.br')
ON CONFLICT (usuario) DO NOTHING;

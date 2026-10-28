-- ATENCAO: SCRIPT LEGADO E INSEGURO. Cria politicas RLS abertas ou senha em texto puro.
-- NAO EXECUTAR. Use scripts/005_seguranca.sql e scripts/admin-set-password.mjs.
-- Habilitar RLS (Row Level Security)
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE administradores ENABLE ROW LEVEL SECURITY;

-- Políticas para colaboradores
CREATE POLICY "Colaboradores podem ver seus próprios dados" ON colaboradores
  FOR SELECT USING (true);

CREATE POLICY "Colaboradores podem atualizar seus próprios dados" ON colaboradores
  FOR UPDATE USING (true);

CREATE POLICY "Permitir inserção de colaboradores" ON colaboradores
  FOR INSERT WITH CHECK (true);

-- Políticas para dependentes
CREATE POLICY "Dependentes podem ser visualizados" ON dependentes
  FOR SELECT USING (true);

CREATE POLICY "Dependentes podem ser atualizados" ON dependentes
  FOR UPDATE USING (true);

CREATE POLICY "Permitir inserção de dependentes" ON dependentes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir exclusão de dependentes" ON dependentes
  FOR DELETE USING (true);

-- Políticas para administradores
CREATE POLICY "Administradores podem ver todos os dados" ON administradores
  FOR ALL USING (true);

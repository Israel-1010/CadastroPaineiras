-- ATENCAO: SCRIPT LEGADO E INSEGURO. Cria politicas RLS abertas ou senha em texto puro.
-- NAO EXECUTAR. Use scripts/005_seguranca.sql e scripts/admin-set-password.mjs.
-- Configurar Row Level Security para as tabelas existentes

-- Habilitar RLS para colaboradores
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

-- Políticas para colaboradores - cada colaborador só pode ver seus próprios dados
CREATE POLICY "colaboradores_select_own" ON public.colaboradores
  FOR SELECT USING (re = current_setting('app.current_user_re', true));

CREATE POLICY "colaboradores_update_own" ON public.colaboradores
  FOR UPDATE USING (re = current_setting('app.current_user_re', true));

-- Habilitar RLS para dependentes
ALTER TABLE public.dependentes ENABLE ROW LEVEL SECURITY;

-- Políticas para dependentes - cada colaborador só pode ver/editar dependentes vinculados a ele
CREATE POLICY "dependentes_select_own" ON public.dependentes
  FOR SELECT USING (
    colaborador_id IN (
      SELECT id FROM public.colaboradores 
      WHERE re = current_setting('app.current_user_re', true)
    )
  );

CREATE POLICY "dependentes_insert_own" ON public.dependentes
  FOR INSERT WITH CHECK (
    colaborador_id IN (
      SELECT id FROM public.colaboradores 
      WHERE re = current_setting('app.current_user_re', true)
    )
  );

CREATE POLICY "dependentes_update_own" ON public.dependentes
  FOR UPDATE USING (
    colaborador_id IN (
      SELECT id FROM public.colaboradores 
      WHERE re = current_setting('app.current_user_re', true)
    )
  );

CREATE POLICY "dependentes_delete_own" ON public.dependentes
  FOR DELETE USING (
    colaborador_id IN (
      SELECT id FROM public.colaboradores 
      WHERE re = current_setting('app.current_user_re', true)
    )
  );

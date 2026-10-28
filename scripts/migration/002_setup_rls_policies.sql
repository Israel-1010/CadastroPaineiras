-- ATENCAO: SCRIPT LEGADO E INSEGURO. Cria politicas RLS abertas ou senha em texto puro.
-- NAO EXECUTAR. Use scripts/005_seguranca.sql e scripts/admin-set-password.mjs.
-- Script para configurar Row Level Security na nova conta
-- Execute após criar as tabelas

-- Habilitar RLS para colaboradores
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

-- Políticas para colaboradores
CREATE POLICY "colaboradores_select_own" ON public.colaboradores
  FOR SELECT USING (re = current_setting('app.current_user_re', true));

CREATE POLICY "colaboradores_update_own" ON public.colaboradores
  FOR UPDATE USING (re = current_setting('app.current_user_re', true));

-- Habilitar RLS para dependentes
ALTER TABLE public.dependentes ENABLE ROW LEVEL SECURITY;

-- Políticas para dependentes
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

-- Habilitar RLS para administradores
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;

-- Políticas para administradores
CREATE POLICY "Administradores podem ver seus próprios dados" ON public.administradores
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Permitir verificação de login" ON public.administradores
    FOR SELECT USING (true);

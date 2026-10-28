-- Criar função para definir configurações de sessão
CREATE OR REPLACE FUNCTION set_session_config(config_name text, config_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config(config_name, config_value, false);
END;
$$;

-- Criar função para obter configurações atuais
CREATE OR REPLACE FUNCTION get_session_config(config_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN current_setting(config_name, true);
END;
$$;

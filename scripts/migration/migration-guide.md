# Guia de Migração do Supabase

Este guia te ajudará a migrar todos os dados do projeto para uma nova conta Supabase.

## Pré-requisitos

1. **Nova conta Supabase criada**
2. **Novo projeto Supabase configurado**
3. **Acesso ao SQL Editor em ambas as contas**

## Passo a Passo da Migração

### 1. Preparar a Nova Conta

Na **NOVA conta Supabase**:

1. Acesse o SQL Editor
2. Execute os scripts na seguinte ordem:
   - `001_create_tables_structure.sql`
   - `002_setup_rls_policies.sql`

### 2. Exportar Dados da Conta Atual

Na **conta ATUAL**:

1. Acesse o SQL Editor
2. Execute `003_export_data.sql`
3. Copie os resultados dos SELECTs que geram os INSERTs

### 3. Importar Dados na Nova Conta

Na **NOVA conta Supabase**:

1. Execute os comandos INSERT gerados no passo anterior
2. Verifique se todos os dados foram importados corretamente

### 4. Configurar o Projeto v0

1. **Remover integração atual:**
   - Vá em Project Settings (⚙️)
   - Remova a integração Supabase atual

2. **Adicionar nova integração:**
   - Adicione a nova integração Supabase
   - Configure com os dados da nova conta

3. **Verificar variáveis de ambiente:**
   - Confirme que todas as variáveis foram atualizadas
   - Teste a conexão

### 5. Migrar Arquivos de Imagem (se houver)

Se você tem fotos de dependentes armazenadas:

1. **Na conta atual:** Baixe todas as imagens do Storage
2. **Na nova conta:** Crie o bucket e faça upload das imagens
3. **Atualize as URLs:** Execute script para atualizar as URLs das fotos

### 6. Testar a Migração

1. Teste o login de colaboradores
2. Teste o login de administradores
3. Verifique se os dependentes estão sendo exibidos corretamente
4. Teste todas as funcionalidades principais

## Comandos Úteis para Verificação

\`\`\`sql
-- Verificar contagem de registros
SELECT 'colaboradores' as tabela, COUNT(*) as total FROM colaboradores
UNION ALL
SELECT 'dependentes' as tabela, COUNT(*) as total FROM dependentes
UNION ALL
SELECT 'administradores' as tabela, COUNT(*) as total FROM administradores;

-- Verificar integridade referencial
SELECT d.nome_completo, c.nome_completo as colaborador
FROM dependentes d
LEFT JOIN colaboradores c ON d.colaborador_id = c.id
WHERE c.id IS NULL;
\`\`\`

## Troubleshooting

- **Erro de chave estrangeira:** Certifique-se de importar colaboradores antes de dependentes
- **Erro de duplicata:** Verifique se não há dados duplicados na nova conta
- **RLS bloqueando:** Temporariamente desabilite RLS durante a importação se necessário

## Rollback

Se algo der errado, você pode:
1. Manter a conta atual funcionando
2. Recriar a nova conta do zero
3. Repetir o processo de migração

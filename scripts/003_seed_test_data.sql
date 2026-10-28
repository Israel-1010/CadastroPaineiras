-- Criando dados de teste para colaboradores e dependentes
-- Inserir colaboradores de teste
INSERT INTO colaboradores (nome_completo, re, cpf) VALUES 
('João Silva Santos', '12345', '12345678901'),
('Maria Oliveira Costa', '67890', '98765432100'),
('Pedro Souza Lima', '11111', '11122233344');

-- Inserir dependentes de teste para o colaborador João Silva (RE: 12345)
INSERT INTO dependentes (colaborador_id, nome_completo, cpf, genero, tipo_dependencia) VALUES 
((SELECT id FROM colaboradores WHERE re = '12345'), 'Ana Silva Santos', '12312312312', 'Feminino', 'Filha'),
((SELECT id FROM colaboradores WHERE re = '12345'), 'Carlos Silva Santos', '32132132132', 'Masculino', 'Filho'),
((SELECT id FROM colaboradores WHERE re = '12345'), 'Lucia Santos Silva', '45645645645', 'Feminino', 'Esposa');

-- Inserir dependentes de teste para a colaboradora Maria Oliveira (RE: 67890)
INSERT INTO dependentes (colaborador_id, nome_completo, cpf, genero, tipo_dependencia) VALUES 
((SELECT id FROM colaboradores WHERE re = '67890'), 'Roberto Costa Oliveira', '78978978978', 'Masculino', 'Esposo'),
((SELECT id FROM colaboradores WHERE re = '67890'), 'Beatriz Oliveira Costa', '65465465465', 'Feminino', 'Filha');

-- Inserir dependente de teste para o colaborador Pedro Souza (RE: 11111)
INSERT INTO dependentes (colaborador_id, nome_completo, cpf, genero, tipo_dependencia) VALUES 
((SELECT id FROM colaboradores WHERE re = '11111'), 'Fernanda Lima Souza', '95195195195', 'Feminino', 'Esposa');

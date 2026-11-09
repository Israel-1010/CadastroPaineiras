// PD-04: termo de consentimento (LGPD) aceito pelo colaborador antes de tirar e enviar fotos.
// Sem dependências de servidor: usado pela tela e pelo servidor.
//
// RASCUNHO para validação do Jurídico / Encarregado de Dados. Os trechos entre [colchetes]
// precisam ser preenchidos. Ao alterar o texto, mude TERMO_VERSAO: todos aceitam de novo.

export const TERMO_VERSAO = "1.0-rascunho"

export const TERMO_TITULO = "Termo de consentimento para uso de dados pessoais e biométricos"

export type SecaoTermo = { titulo: string; paragrafos?: string[]; itens?: string[] }

export const TERMO_SECOES: SecaoTermo[] = [
  {
    titulo: "1. Quem trata os dados",
    paragrafos: ["O Clube Paineiras do Morumby (“Clube”) é o controlador dos dados informados neste sistema."],
  },
  {
    titulo: "2. Para que os dados serão usados",
    paragrafos: [
      "Exclusivamente para liberar a entrada dos seus dependentes por reconhecimento facial nas catracas do Clube durante a Festa dos Colaboradores, em [DATA E HORÁRIO DO EVENTO].",
    ],
  },
  {
    titulo: "3. Quais dados",
    paragrafos: [
      "Nome, CPF, data de nascimento, parentesco e a foto do rosto de cada dependente. A foto gera um dado biométrico, considerado dado pessoal sensível pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018, art. 11).",
    ],
  },
  {
    titulo: "4. Com quem os dados são compartilhados",
    paragrafos: [
      "Somente com os fornecedores de tecnologia necessários para operar o acesso (sistema das catracas e armazenamento em nuvem), que não podem usá-los para outra finalidade.",
    ],
  },
  {
    titulo: "5. Por quanto tempo",
    paragrafos: ["As fotos e os cadastros nas catracas serão excluídos em até [PRAZO] após o evento."],
  },
  {
    titulo: "6. Declarações do colaborador",
    paragrafos: ["Ao aceitar, declaro que:"],
    itens: [
      "sou responsável legal pelos dependentes menores de idade e consinto, em nome deles, com o uso descrito acima (LGPD, art. 14);",
      "os dependentes maiores de idade foram informados e concordam com o envio das suas fotos;",
      "as fotos enviadas são verdadeiras e de cada dependente indicado.",
    ],
  },
  {
    titulo: "7. Seus direitos",
    paragrafos: [
      "Você pode, a qualquer momento, pedir acesso, correção ou exclusão dos dados e revogar este consentimento pelo canal [E-MAIL DO ENCARREGADO DE DADOS OU DO RH]. Sem o consentimento, a entrada por reconhecimento facial não é liberada e o dependente entra por [FORMA ALTERNATIVA DE ENTRADA].",
    ],
  },
]

export const TERMO_CONCORDO =
  "Li o termo e, como responsável pelos dependentes listados, autorizo o uso das fotos e dos dados para a finalidade descrita."

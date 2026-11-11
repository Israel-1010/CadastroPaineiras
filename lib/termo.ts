// PD-04: termo de consentimento (LGPD) aceito pelo colaborador antes de tirar e enviar fotos.
// Sem dependências de servidor: usado pela tela e pelo servidor.
//
// O texto descreve o que o sistema faz de fato (catracas, registro de passagens, relatório para a
// diretoria, histórico de envios). Ao mudar o texto, mude TERMO_VERSAO: todos aceitam de novo.
// Recomendado: validação do Jurídico / Encarregado de Dados.

export const TERMO_VERSAO = "1.0"

export const TERMO_TITULO = "Termo de consentimento para uso de dados pessoais e biométricos"

export type SecaoTermo = { titulo: string; paragrafos?: string[]; itens?: string[] }

/** Prazo de exclusão depois do evento (também citado no resumo) */
export const TERMO_PRAZO_EXCLUSAO = "5 dias"

export const TERMO_SECOES: SecaoTermo[] = [
  {
    titulo: "Em resumo",
    paragrafos: [
      `A foto do rosto dos seus dependentes serve só para eles entrarem na Festa dos Colaboradores pelo reconhecimento facial das catracas. As fotos e os registros são apagados em até ${TERMO_PRAZO_EXCLUSAO} depois do evento. Aceitar é opcional, e você pode desistir quando quiser, pelo RH.`,
    ],
  },
  {
    titulo: "1. Quem é responsável pelos dados",
    paragrafos: [
      "O Clube Paineiras do Morumby (“Clube”) é o controlador dos dados pessoais informados neste sistema, nos termos da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD).",
    ],
  },
  {
    titulo: "2. Para que os dados são usados",
    paragrafos: ["Os dados são usados somente para:"],
    itens: [
      "cadastrar o rosto dos seus dependentes nas catracas e liberar a entrada deles por reconhecimento facial na Festa dos Colaboradores de 2026;",
      "registrar as passagens pelas catracas (data, hora, entrada ou saída), para o controle de acesso e a segurança do evento;",
      "produzir relatórios para a Diretoria com números totais do evento (entradas, saídas e quantidade de homens, mulheres e crianças), sem identificar nenhuma pessoa;",
      "manter o histórico dos envios de foto, para resolver problemas e comprovar quem fez cada envio.",
    ],
  },
  {
    titulo: "3. Quais dados são tratados",
    itens: [
      "Do dependente: nome, CPF, data de nascimento, sexo, parentesco e a foto do rosto. A foto gera um dado biométrico, que a LGPD considera dado pessoal sensível (art. 11).",
      "Das passagens pelas catracas: data e hora, se foi entrada ou saída, a catraca usada e o grau de semelhança do reconhecimento.",
      "De cada envio de foto: data e hora, endereço IP, o tipo de aparelho usado e se a catraca aceitou ou recusou a foto. A foto recusada fica guardada só nesse histórico e nunca é usada para liberar a entrada.",
    ],
  },
  {
    titulo: "4. Base legal",
    paragrafos: [
      "O tratamento se baseia no seu consentimento específico e destacado, dado neste termo (LGPD, art. 11, inciso I). Para dependentes crianças e adolescentes, o consentimento é dado por você, como responsável legal, e os dados são usados no melhor interesse deles (LGPD, art. 14).",
    ],
  },
  {
    titulo: "5. Como funciona o envio da foto",
    itens: [
      "A foto só vale depois que a catraca a aceita. Se ela for recusada, você pode tirar outra.",
      "Depois que o dependente passa pela catraca com a foto enviada, ela não pode mais ser trocada pelo sistema. Para trocar, procure o RH.",
      "Use uma foto só do rosto do dependente, de frente e bem iluminada, sem boné e sem óculos escuros, sem outras pessoas na imagem.",
    ],
  },
  {
    titulo: "6. Com quem os dados são compartilhados",
    paragrafos: [
      "Os dados não são vendidos nem cedidos. Eles são acessados apenas pelas equipes autorizadas do RH e da TI do Clube e pelos fornecedores de tecnologia necessários para operar o acesso: os equipamentos de reconhecimento facial das catracas, os servidores do sistema e o serviço de armazenamento em nuvem, que pode manter os dados fora do Brasil, com as garantias exigidas pela LGPD. Esses fornecedores só podem usar os dados para essa finalidade.",
    ],
  },
  {
    titulo: "7. Por quanto tempo os dados são guardados",
    paragrafos: [
      `As fotos, o cadastro nas catracas, os registros de passagem e o histórico de envios são excluídos em até ${TERMO_PRAZO_EXCLUSAO} depois do evento. Os relatórios com números totais, que não identificam ninguém, podem ser mantidos. O registro deste aceite é guardado pelo tempo necessário para comprovar o seu consentimento (LGPD, art. 8º, § 2º).`,
    ],
  },
  {
    titulo: "8. Segurança",
    paragrafos: [
      "O acesso ao sistema é restrito a pessoas autorizadas, com senha, e as ações de envio, troca e exclusão de fotos ficam registradas.",
    ],
  },
  {
    titulo: "9. Declarações do colaborador",
    paragrafos: ["Ao aceitar, declaro que:"],
    itens: [
      "sou responsável legal pelos dependentes menores de idade e consinto, em nome deles, com o uso descrito neste termo;",
      "informei os dependentes maiores de idade e eles concordam com o envio das próprias fotos;",
      "as fotos enviadas são verdadeiras e mostram o próprio dependente indicado.",
    ],
  },
  {
    titulo: "10. Seus direitos",
    paragrafos: [
      "Você pode, a qualquer momento, pedir ao Departamento de RH do Clube: a confirmação de que os dados são tratados, o acesso a eles, a correção de dados errados, a exclusão das fotos e dos dados, informações sobre com quem são compartilhados e a revogação deste consentimento.",
      "Se você revogar, a foto é retirada das catracas e o dependente deixa de entrar por reconhecimento facial. A revogação não afeta o que foi feito antes dela.",
    ],
  },
  {
    titulo: "11. Aceitar é opcional",
    paragrafos: [
      "Não aceitar este termo, ou revogá-lo depois, não traz nenhuma consequência para o seu trabalho no Clube. Sem o aceite, as fotos não são enviadas às catracas, e o RH orienta como o dependente pode entrar no evento.",
    ],
  },
]

export const TERMO_CONCORDO =
  "Li e entendi este termo. Como responsável pelos dependentes cadastrados, autorizo o uso das fotos e dos dados deles para a entrada por reconhecimento facial na Festa dos Colaboradores, nas condições descritas."

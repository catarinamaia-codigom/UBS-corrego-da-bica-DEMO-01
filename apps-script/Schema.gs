/** BICA — Pesquisa Territorial 1.0 · Esquema de dados (abas, perguntas, módulos e documentos). */

/**
 * Abas e colunas obrigatórias. configurarBica() cria as abas que faltarem e acrescenta ao final
 * as colunas que faltarem, sem apagar nem reordenar dados existentes. A leitura é feita pelo nome
 * da coluna, então colunas extras adicionadas manualmente não atrapalham.
 */
const BICA_SHEETS = {
  'Instrucoes': ['item', 'descricao'],
  'Parametros': ['chave', 'valor', 'atualizado_em'],
  'Acessos': ['id', 'identificacao', 'perfil', 'login', 'senha', 'ativo', 'criado_em', 'revogado_em'],
  'Blocos': ['id', 'nome', 'versao', 'config_json', 'ativo', 'criado_em', 'atualizado_em'],
  'Ruas': ['id', 'nome', 'canonico', 'status', 'fundida_em', 'casas_previstas', 'moradores_previstos', 'fonte_estimativa', 'criado_em', 'criado_por'],
  'Apelidos_Ruas': ['id', 'rua_id', 'apelido', 'canonico', 'criado_em'],
  'Equipes': ['id', 'nome', 'canonico', 'ativa', 'criado_em', 'criado_por'],
  'ACS': ['id', 'nome', 'canonico', 'ativa', 'criado_em', 'criado_por'],
  'Fusoes_Cadastros': ['id', 'tipo', 'origem_id', 'principal_id', 'momento', 'ator_id', 'observacao'],
  'Domicilios': ['id', 'rua_id', 'numero', 'complemento', 'moradores_declarados', 'equipe_id', 'acs_id', 'situacao', 'latitude', 'longitude', 'geo_status', 'criado_em', 'atualizado_em', 'criado_por', 'atualizado_por'],
  'Pessoas': ['id', 'domicilio_id', 'nome_opcional', 'sexo', 'idade_referida', 'parentesco', 'criado_em', 'atualizado_em'],
  'Visitas': ['id', 'request_id', 'bloco_id', 'domicilio_id', 'coletor_id', 'situacao', 'momento', 'moradores_informados', 'observacao', 'origem'],
  'Participacoes': ['id', 'visita_id', 'bloco_id', 'domicilio_id', 'pessoa_id', 'situacao', 'momento', 'coletor_id'],
  'Entrevistas': ['id', 'visita_id', 'bloco_id', 'domicilio_id', 'pessoa_id', 'coletor_id', 'momento', 'informante', 'versao_formulario', 'consentimento_id', 'respostas_json', 'origem', 'edicao_questionario'],
  'Respostas': ['id', 'entrevista_id', 'bloco_id', 'domicilio_id', 'pessoa_id', 'pergunta_id', 'tipo', 'resposta_codificada', 'resposta_texto', 'momento'],
  'Termos': ['id', 'bloco_id', 'versao', 'texto_completo', 'criado_em', 'criado_por', 'ativo'],
  'Consentimentos': ['id', 'entrevista_id', 'pessoa_id', 'bloco_id', 'termo_id', 'termo_versao', 'manifestacao', 'modalidade', 'momento', 'coletor_id', 'texto_termo_registrado', 'observacao'],
  'Config_PDF': ['bloco_id', 'campos_json', 'atualizado_em', 'alterado_por'],
  'Dicionario': ['pergunta_id', 'grupo', 'pergunta', 'tipo', 'opcoes_json', 'origem', 'observacao'],
  'Auditoria': ['id', 'momento', 'ator_id', 'acao', 'entidade', 'entidade_id', 'detalhes_json'],
  'Perguntas': ['id', 'grupo', 'pergunta', 'tipo', 'opcoes_json', 'condicao_json', 'origem', 'observacao', 'desde', 'atualizado_em', 'atualizado_por', 'tipos_json'],
  'Historico_Questionario': ['id', 'momento', 'ator_id', 'ator_nome', 'edicao', 'escopo', 'pergunta_id', 'acao', 'resumo', 'detalhes_json'],
  'Feedback': ['id', 'momento', 'ator_id', 'ator_nome', 'perfil', 'tipo', 'texto', 'pagina', 'status', 'resolvido_em', 'resolvido_por'],
  'Resumo': ['indicador', 'valor', 'observacao']
};

/** Colunas que guardam números de verdade; as demais ficam em formato de texto para preservar "007", "12-A" etc. */
const BICA_NUMERIC_COLUMNS = ['versao', 'casas_previstas', 'moradores_previstos', 'moradores_declarados', 'idade_referida', 'latitude', 'longitude', 'moradores_informados'];

/** Abas com dados pessoais ou credenciais (marcadas em laranja na planilha). */
const BICA_SENSITIVE_SHEETS = ['Acessos', 'Pessoas', 'Entrevistas', 'Respostas', 'Consentimentos', 'Termos', 'Participacoes'];

/** Situação de cada pessoa em uma visita. Somente CONCORDOU abre o questionário. */
const BICA_OUTCOMES = ['CONCORDOU', 'RECUSOU', 'NAO_SABE', 'AUSENTE'];

/**
 * EDIÇÃO DO QUESTIONÁRIO
 * - Tudo é feito no app, em Construtor da pesquisa (coordenação):
 *   ligar/desligar perguntas por bloco, incluir pergunta, corrigir textos, mudar o tipo de resposta, incluir/ocultar opções.
 *   As inclusões e alterações ficam na aba Perguntas e o histórico na aba Historico_Questionario.
 * - BICA_QUESTIONS abaixo é o questionário de base. A aba Perguntas sobrepõe/acrescenta (mesmo id = substitui).
 * - Cada alteração aumenta a edição do questionário (parâmetro EDICAO_QUESTIONARIO). Cada entrevista grava a
 *   edição com que foi feita; o que foi criado depois aparece como "não constava" nas entrevistas antigas.
 *   Formato de opção: ['codigo', 'Texto', {desde: 3, oculta: true}] (meta opcional).
 * - Códigos (ids) nunca são reaproveitados nem apagados: opção que deixou de valer é ocultada.
 */
const BICA_EDICAO_QUESTIONARIO = 2; // edição mínima: 1 = questionário original (v1.0) · 2 = v1.1 (Conecta e filtro de dificuldade)

const BICA_QUESTIONS = [
  {id: 'medico', group: 'Acesso e cuidado', label: 'Quando foi sua última consulta ao médico da unidade?', type: 'single', origin: 'original', options: [['menos6', 'Menos de 6 meses'], ['6a12', 'Há 1 ano'], ['mais12', 'Há mais de 1 ano'], ['nunca', 'Nunca consultei'], ['naosei', 'Não sei informar']], note: 'No original, nunca e não sei estavam juntos; separação proposta.'},
  {id: 'dentista', group: 'Acesso e cuidado', label: 'Quando foi sua última consulta ao dentista da unidade?', type: 'single', origin: 'original', options: [['ate12', 'Há menos de 1 ano'], ['mais12', 'Há mais de 1 ano'], ['nunca', 'Nunca consultei'], ['naosei', 'Não sei informar']]},
  {id: 'preventivo', group: 'Acesso e cuidado', label: 'Quando foi sua última prevenção?', type: 'single', origin: 'original', options: [['menos1', 'Há menos de 1 ano'], ['1mais', 'Há mais de 1 ano'], ['nunca', 'Nunca fiz'], ['na', 'Não se aplica'], ['naosei', 'Não sei informar']], note: 'Definir exame e elegibilidade antes da pesquisa.'},
  {id: 'comunicacao', group: 'Relacionamento com a unidade', label: 'Como você se comunica com a unidade?', type: 'multi', origin: 'original', options: [['presencial', 'Presencial'], ['ligacao', 'Telefone (ligação)'], ['whatsapp', 'WhatsApp'], ['conecta', 'Conecta']]},
  {id: 'conecta', group: 'Relacionamento com a unidade', label: 'Você conhece o Conecta?', type: 'single', origin: 'original', options: [['atual', 'Conheço e utilizo'], ['nunca', 'Conheço, mas não utilizo'], ['desconhece', 'Não conheço']]},
  {id: 'motivos_conecta', group: 'Relacionamento com a unidade', label: 'Por que você não utiliza o Conecta?', type: 'multi', origin: 'original', depends: {field: 'conecta', values: ['nunca', 'desconhece']}, options: [['celular', 'Não tenho celular'], ['trava', 'O app trava'], ['utilizar', 'Não sei mexer no aplicativo'], ['vagas', 'Faltam vagas no aplicativo Conecta'], ['nao_explicaram', 'Não me explicaram como funciona', {desde: 2}]]},
  {id: 'servicos', group: 'Acesso e cuidado', label: 'Acesso a serviços de saúde', type: 'multi', origin: 'original', options: [['sus', 'SUS'], ['plano', 'Plano de saúde'], ['mutirao', 'Mutirão político/social/igreja']]},
  {id: 'marcacao', group: 'Relacionamento com a unidade', label: 'Como você marca a consulta?', type: 'multi', origin: 'original', options: [['acolhimento', 'Acolhimento'], ['recepcao', 'Marcação tradicional na recepção'], ['conecta', 'Conecta Recife'], ['grupos', 'Grupos (Hiperdia...)'], ['acs', 'Consulta facilitada com ACS']]},
  {id: 'sem_dificuldades', group: 'Barreiras e melhorias', label: 'Você enfrenta alguma dificuldade para acessar a unidade?', type: 'single', origin: 'proposta', options: [['sim', 'Tem dificuldade'], ['nao', 'Não tem dificuldade'], ['naosei', 'Não sabe informar']], note: 'Pergunta-filtro: “Tem dificuldade” abre a lista de dificuldades.'},
  {id: 'dificuldades', group: 'Barreiras e melhorias', label: 'Quais suas dificuldades para chegar até a unidade?', type: 'multi', origin: 'original', depends: {field: 'sem_dificuldades', values: ['sim']}, options: [['ingreme', 'Barreira íngreme'], ['transporte', 'Dificuldade de acesso ao transporte'], ['locomocao', 'Dificuldade de locomoção'], ['horario', 'Horário de funcionamento da unidade'], ['cuidador', 'Sobrecarga de cuidador'], ['esquece', 'Esqueço de marcar consultas'], ['trabalho', 'Conflito com horário de trabalho'], ['outros', 'Outros (especificar)']]},
  {id: 'dificuldade_outro', group: 'Barreiras e melhorias', label: 'Se marcou “Outros”, descreva a dificuldade', type: 'text', origin: 'proposta', depends: {field: 'dificuldades', values: ['outros']}},
  {id: 'informacao_sus', group: 'Barreiras e melhorias', label: 'Alguém da equipe já explicou como funcionam os serviços e o agendamento da UBS?', type: 'single', origin: 'proposta', options: [['sim', 'Sim'], ['nao', 'Não'], ['naosei', 'Não lembro / não sei']]},
  {id: 'sugestao_sus', group: 'Barreiras e melhorias', label: 'O que você gostaria de compreender melhor sobre a UBS ou o SUS?', type: 'text', origin: 'proposta'}
];

const BICA_MODULES = [
  {id: 'name', label: 'Nome ou apelido opcional', detail: 'Identificação leve, restrita à coordenação.', default: false},
  {id: 'multi', label: 'Múltiplos moradores por domicílio', detail: 'Uma residência, vários questionários individuais.', default: true},
  {id: 'proxy', label: 'Quem está respondendo?', detail: 'Distingue participante e informante.', default: true},
  {id: 'audio', label: 'Áudio do consentimento', detail: 'No início do formulário, somente após validação ética. O áudio não é enviado à planilha.', default: false},
  {id: 'open', label: 'Respostas abertas', detail: 'Campos descritivos e “Outros”.', default: true},
  {id: 'longitudinal', label: 'Atualização longitudinal', detail: 'Permite nova entrevista da mesma pessoa no mesmo bloco, sem sobrescrever a anterior.', default: false},
  {id: 'street', label: 'Busca de rua e sequência de casas', detail: 'Rua fica selecionada até a equipe decidir trocar.', default: true}
];

function bicaDefaultConfig_() {
  return {
    modules: Object.fromEntries(BICA_MODULES.map(m => [m.id, !!m.default])),
    questions: Object.fromEntries(bicaQuestions_().map(q => [q.id, true]))
  };
}

/** Campos que a coordenação pode incluir no PDF individual (padrão protegido: somente IDs + respostas). */
const BICA_PDF_FIELDS = ['name', 'address', 'sex', 'age', 'proxy', 'datetime', 'collector', 'answers', 'openAnswers', 'history', 'consentSummary', 'consentFull'];
const BICA_PDF_DEFAULT = {name: false, address: false, sex: false, age: false, proxy: false, datetime: true, collector: false, answers: true, openAnswers: false, history: false, consentSummary: true, consentFull: true};

const BICA_TERMO_INICIAL = `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO — MINUTA PARA VALIDAÇÃO
Pesquisa: Acesso e cuidado no território da USF Mais Córrego da Bica — Equipe 2

1. CONVITE E OBJETIVOS
Você está sendo convidado(a) a participar voluntariamente de um levantamento realizado por estudantes em parceria com a equipe da unidade de saúde. O objetivo é compreender o acesso aos serviços de saúde, as dificuldades enfrentadas pelos moradores e oportunidades de melhoria no atendimento.

2. COMO A PESQUISA ACONTECE
Um(a) entrevistador(a) fará perguntas sobre utilização de serviços de saúde, comunicação com a unidade e barreiras de acesso. Poderão ser registradas informações gerais sobre o domicílio, para organizar o estudo territorial. A duração estimada deverá ser informada pela equipe após o teste do instrumento.

3. PARTICIPAÇÃO VOLUNTÁRIA
Você é livre para não participar, deixar de responder qualquer pergunta ou interromper a entrevista. Sua decisão não causa prejuízo ao atendimento, a benefícios ou ao relacionamento com a unidade de saúde.

4. DESCONFORTOS E RISCOS
Algumas perguntas podem causar desconforto. A associação de respostas com características do domicílio pode apresentar risco de identificação; por isso são necessários acesso restrito e cuidados com a divulgação das informações.

5. SIGILO, ARMAZENAMENTO E DIVULGAÇÃO
As informações serão utilizadas para as finalidades aprovadas do levantamento. O acesso a dados individuais será limitado às pessoas autorizadas. Resultados públicos deverão ser apresentados de forma agregada e com proteção contra identificação. A equipe precisa definir e informar o prazo de guarda, canal de contato e medidas de segurança no protocolo definitivo.

6. NOVA ENTREVISTA NO FUTURO
O sistema pode permitir atualização futura, mas isso não significa autorização automática para novo contato ou utilização fora das finalidades informadas. A equipe deverá definir como solicitar o consentimento aplicável a etapas posteriores.

7. INFORMAÇÕES E CONTATOS
Responsável pela pesquisa: [PREENCHER NOME E CONTATO]
Instituição responsável: [PREENCHER]
Contato para dúvidas ou solicitações sobre os dados: [PREENCHER]
Comitê de Ética, quando aplicável: [PREENCHER]

8. REGISTRO DO CONSENTIMENTO
A modalidade de registro — escrita, eletrônica, verbal/sonora ou outra — dependerá da validação ética e jurídica do protocolo. Esta minuta e as marcações da plataforma NÃO constituem prova de consentimento de participantes reais.`;

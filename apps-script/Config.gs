/**
 * BICA — Pesquisa Territorial 1.0 · Configuração
 *
 * O mesmo index.html do GitHub roda em dois lugares e grava na MESMA planilha:
 *   1) GitHub Pages  → envia os dados para a URL /exec desta implantação (doPost);
 *   2) Apps Script   → doGet() carrega o index.html publicado no GitHub e usa google.script.run.
 *
 * Nenhum ID de planilha precisa ficar no código público: crie este projeto pela própria
 * planilha (Extensões > Apps Script) e execute configurarBica() uma vez.
 */

/** Versão do servidor (o app avisa a coordenação quando o Apps Script está desatualizado). */
const BICA_VERSAO = '1.4';

/** Nome exibido no app, nos PDFs e no título da planilha. */
const BICA_TITLE = 'USF MAIS CÓRREGO DA BICA — EQUIPE 2';

/**
 * Endereço do index.html no GitHub. O Apps Script exibe sempre a versão mais recente deste arquivo,
 * portanto basta atualizar o GitHub para que as duas versões fiquem iguais.
 */
const BICA_FRONTEND_URL = 'https://raw.githubusercontent.com/catarinamaia-codigom/UBS-corrego-da-bica-DEMO-01/main/index.html';

/** Endereço público do app no GitHub Pages (usado apenas em mensagens e no link de fallback). */
const BICA_GITHUB_PAGES_URL = 'https://catarinamaia-codigom.github.io/UBS-corrego-da-bica-DEMO-01/';

/**
 * OPCIONAL. Deixe vazio quando o script foi criado pela própria planilha (recomendado).
 * Preencha somente se usar um projeto Apps Script independente. Não publique este valor no GitHub
 * enquanto a planilha estiver compartilhada como "qualquer pessoa com o link".
 */
const BICA_PLANILHA_ID = '';

/** Média de moradores por casa usada nas estimativas. Pode ser alterada na aba Parametros (MEDIA_MORADORES_CASA). */
const BICA_MEDIA_MORADORES_PADRAO = 3;

/** Duração da sessão após o login (horas). */
// Casas criadas até este momento, com ACS e pela coordenação, vieram do cadastro dos tablets das ACS (importação em massa).
// Pode ser ajustado na aba Parametros (CORTE_CADASTRO_ACS).
const BICA_CORTE_CADASTRO_ACS = '2026-11-12T00:00:00-03:00';
const BICA_SESSAO_HORAS = 12;

/** Limites da região do Recife para validar coordenadas confirmadas. */
const BICA_GEO_LIMITES = {latMin: -8.2, latMax: -7.8, lonMin: -35.2, lonMax: -34.6};

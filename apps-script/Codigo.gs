/**
 * BICA — Pesquisa Territorial 1.0 · Servidor (Google Apps Script + Google Sheets)
 *
 * Instalação (uma vez, pela conta dona da planilha):
 *   1. Abra a planilha mãe > Extensões > Apps Script e cole Config.gs, Schema.gs e Codigo.gs.
 *   2. Execute configurarBica() e autorize. As abas que faltarem são criadas; nada é apagado.
 *      Os logins e senhas iniciais ficam na aba Acessos (podem ser alterados direto na planilha).
 *   3. Implantar > Nova implantação > App da Web · Executar como: Eu · Quem pode acessar: Qualquer pessoa.
 *   4. Cole a URL /exec na constante BICA_API_URL do index.html no GitHub.
 *
 * Toda a validação e o controle de acesso acontecem aqui, no servidor. O navegador nunca recebe
 * senhas, o link da planilha (exceto coordenação) nem dados identificáveis de outros perfis.
 */

const BICA_PROP = 'BICA_DB_V1';
const BICA_SECRET_PROP = 'BICA_SECRET_V1';
var BICA_DB_CACHE = null;
var BICA_HEAD_CACHE = {};
var BICA_ROWS_CACHE = {};

/* ============================== ENTRADAS ============================== */

/** Abre o app pelo Apps Script exibindo exatamente o index.html publicado no GitHub. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.api === 'ping') return bicaJsonOut_({ok: true, data: bicaPing_()});
  let out = null;
  try { out = HtmlService.createHtmlOutput(bicaFrontendHtml_()); } catch (err) { console.warn('Interface do GitHub indisponível: ' + err); }
  if (!out) {
    try { out = HtmlService.createHtmlOutputFromFile('Index'); } catch (err2) {
      out = HtmlService.createHtmlOutput('<div style="font:15px system-ui;padding:40px;max-width:560px"><h2>BICA · Pesquisa Territorial</h2><p>Não foi possível carregar a interface a partir do GitHub agora. Tente novamente em instantes ou abra a versão publicada:</p><p><a target="_blank" href="' + BICA_GITHUB_PAGES_URL + '">' + BICA_GITHUB_PAGES_URL + '</a></p></div>');
    }
  }
  return out.setTitle('BICA | Pesquisa Territorial').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** API usada pela versão do GitHub Pages (fetch POST com corpo JSON em text/plain). */
function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return bicaJsonOut_({ok: false, error: 'Requisição inválida.'}); }
  return bicaJsonOut_(bicaApi(req));
}

/** API usada pela versão aberta dentro do Apps Script (google.script.run.bicaApi). */
function bicaApi(req) {
  try {
    const data = bicaRoute_(req || {});
    return JSON.parse(JSON.stringify({ok: true, data: data}));
  } catch (err) {
    console.warn((req && req.op) + ' → ' + (err && err.stack || err));
    return {ok: false, error: String(err && err.message || err)};
  }
}

function bicaJsonOut_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function bicaFrontendHtml_() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('bica_front_n') || 0);
  if (n > 0) {
    const keys = Array.from({length: n}, (_, i) => 'bica_front_' + i), parts = cache.getAll(keys);
    if (keys.every(k => parts[k] != null)) return keys.map(k => parts[k]).join('');
  }
  const res = UrlFetchApp.fetch(BICA_FRONTEND_URL + '?v=' + Math.floor(Date.now() / 300000), {muteHttpExceptions: true, followRedirects: true});
  if (res.getResponseCode() !== 200) throw new Error('GitHub respondeu ' + res.getResponseCode());
  const html = res.getContentText('UTF-8');
  bicaAssert_(/<html/i.test(html), 'Conteúdo inesperado recebido do GitHub.');
  const size = 45000, chunks = {};
  let count = 0;
  for (let i = 0; i < html.length; i += size) chunks['bica_front_' + (count++)] = html.slice(i, i + size);
  chunks.bica_front_n = String(count);
  try { cache.putAll(chunks, 300); } catch (err) { /* cache é opcional */ }
  return html;
}

/** Execute no editor para forçar o Apps Script a buscar agora a versão mais nova do GitHub. */
function atualizarInterfaceBica() {
  const cache = CacheService.getScriptCache();
  const keys = ['bica_front_n'].concat(Array.from({length: 40}, (_, i) => 'bica_front_' + i));
  cache.removeAll(keys);
  const html = bicaFrontendHtml_();
  console.log('Interface atualizada a partir do GitHub (' + html.length + ' caracteres).');
  return html.length;
}

/* ============================== UTILITÁRIOS ============================== */

function bicaNow_() { return Utilities.formatDate(new Date(), 'America/Recife', "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function bicaId_(prefix) { return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase(); }
function bicaClean_(x, max) { return String(x === null || x === undefined ? '' : x).trim().replace(/\s+/g, ' ').slice(0, max || 500); }
function bicaCanon_(s) { return bicaClean_(s, 250).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }
function bicaJson_(v) { try { const o = JSON.parse(String(v || '{}')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function bicaAssert_(value, message) { if (!value) throw new Error(message); }
function bicaLock_(fn) { const l = LockService.getScriptLock(); l.waitLock(28000); try { return fn(); } finally { l.releaseLock(); } }
function bicaTrue_(v) { if (v === true) return true; const s = String(v === null || v === undefined ? '' : v).trim().toLowerCase(); return s === 'true' || s === 'verdadeiro' || s === 'sim' || s === '1'; }
function bicaNum_(v) { if (v === '' || v === null || v === undefined) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; }
function bicaVal_(v) { return v instanceof Date ? (isNaN(v.getTime()) ? '' : Utilities.formatDate(v, 'America/Recife', "yyyy-MM-dd'T'HH:mm:ssXXX")) : v; }
function bicaStr_(v) { return v === null || v === undefined ? '' : String(v); }
function bicaIntOrNull_(v, min, max, message) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  bicaAssert_(Number.isInteger(n) && n >= min && n <= max, message);
  return n;
}
function bicaSecret_() {
  const s = PropertiesService.getScriptProperties().getProperty(BICA_SECRET_PROP);
  bicaAssert_(s, 'O servidor ainda não foi configurado. A coordenação deve executar configurarBica() no editor do Apps Script.');
  return s;
}
function bicaDigest_(text) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)).replace(/=+$/, ''); }
function bicaHmac_(text) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, bicaSecret_(), Utilities.Charset.UTF_8)).replace(/=+$/, ''); }
function bicaEqual_(a, b) { a = String(a); b = String(b); let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return !diff; }
function bicaNewPassword_() { const digits = String(Math.floor(100000 + Math.random() * 900000)); return 'Bica' + digits; }
/** Evita que textos digitados virem fórmulas na planilha. */
function bicaCell_(v) { if (v === null || v === undefined) return ''; if (typeof v === 'number' || typeof v === 'boolean') return v; const s = String(v); return /^[=+@-]/.test(s) ? "'" + s : s; }
function bicaColLetter_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/* ============================== PLANILHA ============================== */

function bicaDb_() {
  if (BICA_DB_CACHE) return BICA_DB_CACHE;
  const id = PropertiesService.getScriptProperties().getProperty(BICA_PROP) || BICA_PLANILHA_ID;
  if (id) { BICA_DB_CACHE = SpreadsheetApp.openById(id); return BICA_DB_CACHE; }
  let active = null;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { active = null; }
  bicaAssert_(active, 'Planilha não conectada. Abra o Apps Script pela planilha (Extensões > Apps Script) e execute configurarBica().');
  BICA_DB_CACHE = active;
  return active;
}
function bicaSheet_(name) {
  const s = bicaDb_().getSheetByName(name);
  bicaAssert_(s, 'A aba ' + name + ' não existe na planilha. A coordenação deve executar configurarBica() no editor.');
  return s;
}
function bicaHeads_(name) {
  if (BICA_HEAD_CACHE[name]) return BICA_HEAD_CACHE[name];
  const s = bicaSheet_(name), lastCol = s.getLastColumn();
  const heads = lastCol ? s.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim()) : [];
  BICA_HEAD_CACHE[name] = heads;
  return heads;
}
/** Lê uma aba como lista de objetos, pelo nome das colunas. Resultado é somente leitura (cache por execução). */
function bicaRows_(name) {
  if (BICA_ROWS_CACHE[name]) return BICA_ROWS_CACHE[name];
  const s = bicaSheet_(name), heads = bicaHeads_(name), last = s.getLastRow();
  const rows = [];
  if (last >= 2 && heads.length) {
    const values = s.getRange(2, 1, last - 1, heads.length).getValues();
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      if (!r.some(x => x !== '' && x !== null)) continue;
      const o = {_row: i + 2};
      for (let j = 0; j < heads.length; j++) if (heads[j]) o[heads[j]] = bicaVal_(r[j]);
      rows.push(o);
    }
  }
  BICA_ROWS_CACHE[name] = rows;
  return rows;
}
/** Lê somente as últimas linhas de uma aba (usado na Auditoria, que cresce a cada login). */
function bicaTail_(name, n) {
  const s = bicaSheet_(name), heads = bicaHeads_(name), last = s.getLastRow();
  if (last < 2 || !heads.length) return [];
  const start = Math.max(2, last - n + 1);
  return s.getRange(start, 1, last - start + 1, heads.length).getValues().map(r => { const o = {}; heads.forEach((h, j) => { if (h) o[h] = bicaVal_(r[j]); }); return o; });
}
function bicaAppend_(name, objects) {
  const arr = Array.isArray(objects) ? objects : [objects];
  if (!arr.length) return;
  const s = bicaSheet_(name), heads = bicaHeads_(name);
  const missing = (BICA_SHEETS[name] || []).filter(h => heads.indexOf(h) < 0);
  bicaAssert_(!missing.length, 'A aba ' + name + ' não tem as colunas ' + missing.join(', ') + '. Execute configurarBica() no editor.');
  const values = arr.map(o => heads.map(h => bicaCell_(o[h])));
  const row = s.getLastRow() + 1;
  if (row + values.length - 1 > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), Math.max(100, row + values.length - 1 - s.getMaxRows()));
  s.getRange(row, 1, values.length, heads.length).setValues(values);
  const cached = BICA_ROWS_CACHE[name];
  if (cached) arr.forEach((o, i) => { const copy = {_row: row + i}; heads.forEach(h => { if (h) copy[h] = o[h] === undefined || o[h] === null ? '' : o[h]; }); cached.push(copy); });
}
function bicaSetRow_(name, idField, id, patch) {
  const s = bicaSheet_(name), heads = bicaHeads_(name);
  const hit = bicaRows_(name).find(r => String(r[idField]) === String(id));
  bicaAssert_(hit, 'Registro não localizado em ' + name + ': ' + id);
  const range = s.getRange(hit._row, 1, 1, heads.length), r = range.getValues()[0];
  Object.keys(patch).forEach(k => { const i = heads.indexOf(k); if (i >= 0) { r[i] = bicaCell_(patch[k]); hit[k] = patch[k] === null || patch[k] === undefined ? '' : patch[k]; } });
  range.setValues([r]);
}
function bicaParam_(key) { const r = bicaRows_('Parametros').find(x => String(x.chave) === key); return r ? bicaStr_(r.valor) : ''; }
function bicaSetParam_(key, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (bicaRows_('Parametros').some(x => String(x.chave) === key)) bicaSetRow_('Parametros', 'chave', key, {valor: text, atualizado_em: bicaNow_()});
  else bicaAppend_('Parametros', {chave: key, valor: text, atualizado_em: bicaNow_()});
}
function bicaAvg_() { const n = bicaNum_(bicaParam_('MEDIA_MORADORES_CASA')); return n && n > 0 && n <= 20 ? n : BICA_MEDIA_MORADORES_PADRAO; }
function bicaAudit_(actor, action, entity, id, details) {
  bicaAppend_('Auditoria', {id: bicaId_('AUD'), momento: bicaNow_(), ator_id: (actor && actor.id) || 'SISTEMA', acao: action, entidade: entity, entidade_id: id, detalhes_json: JSON.stringify(details || {}).slice(0, 2000)});
}

/* ============================== INSTALAÇÃO ============================== */

/**
 * Conecta este script à planilha mãe e prepara a estrutura. Pode ser executada mais de uma vez:
 * nunca apaga dados; somente cria abas/colunas ausentes e acessos iniciais (se a aba Acessos estiver vazia).
 */
function configurarBica() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss && BICA_PLANILHA_ID) ss = SpreadsheetApp.openById(BICA_PLANILHA_ID);
  if (!ss && props.getProperty(BICA_PROP)) ss = SpreadsheetApp.openById(props.getProperty(BICA_PROP));
  bicaAssert_(ss, 'Crie este Apps Script pela própria planilha (Extensões > Apps Script) ou preencha BICA_PLANILHA_ID em Config.gs.');
  return bicaLock_(function () {
    props.setProperty(BICA_PROP, ss.getId());
    if (!props.getProperty(BICA_SECRET_PROP)) props.setProperty(BICA_SECRET_PROP, Utilities.getUuid() + Utilities.getUuid());
    BICA_DB_CACHE = ss; BICA_HEAD_CACHE = {}; BICA_ROWS_CACHE = {};
    const schema = bicaEnsureSchema_(ss);
    const now = bicaNow_();
    const defaults = {ETAPA: 'PREPARACAO', MEDIA_MORADORES_CASA: String(BICA_MEDIA_MORADORES_PADRAO)};
    Object.keys(defaults).forEach(k => { if (!bicaRows_('Parametros').some(r => String(r.chave) === k)) bicaAppend_('Parametros', {chave: k, valor: defaults[k], atualizado_em: now}); });
    bicaSetParam_('VERSAO_BANCO', '2.0');
    if (!bicaRows_('Blocos').length) bicaAppend_('Blocos', {id: 'BL-001', nome: 'Bloco 01 · Acesso e cuidado no território', versao: 1, config_json: JSON.stringify(bicaDefaultConfig_()), ativo: true, criado_em: now, atualizado_em: now});
    bicaRows_('Blocos').forEach(b => {
      if (!bicaRows_('Termos').some(t => String(t.bloco_id) === String(b.id))) bicaAppend_('Termos', {id: bicaId_('TERMO'), bloco_id: b.id, versao: '1', texto_completo: BICA_TERMO_INICIAL, criado_em: now, criado_por: 'SISTEMA', ativo: true});
      if (!bicaRows_('Config_PDF').some(c => String(c.bloco_id) === String(b.id))) bicaAppend_('Config_PDF', {bloco_id: b.id, campos_json: JSON.stringify(BICA_PDF_DEFAULT), atualizado_em: now, alterado_por: 'SISTEMA'});
    });
    let issued = [];
    if (!bicaRows_('Acessos').length) {
      const staff = [['Coordenação', 'coordenacao', 'coordenacao']];
      for (let i = 1; i <= 7; i++) staff.push(['Entrevistador ' + i, 'coleta', 'entrevistador' + i]);
      issued = staff.map(x => ({id: bicaId_('ACE'), identificacao: x[0], perfil: x[1], login: x[2], senha: bicaNewPassword_(), ativo: true, criado_em: now, revogado_em: ''}));
      bicaAppend_('Acessos', issued);
    }
    if (!bicaRows_('Instrucoes').length) bicaAppend_('Instrucoes', [
      {item: 'UNIDADE', descricao: BICA_TITLE},
      {item: 'ACESSOS', descricao: 'Logins e senhas ficam na aba Acessos e podem ser alterados aqui pela coordenação (perfil: coordenacao ou coleta; ativo: TRUE/FALSE). Alterar a senha encerra as sessões abertas daquele acesso.'},
      {item: 'SIGILO', descricao: 'Mantenha esta planilha com compartilhamento RESTRITO. O app funciona mesmo assim, pois o Apps Script roda com a conta da coordenação.'},
      {item: 'COLETA', descricao: 'Bloco → rua → domicílio → pessoa → entrevista. Cada visita é uma tentativa; pessoas ausentes ficam pendentes para nova visita.'},
      {item: 'SITUAÇÕES', descricao: 'CONCORDOU abre o questionário; RECUSOU, NAO_SABE (não sabe/não consegue responder) e AUSENTE são registradas na aba Participacoes.'},
      {item: 'MORADORES', descricao: 'Casas sem número de moradores informado usam a média do parâmetro MEDIA_MORADORES_CASA (padrão 3) nas estimativas.'},
      {item: 'AUDITORIA', descricao: 'Não apague linhas para corrigir dados; utilize as funções do app. Todas as alterações ficam na aba Auditoria.'},
      {item: 'TREINAMENTO', descricao: 'Com ETAPA = PREPARACAO as entrevistas recebem origem TREINAMENTO. Use OPERACAO somente após validar o termo de consentimento.'},
      {item: 'MAPA', descricao: 'O mapa mostra apenas casas com localização confirmada. Polígonos são exploratórios; não são limites oficiais.'}
    ]);
    bicaRewriteDictionary_();
    bicaWriteSummary_();
    SpreadsheetApp.flush();
    console.log('=== BICA conectada à planilha: ' + ss.getUrl());
    if (schema.created.length) console.log('Abas criadas: ' + schema.created.join(', '));
    if (schema.extended.length) console.log('Colunas acrescentadas: ' + schema.extended.join(' | '));
    if (issued.length) {
      console.log('=== ACESSOS INICIAIS (também gravados na aba Acessos) ===');
      issued.forEach(x => console.log(x.identificacao + ' [' + x.perfil + '] | login: ' + x.login + ' | senha: ' + x.senha));
    } else console.log('A aba Acessos já tinha registros; nenhum login novo foi criado.');
    return {planilha: ss.getUrl(), abasCriadas: schema.created, colunasAcrescentadas: schema.extended, acessosCriados: issued.map(x => x.login)};
  });
}

function bicaEnsureSchema_(ss) {
  const created = [], extended = [];
  const first = ss.getSheets()[0];
  const keepFormat = ['ativo', 'ativa'];
  Object.keys(BICA_SHEETS).forEach(name => {
    const heads = BICA_SHEETS[name];
    let s = ss.getSheetByName(name), isNew = false;
    if (!s) { s = ss.insertSheet(name); created.push(name); isNew = true; }
    const lastCol = s.getLastColumn();
    let current = lastCol ? s.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim()) : [];
    while (current.length && !current[current.length - 1]) current.pop();
    const missing = heads.filter(h => current.indexOf(h) < 0);
    const startNew = current.length;
    if (missing.length) {
      s.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
      if (current.length) extended.push(name + ': ' + missing.join(', '));
      current = current.concat(missing);
    }
    s.getRange(1, 1, 1, current.length).setBackground('#145da4').setFontColor('#ffffff').setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
    s.setFrozenRows(1);
    if (name !== 'Resumo') {
      current.forEach((h, i) => {
        if (!isNew && i < startNew) return; // não altera formato de colunas que já existiam
        if (!h || BICA_NUMERIC_COLUMNS.indexOf(h) >= 0 || keepFormat.indexOf(h) >= 0) return;
        s.getRange(2, i + 1, Math.max(1, s.getMaxRows() - 1), 1).setNumberFormat('@');
      });
    }
    if (isNew) s.setColumnWidths(1, current.length, 150);
    if (BICA_SENSITIVE_SHEETS.indexOf(name) >= 0) s.setTabColor('#d09862');
    else if (['Resumo', 'Blocos', 'Ruas', 'Domicilios', 'Equipes', 'ACS'].indexOf(name) >= 0) s.setTabColor('#247b66');
  });
  if (first && !Object.prototype.hasOwnProperty.call(BICA_SHEETS, first.getName()) && first.getLastRow() === 0 && first.getLastColumn() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  BICA_HEAD_CACHE = {}; BICA_ROWS_CACHE = {};
  return {created, extended};
}

function bicaRewriteDictionary_() {
  const s = bicaSheet_('Dicionario'), heads = bicaHeads_('Dicionario');
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, heads.length).clearContent();
  delete BICA_ROWS_CACHE.Dicionario;
  bicaAppend_('Dicionario', bicaQuestions_().map(q => ({pergunta_id: q.id, grupo: q.group, pergunta: q.label, tipo: q.type, opcoes_json: JSON.stringify(q.options || []), origem: q.origin, observacao: q.note || (q.depends ? 'Exibida somente se ' + q.depends.field + ' = ' + q.depends.values.join(' ou ') : '')})));
}

function bicaWriteSummary_() {
  const s = bicaSheet_('Resumo');
  if (s.getLastRow() > 1) return; // preserva ajustes feitos pela coordenação
  const col = (sheet, h) => { const i = bicaHeads_(sheet).indexOf(h) + 1; return sheet + '!' + bicaColLetter_(i) + '2:' + bicaColLetter_(i); };
  const media = 'IFERROR(VALUE(VLOOKUP("MEDIA_MORADORES_CASA",Parametros!A:B,2,FALSE)),3)';
  const rows = [
    ['Entrevistas', '=COUNTA(' + col('Entrevistas', 'id') + ')', 'Registros de entrevista (uma pessoa pode ter mais de uma em blocos diferentes)'],
    ['Domicílios cadastrados', '=COUNTA(' + col('Domicilios', 'id') + ')', 'Inclui casas ainda não entrevistadas'],
    ['Moradores informados', '=SUM(' + col('Domicilios', 'moradores_declarados') + ')', 'Soma dos números informados por casa'],
    ['Moradores estimados', '=SUM(' + col('Domicilios', 'moradores_declarados') + ')+' + media + '*COUNTIFS(' + col('Domicilios', 'id') + ',"<>",' + col('Domicilios', 'moradores_declarados') + ',"")', 'Informados + média por casa sem informação (parâmetro MEDIA_MORADORES_CASA)'],
    ['Pessoas cadastradas', '=COUNTA(' + col('Pessoas', 'id') + ')', 'Pessoas com identificador único'],
    ['Ruas ativas', '=COUNTIFS(' + col('Ruas', 'id') + ',"<>",' + col('Ruas', 'status') + ',"<>FUNDIDA")', 'Não inclui ruas redirecionadas por fusão'],
    ['Tentativas (visitas)', '=COUNTA(' + col('Visitas', 'id') + ')', 'Cada envio do app conta uma tentativa, inclusive casa fechada'],
    ['Pessoas ausentes registradas', '=COUNTIF(' + col('Participacoes', 'situacao') + ',"AUSENTE")', 'Registros de ausência (podem ser revisitadas)'],
    ['Não sabe responder', '=COUNTIF(' + col('Participacoes', 'situacao') + ',"NAO_SABE")', 'Pessoas que não souberam/conseguiram responder'],
    ['Recusas', '=COUNTIF(' + col('Participacoes', 'situacao') + ',"RECUSOU")', 'Pessoas que não concordaram'],
    ['Consentimentos registrados', '=COUNTA(' + col('Consentimentos', 'id') + ')', 'Um por entrevista']
  ];
  s.getRange(2, 1, rows.length, 3).setValues(rows.map(r => [r[0], '', r[2]]));
  s.getRange(2, 2, rows.length, 1).setFormulas(rows.map(r => [r[1]]));
  s.setColumnWidth(1, 220); s.setColumnWidth(2, 120); s.setColumnWidth(3, 470);
  delete BICA_ROWS_CACHE.Resumo;
}

/** Somente leitura: confirma a conexão sem criar nem alterar registros. */
function verificarBica() {
  const db = bicaDb_();
  const info = {nome: BICA_TITLE, planilha: db.getUrl(), abas: db.getSheets().map(s => s.getName()), etapa: bicaParam_('ETAPA'), ruas: bicaRows_('Ruas').length, domicilios: bicaRows_('Domicilios').length, entrevistas: bicaRows_('Entrevistas').length, acessos: bicaRows_('Acessos').length, segredoConfigurado: !!PropertiesService.getScriptProperties().getProperty(BICA_SECRET_PROP)};
  console.log(JSON.stringify(info, null, 2));
  return info;
}

function bicaPing_() { return {name: BICA_TITLE, version: BICA_VERSAO, time: bicaNow_(), configured: !!PropertiesService.getScriptProperties().getProperty(BICA_SECRET_PROP)}; }

/* ============================== ACESSO ============================== */

function bicaRole_(perfil) { return bicaCanon_(perfil).indexOf('coord') === 0 ? 'coordenacao' : 'coleta'; }
function bicaCredHash_(a) { return bicaDigest_([a.id, String(a.login).trim().toLowerCase(), String(a.senha).trim(), bicaRole_(a.perfil), bicaSecret_()].join('|')); }

function bicaLogin_(data) {
  const login = bicaClean_(data.login, 120), senha = String(data.senha === null || data.senha === undefined ? '' : data.senha).trim();
  bicaAssert_(login && senha, 'Informe login e senha.');
  const cache = CacheService.getScriptCache(), key = 'bica_fail_' + bicaDigest_(login.toLowerCase()).slice(0, 24);
  const fails = Number(cache.get(key) || 0);
  bicaAssert_(fails < 8, 'Muitas tentativas sem sucesso para este login. Aguarde 15 minutos.');
  const a = bicaRows_('Acessos').find(x => bicaTrue_(x.ativo) && String(x.login).trim().toLowerCase() === login.toLowerCase() && bicaEqual_(String(x.senha).trim(), senha));
  if (!a) { cache.put(key, String(fails + 1), 900); throw new Error('Login ou senha inválidos.'); }
  cache.remove(key);
  const role = bicaRole_(a.perfil);
  const claim = {id: String(a.id), role: role, cred: bicaCredHash_(a), exp: Date.now() + BICA_SESSAO_HORAS * 3600 * 1000};
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(claim)).replace(/=+$/, '');
  bicaAudit_({id: a.id}, 'LOGIN', 'ACESSO', a.id, {});
  return {token: body + '.' + bicaHmac_(body), user: {id: String(a.id), name: String(a.identificacao), role: role}, expires: claim.exp};
}

function bicaAuth_(token) {
  const t = String(token || ''), parts = t.split('.');
  bicaAssert_(parts.length === 2 && t.length < 4000, 'Sessão ausente. Entre novamente.');
  bicaAssert_(bicaEqual_(parts[1], bicaHmac_(parts[0])), 'Sessão inválida. Entre novamente.');
  let claims;
  try {
    let b = parts[0]; while (b.length % 4) b += '=';
    claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString());
  } catch (e) { throw new Error('Sessão inválida. Entre novamente.'); }
  bicaAssert_(claims.exp > Date.now(), 'A sessão expirou. Entre novamente.');
  const a = bicaRows_('Acessos').find(x => String(x.id) === String(claims.id));
  bicaAssert_(a && bicaTrue_(a.ativo) && bicaEqual_(bicaCredHash_(a), claims.cred), 'Acesso revogado ou senha alterada. Entre novamente.');
  return {id: String(a.id), name: String(a.identificacao), role: bicaRole_(a.perfil)};
}

/* ============================== ROTEADOR ============================== */

function bicaRoute_(req) {
  const op = String(req.op || ''), data = req.data || {};
  if (op === 'ping') return bicaPing_();
  if (op === 'login') return bicaLogin_(data);
  const actor = bicaAuth_(req.token);
  const coord = () => bicaAssert_(actor.role === 'coordenacao', 'Operação exclusiva da coordenação.');
  const withState = r => { r = r || {}; r.ok = true; r.state = bicaSnapshot_(actor); return r; };
  switch (op) {
    case 'bootstrap': return {state: bicaSnapshot_(actor)};
    case 'saveVisit': return withState(bicaSaveVisit_(actor, data));
    case 'saveHouse': return withState(bicaSaveHouse_(actor, data));
    case 'addStreet': return withState(bicaAddStreet_(actor, data));
    case 'addRegistry': return withState(bicaAddRegistry_(actor, data));
    case 'renameRegistry': coord(); return withState(bicaRenameRegistry_(actor, data));
    case 'mergeRegistry': coord(); return withState(bicaMergeRegistry_(actor, data));
    case 'saveStreet': coord(); return withState(bicaSaveStreet_(actor, data));
    case 'mergeStreets': coord(); return withState(bicaMergeStreets_(actor, data));
    case 'newBlock': coord(); return withState(bicaNewBlock_(actor, data));
    case 'saveBlock': coord(); return withState(bicaSaveBlock_(actor, data));
    case 'addQuestion': coord(); return withState(bicaAddQuestion_(actor, data));
    case 'updateQuestion': coord(); return withState(bicaUpdateQuestion_(actor, data));
    case 'saveTerm': coord(); return withState(bicaSaveTerm_(actor, data));
    case 'savePdfConfig': coord(); return withState(bicaSavePdfConfig_(actor, data));
    case 'setStage': coord(); return withState(bicaSetStage_(actor, data));
    case 'newAccess': coord(); return withState(bicaNewAccess_(actor, data));
    case 'setAccessActive': coord(); return withState(bicaSetAccessActive_(actor, data));
    case 'resetPassword': coord(); return withState(bicaResetPassword_(actor, data));
    case 'geoSuggest': coord(); return bicaGeoSuggest_(actor, data);
    case 'addFeedback': return withState(bicaAddFeedback_(actor, data));
    case 'setFeedbackStatus': coord(); return withState(bicaSetFeedbackStatus_(actor, data));
    default: throw new Error('Operação não reconhecida: ' + op);
  }
}

/* ============================== LEITURA (SNAPSHOT) ============================== */

function bicaCanonStreet_(id, streets) {
  const by = {};
  streets.forEach(x => { by[String(x.id)] = x; });
  let cur = by[String(id)];
  const seen = {};
  while (cur && String(cur.status).toUpperCase() === 'FUNDIDA' && cur.fundida_em && !seen[cur.id]) { seen[cur.id] = true; cur = by[String(cur.fundida_em)]; }
  return cur ? {id: String(cur.id), name: String(cur.nome), status: String(cur.status || 'ATIVA').toUpperCase(), row: cur} : null;
}
function bicaResolveRegistry_(tipo, id, merges) {
  id = bicaStr_(id);
  if (!id) return '';
  const redirect = {};
  (merges || bicaRows_('Fusoes_Cadastros')).forEach(x => { if (String(x.tipo).toUpperCase() === tipo) redirect[String(x.origem_id)] = String(x.principal_id); });
  const seen = {};
  while (redirect[id] && !seen[id]) { seen[id] = true; id = redirect[id]; }
  return id;
}
function bicaRegistryTable_(tipo) { tipo = String(tipo || '').toUpperCase(); bicaAssert_(tipo === 'EQUIPE' || tipo === 'ACS', 'Tipo de cadastro inválido.'); return tipo === 'EQUIPE' ? 'Equipes' : 'ACS'; }
/** Valida uma equipe/ACS escolhida. Retorna '' (sem vínculo) ou o ID principal ativo. */
function bicaCheckRegistry_(tipo, id) {
  id = bicaStr_(id).trim();
  if (!id) return '';
  const table = bicaRegistryTable_(tipo), main = bicaResolveRegistry_(tipo, id);
  bicaAssert_(bicaRows_(table).some(x => String(x.id) === main && bicaTrue_(x.ativa)), (tipo === 'ACS' ? 'ACS' : 'Equipe') + ' selecionada não existe ou foi desativada. Atualize a página.');
  return main;
}
function bicaNormConfig_(raw) {
  const d = bicaDefaultConfig_(), src = raw || {};
  const mods = src.modules || src.module || {}, qs = src.questions || src.question || {};
  Object.keys(d.modules).forEach(k => { if (typeof mods[k] === 'boolean') d.modules[k] = mods[k]; });
  Object.keys(d.questions).forEach(k => { if (typeof qs[k] === 'boolean') d.questions[k] = qs[k]; });
  return d;
}

/** Resumo por domicílio e bloco: situação, tentativas, entrevistas e ausências. */
function bicaHouseSummaries_(houses, persons, visits, parts, ints) {
  const personsByHouse = {}, visitInfo = {}, intCount = {}, lastPart = {}, houseOut = {}, personOut = {};
  persons.forEach(p => { (personsByHouse[String(p.domicilio_id)] = personsByHouse[String(p.domicilio_id)] || []).push(p); });
  visits.forEach(v => {
    const k = v.bloco_id + '|' + v.domicilio_id, cur = visitInfo[k] || (visitInfo[k] = {n: 0, closed: 0, last: ''});
    cur.n++;
    const st = String(v.situacao).toUpperCase();
    if (st === 'AUSENTE' || st === 'FECHADA') cur.closed++;
    if (String(v.momento) > cur.last) cur.last = String(v.momento);
  });
  ints.forEach(i => { const k = i.bloco_id + '|' + i.pessoa_id; intCount[k] = (intCount[k] || 0) + 1; });
  parts.forEach(p => { const k = p.bloco_id + '|' + p.pessoa_id; if (!lastPart[k] || String(p.momento) >= String(lastPart[k].momento)) lastPart[k] = p; });
  const blockIds = {};
  visits.forEach(v => { blockIds[String(v.bloco_id)] = true; });
  ints.forEach(i => { blockIds[String(i.bloco_id)] = true; });
  houses.forEach(h => {
    const hid = String(h.id), declared = bicaNum_(h.moradores_declarados), ps = personsByHouse[hid] || [];
    const out = {};
    Object.keys(blockIds).forEach(b => {
      const vi = visitInfo[b + '|' + hid];
      let involved = 0, interviews = 0, absent = 0, refused = 0, unable = 0, anyInt = false, anyDone = false;
      ps.forEach(p => {
        const k = b + '|' + p.id, ic = intCount[k] || 0, lp = lastPart[k], last = lp ? String(lp.situacao).toUpperCase() : '';
        if (ic || last) {
          (personOut[String(p.id)] = personOut[String(p.id)] || {})[b] = {interviews: ic, last: last, at: lp ? String(lp.momento) : ''};
        }
        if (!ic && !last) return;
        involved++; interviews += ic;
        if (ic > 0) { anyInt = true; anyDone = true; }
        else if (last === 'AUSENTE') absent++;
        else if (last === 'RECUSOU') { refused++; anyDone = true; }
        else if (last === 'NAO_SABE') { unable++; anyDone = true; }
        else anyDone = true;
      });
      if (!vi && !involved) return;
      let status;
      if (!involved) status = 'AUSENTE';
      else if (absent) status = anyDone ? 'PARCIAL' : 'AUSENTE';
      else if (anyInt) status = declared !== null && declared > involved ? 'PARCIAL' : 'CONCLUIDA';
      else status = refused ? 'RECUSA' : 'CONCLUIDA';
      out[b] = {status: status, visits: vi ? vi.n : 0, closed: vi ? vi.closed : 0, interviews: interviews, absent: absent, refused: refused, unable: unable, persons: involved, last: vi ? vi.last : ''};
    });
    houseOut[hid] = out;
  });
  return {houses: houseOut, persons: personOut};
}

function bicaSnapshot_(actor) {
  const coord = actor.role === 'coordenacao';
  const streetsRaw = bicaRows_('Ruas'), aliasRows = bicaRows_('Apelidos_Ruas'), merges = bicaRows_('Fusoes_Cadastros');
  const housesRaw = bicaRows_('Domicilios'), personsRaw = bicaRows_('Pessoas'), visits = bicaRows_('Visitas'), parts = bicaRows_('Participacoes'), ints = bicaRows_('Entrevistas');
  const termsRaw = bicaRows_('Termos');
  const blocks = bicaRows_('Blocos').filter(b => bicaTrue_(b.ativo)).map(b => ({id: String(b.id), name: String(b.nome || b.id), version: Number(b.versao) || 1, config: bicaNormConfig_(bicaJson_(b.config_json)), updated: bicaStr_(b.atualizado_em)}));
  const streets = streetsRaw.map(s => ({id: String(s.id), name: String(s.nome), status: String(s.status || 'ATIVA').toUpperCase(), mergedInto: bicaStr_(s.fundida_em), homes: bicaNum_(s.casas_previstas), residents: bicaNum_(s.moradores_previstos), source: bicaStr_(s.fonte_estimativa), createdBy: bicaStr_(s.criado_por), createdAt: bicaStr_(s.criado_em), aliases: aliasRows.filter(a => String(a.rua_id) === String(s.id)).map(a => String(a.apelido))}));
  const registry = (table, tipo) => bicaRows_(table).filter(x => bicaTrue_(x.ativa)).map(x => ({id: String(x.id), name: String(x.nome)}));
  const teams = registry('Equipes', 'EQUIPE'), acs = registry('ACS', 'ACS');
  const summary = bicaHouseSummaries_(housesRaw, personsRaw, visits, parts, ints);
  const houseById = {}, personById = {}, streetOf = {};
  const houses = housesRaw.map(h => {
    houseById[String(h.id)] = h;
    const st = bicaCanonStreet_(h.rua_id, streetsRaw), confirmed = String(h.geo_status) === 'confirmado';
    streetOf[String(h.id)] = st ? st.id : String(h.rua_id);
    return {id: String(h.id), street_id: st ? st.id : String(h.rua_id), number: bicaStr_(h.numero), complement: bicaStr_(h.complemento), declared: bicaNum_(h.moradores_declarados), team_id: bicaResolveRegistry_('EQUIPE', h.equipe_id, merges), acs_id: bicaResolveRegistry_('ACS', h.acs_id, merges), lat: confirmed ? bicaNum_(h.latitude) : null, lon: confirmed ? bicaNum_(h.longitude) : null, geo_status: bicaStr_(h.geo_status) || 'nao_localizado', created_at: bicaStr_(h.criado_em), updated_at: bicaStr_(h.atualizado_em), blocks: summary.houses[String(h.id)] || {}};
  });
  const persons = personsRaw.map(p => { personById[String(p.id)] = p; return {id: String(p.id), house_id: String(p.domicilio_id), sex: bicaStr_(p.sexo), age: bicaNum_(p.idade_referida), relationship: bicaStr_(p.parentesco), name: coord ? bicaStr_(p.nome_opcional) : '', blocks: summary.persons[String(p.id)] || {}}; });
  const textQ = bicaQuestions_().filter(q => q.type === 'text').map(q => q.id);
  const consById = {}, accName = {};
  if (coord) {
    bicaRows_('Consentimentos').forEach(c => { consById[String(c.id)] = c; });
    bicaRows_('Acessos').forEach(a => { accName[String(a.id)] = String(a.identificacao); });
  }
  const records = ints.map(i => {
    const h = houseById[String(i.domicilio_id)], p = personById[String(i.pessoa_id)], answers = bicaJson_(i.respostas_json);
    const base = {id: String(i.id), block_id: String(i.bloco_id), street_id: streetOf[String(i.domicilio_id)] || '', sex: p ? bicaStr_(p.sexo) : '', age: p && p.idade_referida !== '' ? Number(p.idade_referida) : '', created_at: bicaStr_(i.momento), source: bicaStr_(i.origem), edition: Number(i.edicao_questionario) || 1};
    if (!coord) { textQ.forEach(k => { delete answers[k]; }); base.answers = answers; return base; }
    const c = consById[String(i.consentimento_id)] || {};
    return Object.assign(base, {visit_id: String(i.visita_id), house_id: String(i.domicilio_id), person_id: String(i.pessoa_id), number: h ? bicaStr_(h.numero) : '', complement: h ? bicaStr_(h.complemento) : '', name: p ? bicaStr_(p.nome_opcional) : '', proxy: bicaStr_(i.informante) || 'propria', question_version: bicaStr_(i.versao_formulario), collector_id: bicaStr_(i.coletor_id), collector: accName[String(i.coletor_id)] || bicaStr_(i.coletor_id), answers: answers,
      consent: {id: bicaStr_(c.id), status: c.manifestacao ? 'Concordou' : 'Não localizado', modality: bicaStr_(c.modalidade), term_id: bicaStr_(c.termo_id), term_version: bicaStr_(c.termo_versao), created_at: bicaStr_(c.momento), note: bicaStr_(c.observacao)}});
  });
  const terms = {};
  termsRaw.filter(t => bicaTrue_(t.ativo)).forEach(t => { terms[String(t.bloco_id)] = {id: String(t.id), version: bicaStr_(t.versao), body: bicaStr_(t.texto_completo), updated: bicaStr_(t.criado_em)}; });
  const out = {questionEdition: bicaEdition_(), user: actor, title: BICA_TITLE, stage: bicaParam_('ETAPA') || 'PREPARACAO', avgResidents: bicaAvg_(), blocks, streets, teams, acs, houses, persons, records, terms, questions: bicaQuestions_(), modules: BICA_MODULES, serverTime: bicaNow_(), serverVersion: BICA_VERSAO};
  if (coord) {
    out.dbUrl = bicaDb_().getUrl();
    out.termsAll = {};
    termsRaw.forEach(t => { out.termsAll[String(t.id)] = {block: String(t.bloco_id), version: bicaStr_(t.versao), body: bicaStr_(t.texto_completo)}; });
    out.pdfConfigs = {};
    bicaRows_('Config_PDF').forEach(r => { const c = Object.assign({}, BICA_PDF_DEFAULT, bicaJson_(r.campos_json)); out.pdfConfigs[String(r.bloco_id)] = c; });
    out.staff = bicaRows_('Acessos').map(x => ({id: String(x.id), name: String(x.identificacao), role: bicaRole_(x.perfil), login: String(x.login), active: bicaTrue_(x.ativo), created: bicaStr_(x.criado_em)}));
    out.questionHistory = bicaDb_().getSheetByName('Historico_Questionario') ? bicaTail_('Historico_Questionario', 400).reverse().map(x => ({id: bicaStr_(x.id), at: bicaStr_(x.momento), actor: bicaStr_(x.ator_nome), edition: Number(x.edicao) || null, scope: bicaStr_(x.escopo), question: bicaStr_(x.pergunta_id), action: bicaStr_(x.acao), summary: bicaStr_(x.resumo)})) : [];
    out.feedback = bicaDb_().getSheetByName('Feedback') ? bicaTail_('Feedback', 300).reverse().map(x => ({id: bicaStr_(x.id), at: bicaStr_(x.momento), actor_id: bicaStr_(x.ator_id), actor: bicaStr_(x.ator_nome), role: bicaStr_(x.perfil), type: bicaStr_(x.tipo), text: bicaStr_(x.texto), page: bicaStr_(x.pagina), status: bicaStr_(x.status) || 'NOVO', resolved_at: bicaStr_(x.resolvido_em)})) : [];
    out.audit = bicaTail_('Auditoria', 40).reverse().map(x => ({at: bicaStr_(x.momento), actor: accName[String(x.ator_id)] || bicaStr_(x.ator_id), action: bicaStr_(x.acao), entity: bicaStr_(x.entidade), entity_id: bicaStr_(x.entidade_id), details: bicaStr_(x.detalhes_json).slice(0, 300)}));
  }
  return out;
}

/* ============================== COLETA ============================== */

function bicaAllowedAnswers_(input, config) {
  const ans = {};
  bicaQuestions_().forEach(q => {
    if (config.questions && config.questions[q.id] === false) return;
    if (q.type === 'text' && config.modules && config.modules.open === false) return;
    const val = input ? input[q.id] : undefined;
    if (val === undefined || val === null || val === '' || (Array.isArray(val) && !val.length)) return;
    if (q.depends) {
      const earlier = ans[q.depends.field];
      const matched = Array.isArray(earlier) ? earlier.some(x => q.depends.values.indexOf(x) >= 0) : q.depends.values.indexOf(earlier) >= 0;
      if (!matched) return;
    }
    // Visitas coletadas antes de uma mudança de tipo (ex.: sem internet) chegam no formato antigo: são aceitas.
    const allowed = (q.options || []).map(x => x[0]), was = t => (q.typeChanges || []).some(c => c.de === t);
    const codes = Array.isArray(val) ? val.map(String) : null;
    if (q.type === 'text') {
      if (codes && was('single') + was('multi') && codes.every(x => allowed.indexOf(x) >= 0)) { ans[q.id] = allowed.filter(x => codes.indexOf(x) >= 0); return; }
      ans[q.id] = bicaClean_(Array.isArray(val) ? val.join(', ') : val, 1000); return;
    }
    if (!codes && allowed.indexOf(val) < 0 && was('text') && typeof val === 'string') { ans[q.id] = bicaClean_(val, 1000); return; }
    if (q.type === 'multi') {
      const list = codes || [String(val)];
      bicaAssert_(list.every(x => allowed.indexOf(x) >= 0), 'Resposta inválida: ' + q.label);
      ans[q.id] = allowed.filter(x => list.indexOf(x) >= 0);
    } else if (codes) {
      bicaAssert_(codes.length && codes.every(x => allowed.indexOf(x) >= 0) && (codes.length === 1 || was('multi')), 'Resposta inválida: ' + q.label);
      ans[q.id] = codes.length === 1 ? codes[0] : allowed.filter(x => codes.indexOf(x) >= 0);
    } else {
      bicaAssert_(allowed.indexOf(val) >= 0, 'Resposta inválida: ' + q.label);
      ans[q.id] = val;
    }
  });
  return ans;
}

function bicaVisitStatus_(outcomes) {
  if (!outcomes.length) return 'AUSENTE';
  const has = s => outcomes.indexOf(s) >= 0;
  if (outcomes.every(o => o === 'AUSENTE')) return 'AUSENTE';
  if (has('AUSENTE')) return 'PARCIAL';
  if (has('CONCORDOU')) return 'CONCLUIDA';
  if (has('RECUSOU')) return 'RECUSA';
  return 'CONCLUIDA';
}

function bicaFindHouse_(streetId, number, comp, houses, streets, exceptId) {
  return houses.find(h => {
    if (exceptId && String(h.id) === String(exceptId)) return false;
    const s = bicaCanonStreet_(h.rua_id, streets);
    return s && s.id === streetId && bicaCanon_(h.numero) === bicaCanon_(number) && bicaCanon_(h.complemento) === bicaCanon_(comp);
  });
}

function bicaSaveVisit_(actor, a) {
  return bicaLock_(function () {
    const req = bicaClean_(a.request_id, 100);
    bicaAssert_(/^REQ-[A-Za-z0-9-]{10,100}$/.test(req), 'Identificador de envio inválido. Recarregue a página.');
    const prev = bicaRows_('Visitas').find(v => String(v.request_id) === req);
    if (prev) return {duplicate: true, visit_id: String(prev.id), house_id: String(prev.domicilio_id), status: String(prev.situacao), interviews: bicaRows_('Entrevistas').filter(i => String(i.visita_id) === String(prev.id)).length};
    const block = bicaRows_('Blocos').find(b => String(b.id) === String(a.block_id) && bicaTrue_(b.ativo));
    bicaAssert_(block, 'Bloco de pesquisa inválido ou inativo.');
    const cfg = bicaNormConfig_(bicaJson_(block.config_json)), catalog = bicaQuestions_(), curEd = bicaEdition_(), sentEd = Math.floor(Number(a.edition));
    const edition = sentEd >= 1 && sentEd <= curEd ? sentEd : curEd; // edição usada no aparelho (visitas offline)
    const streets = bicaRows_('Ruas'), street = bicaCanonStreet_(bicaStr_(a.street_id), streets);
    bicaAssert_(street, 'Selecione uma rua cadastrada.');
    const number = bicaClean_(a.number, 35), comp = bicaClean_(a.complement, 160);
    bicaAssert_(number, 'Informe o número da casa ou S/N.');
    const declared = bicaIntOrNull_(a.declared, 0, 80, 'Quantidade de moradores inválida (0 a 80).');
    const teamId = bicaCheckRegistry_('EQUIPE', a.team_id), acsId = bicaCheckRegistry_('ACS', a.acs_id);
    const closed = a.closed === true;
    const people = Array.isArray(a.people) ? a.people : [];
    bicaAssert_(people.length <= 15, 'Máximo de 15 pessoas por visita.');
    if (closed) bicaAssert_(!people.length, 'Casa fechada não pode conter pessoas.');
    else bicaAssert_(people.length > 0, 'Registre a situação de pelo menos uma pessoa ou use “Casa fechada”.');
    const stage = bicaParam_('ETAPA') || 'PREPARACAO', origin = stage === 'OPERACAO' ? 'PESQUISA' : 'TREINAMENTO';
    const activeTerms = bicaRows_('Termos').filter(t => String(t.bloco_id) === String(block.id) && bicaTrue_(t.ativo));
    const term = activeTerms[activeTerms.length - 1];
    const modes = ['registro_operador', 'assinatura_eletronica', 'registro_sonoro_referenciado'];
    const clean = people.map((item, idx) => {
      const label = ' (pessoa ' + (idx + 1) + ')';
      const outcome = String(item.outcome || '').toUpperCase();
      bicaAssert_(BICA_OUTCOMES.indexOf(outcome) >= 0, 'Defina a situação da pessoa ' + (idx + 1) + ': concordou, não concordou, não sabe responder ou ausente.');
      const age = bicaIntOrNull_(item.age, 0, 120, 'Idade inválida' + label + '.');
      const sex = String(item.sex || '');
      bicaAssert_(['', 'f', 'm', 'ni'].indexOf(sex) >= 0, 'Sexo inválido' + label + '.');
      const informant = String(item.proxy || 'propria');
      bicaAssert_(['propria', 'responsavel', 'outro'].indexOf(informant) >= 0, 'Informante inválido' + label + '.');
      const mode = String(item.consentMode || 'registro_operador');
      bicaAssert_(modes.indexOf(mode) >= 0, 'Modalidade de consentimento não reconhecida' + label + '.');
      let answers = {};
      if (outcome === 'CONCORDOU') {
        bicaAssert_(term, 'A coordenação precisa cadastrar um termo de consentimento para este bloco.');
        if (stage === 'OPERACAO') bicaAssert_(!/MINUTA PARA VALIDA/i.test(String(term.texto_completo)), 'A minuta inicial não pode ser usada na etapa de OPERAÇÃO. A coordenação deve cadastrar o termo validado.');
        answers = bicaAllowedAnswers_(item.answers || {}, cfg);
      }
      return {outcome, age, sex, informant, mode, answers, person_id: bicaClean_(item.person_id, 60), name: cfg.modules.name ? bicaClean_(item.name, 120) : '', relationship: bicaClean_(item.relationship, 60), consentNote: bicaClean_(item.consentNote, 250)};
    });
    const houses = bicaRows_('Domicilios'), persons = bicaRows_('Pessoas'), ints = bicaRows_('Entrevistas');
    let house = bicaFindHouse_(street.id, number, comp, houses, streets);
    const seen = {};
    clean.forEach(c => {
      if (!c.person_id) return;
      bicaAssert_(house, 'Moradores já cadastrados só podem ser usados na mesma casa. Recarregue a página.');
      bicaAssert_(!seen[c.person_id], 'Pessoa repetida na mesma visita.');
      seen[c.person_id] = true;
      c.existing = persons.find(x => String(x.id) === c.person_id && String(x.domicilio_id) === String(house.id));
      bicaAssert_(c.existing, 'Morador não localizado nesta casa. Recarregue a página.');
      if (c.outcome === 'CONCORDOU' && !cfg.modules.longitudinal) bicaAssert_(!ints.some(i => String(i.bloco_id) === String(block.id) && String(i.pessoa_id) === c.person_id), 'Uma das pessoas já foi entrevistada neste bloco (atualização longitudinal desativada).');
    });
    const now = bicaNow_();
    if (!house) {
      house = {id: bicaId_('DOM'), rua_id: street.id, numero: number, complemento: comp, moradores_declarados: declared === null ? '' : declared, equipe_id: teamId, acs_id: acsId, situacao: 'PENDENTE', latitude: '', longitude: '', geo_status: 'nao_localizado', criado_em: now, atualizado_em: now, criado_por: actor.id, atualizado_por: actor.id};
      bicaAppend_('Domicilios', house);
    } else {
      const patch = {atualizado_em: now, atualizado_por: actor.id};
      if (declared !== null) patch.moradores_declarados = declared;
      if (teamId) patch.equipe_id = teamId;
      if (acsId) patch.acs_id = acsId;
      bicaSetRow_('Domicilios', 'id', house.id, patch);
      house = Object.assign({}, house, patch);
    }
    const visit = {id: bicaId_('VIS'), request_id: req, bloco_id: block.id, domicilio_id: house.id, coletor_id: actor.id, situacao: closed ? 'AUSENTE' : bicaVisitStatus_(clean.map(c => c.outcome)), momento: now, moradores_informados: declared === null ? '' : declared, observacao: bicaClean_(a.note, 700), origem: origin};
    const newPersons = [], partRows = [], intRows = [], consRows = [], respRows = [], ids = [];
    clean.forEach(c => {
      let pid;
      if (c.existing) {
        pid = String(c.existing.id);
        const patch = {atualizado_em: now};
        if (c.sex) patch.sexo = c.sex;
        if (c.age !== null) patch.idade_referida = c.age;
        if (c.relationship) patch.parentesco = c.relationship;
        if (c.name) patch.nome_opcional = c.name;
        bicaSetRow_('Pessoas', 'id', pid, patch);
      } else {
        pid = bicaId_('PES');
        newPersons.push({id: pid, domicilio_id: house.id, nome_opcional: c.name, sexo: c.sex, idade_referida: c.age === null ? '' : c.age, parentesco: c.relationship, criado_em: now, atualizado_em: now});
      }
      partRows.push({id: bicaId_('PAR'), visita_id: visit.id, bloco_id: block.id, domicilio_id: house.id, pessoa_id: pid, situacao: c.outcome, momento: now, coletor_id: actor.id});
      if (c.outcome !== 'CONCORDOU') return;
      const intId = bicaId_('ENT'), consId = bicaId_('CNS');
      intRows.push({id: intId, visita_id: visit.id, bloco_id: block.id, domicilio_id: house.id, pessoa_id: pid, coletor_id: actor.id, momento: now, informante: c.informant, versao_formulario: block.id + '-v' + (Number(block.versao) || 1), consentimento_id: consId, respostas_json: JSON.stringify(c.answers), origem: origin, edicao_questionario: edition});
      consRows.push({id: consId, entrevista_id: intId, pessoa_id: pid, bloco_id: block.id, termo_id: term.id, termo_versao: term.versao, manifestacao: 'SIM', modalidade: c.mode, momento: now, coletor_id: actor.id, texto_termo_registrado: term.texto_completo, observacao: c.consentNote});
      Object.keys(c.answers).forEach(qid => {
        const q = catalog.find(x => x.id === qid), v = c.answers[qid];
        respRows.push({id: bicaId_('RSP'), entrevista_id: intId, bloco_id: block.id, domicilio_id: house.id, pessoa_id: pid, pergunta_id: qid, tipo: q.type, resposta_codificada: q.type === 'text' ? '' : (Array.isArray(v) ? v.join('|') : v), resposta_texto: q.type === 'text' ? v : '', momento: now});
      });
      ids.push({interview_id: intId, person_id: pid});
    });
    bicaAppend_('Visitas', visit);
    if (newPersons.length) bicaAppend_('Pessoas', newPersons);
    if (partRows.length) bicaAppend_('Participacoes', partRows);
    if (intRows.length) bicaAppend_('Entrevistas', intRows);
    if (consRows.length) bicaAppend_('Consentimentos', consRows);
    if (respRows.length) bicaAppend_('Respostas', respRows);
    const sum = bicaHouseSummaries_([house], bicaRows_('Pessoas'), bicaRows_('Visitas'), bicaRows_('Participacoes'), bicaRows_('Entrevistas'));
    const status = ((sum.houses[String(house.id)] || {})[String(block.id)] || {}).status || visit.situacao;
    bicaSetRow_('Domicilios', 'id', house.id, {situacao: status});
    bicaAudit_(actor, 'SALVAR_VISITA', 'DOMICILIO', house.id, {visit_id: visit.id, block_id: block.id, interviews: ids.length, outcomes: clean.map(c => c.outcome), closed: closed});
    return {house_id: String(house.id), visit_id: visit.id, interviews: ids.length, status: status, ids: ids};
  });
}

/* ============================== DOMICÍLIOS ============================== */

function bicaGeo_(lat, lon) {
  const la = Number(String(lat).replace(',', '.')), lo = Number(String(lon).replace(',', '.')), g = BICA_GEO_LIMITES;
  bicaAssert_(Number.isFinite(la) && Number.isFinite(lo) && la >= g.latMin && la <= g.latMax && lo >= g.lonMin && lo <= g.lonMax, 'Informe coordenadas válidas na região do Recife (ex.: -7.99, -34.93).');
  return {lat: Math.round(la * 1e6) / 1e6, lon: Math.round(lo * 1e6) / 1e6};
}

/** Cria ou edita um domicílio. Entrevistadores alteram moradores, equipe, ACS e localização; a coordenação altera tudo. */
function bicaSaveHouse_(actor, a) {
  const coord = actor.role === 'coordenacao';
  return bicaLock_(function () {
    const streets = bicaRows_('Ruas'), houses = bicaRows_('Domicilios'), now = bicaNow_();
    const declared = a.declared === undefined ? undefined : bicaIntOrNull_(a.declared, 0, 80, 'Quantidade de moradores inválida (0 a 80).');
    const teamId = a.team_id === undefined ? undefined : bicaCheckRegistry_('EQUIPE', a.team_id);
    const acsId = a.acs_id === undefined ? undefined : bicaCheckRegistry_('ACS', a.acs_id);
    const hasGeo = a.lat !== undefined && a.lat !== null && String(a.lat).trim() !== '';
    const geo = hasGeo ? bicaGeo_(a.lat, a.lon) : null;
    if (!a.id) {
      const street = bicaCanonStreet_(bicaStr_(a.street_id), streets);
      bicaAssert_(street, 'Selecione uma rua cadastrada.');
      const number = bicaClean_(a.number, 35), comp = bicaClean_(a.complement, 160);
      bicaAssert_(number, 'Informe o número da casa ou S/N.');
      bicaAssert_(!bicaFindHouse_(street.id, number, comp, houses, streets), 'Esta casa já está cadastrada nesta rua com o mesmo número e complemento. Use o botão Editar.');
      const row = {id: bicaId_('DOM'), rua_id: street.id, numero: number, complemento: comp, moradores_declarados: declared === null || declared === undefined ? '' : declared, equipe_id: teamId || '', acs_id: acsId || '', situacao: 'PENDENTE', latitude: geo ? geo.lat : '', longitude: geo ? geo.lon : '', geo_status: geo ? 'confirmado' : 'nao_localizado', criado_em: now, atualizado_em: now, criado_por: actor.id, atualizado_por: actor.id};
      bicaAppend_('Domicilios', row);
      bicaAudit_(actor, 'CADASTRAR_DOMICILIO', 'DOMICILIO', row.id, {rua_id: street.id, numero: number, complemento: comp, moradores: row.moradores_declarados, equipe_id: row.equipe_id, acs_id: row.acs_id});
      return {id: row.id, created: true};
    }
    const h = houses.find(x => String(x.id) === String(a.id));
    bicaAssert_(h, 'Domicílio não localizado. Atualize a página.');
    const patch = {atualizado_em: now, atualizado_por: actor.id}, before = {}, after = {};
    const set = (k, v) => { if (String(h[k] === undefined ? '' : h[k]) !== String(v)) { before[k] = h[k]; after[k] = v; patch[k] = v; } };
    if (declared !== undefined) set('moradores_declarados', declared === null ? '' : declared);
    if (teamId !== undefined) set('equipe_id', teamId);
    if (acsId !== undefined) set('acs_id', acsId);
    if (geo) { set('latitude', geo.lat); set('longitude', geo.lon); set('geo_status', 'confirmado'); }
    if (a.clearGeo === true) { bicaAssert_(coord, 'Somente a coordenação pode remover a localização.'); set('latitude', ''); set('longitude', ''); set('geo_status', 'nao_localizado'); }
    const curStreet = bicaCanonStreet_(h.rua_id, streets);
    const newStreetId = a.street_id === undefined ? (curStreet ? curStreet.id : String(h.rua_id)) : bicaStr_(a.street_id);
    const newNumber = a.number === undefined ? bicaStr_(h.numero) : bicaClean_(a.number, 35);
    const newComp = a.complement === undefined ? bicaStr_(h.complemento) : bicaClean_(a.complement, 160);
    const streetChanged = (curStreet ? curStreet.id : String(h.rua_id)) !== newStreetId;
    const addressChanged = streetChanged || bicaStr_(h.numero) !== newNumber || bicaStr_(h.complemento) !== newComp;
    if (addressChanged) {
      bicaAssert_(coord || !streetChanged, 'Somente a coordenação pode mudar a casa de rua. Número e complemento podem ser corrigidos por toda a equipe.');
      const st = bicaCanonStreet_(newStreetId, streets);
      bicaAssert_(st, 'Selecione uma rua cadastrada.');
      bicaAssert_(newNumber, 'Informe o número da casa ou S/N.');
      bicaAssert_(!bicaFindHouse_(st.id, newNumber, newComp, houses, streets, h.id), 'Já existe outra casa com esta rua, número e complemento.');
      set('rua_id', st.id); set('numero', newNumber); set('complemento', newComp);
    }
    if (!Object.keys(after).length) return {id: String(h.id), unchanged: true};
    bicaSetRow_('Domicilios', 'id', h.id, patch);
    bicaAudit_(actor, 'EDITAR_DOMICILIO', 'DOMICILIO', h.id, {antes: before, depois: after});
    return {id: String(h.id), updated: true};
  });
}

function bicaGeoSuggest_(actor, a) {
  const h = bicaRows_('Domicilios').find(x => String(x.id) === String(a.house_id));
  bicaAssert_(h, 'Domicílio inválido.');
  const s = bicaCanonStreet_(h.rua_id, bicaRows_('Ruas'));
  const address = [s ? s.name : '', h.numero, 'Recife', 'Pernambuco', 'Brasil'].filter(Boolean).join(', ');
  const res = Maps.newGeocoder().setRegion('br').setLanguage('pt-BR').geocode(address), first = res.results && res.results[0], loc = first && first.geometry && first.geometry.location;
  bicaAssert_(loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng), 'Endereço não localizado automaticamente. Use o GPS no local ou informe as coordenadas.');
  return {lat: loc.lat, lon: loc.lng, address: first.formatted_address || '', precision: first.geometry.location_type || 'aproximada'};
}

/* ============================== ERROS, BUGS E MELHORIAS ============================== */

/** Cria a aba se ainda não existir (permite usar recursos novos antes de rodar configurarBica novamente). */
function bicaEnsureSheet_(name) {
  const db = bicaDb_();
  let s = db.getSheetByName(name);
  if (s) return s;
  const heads = BICA_SHEETS[name];
  s = db.insertSheet(name);
  s.getRange(1, 1, 1, heads.length).setValues([heads]).setBackground('#145da4').setFontColor('#ffffff').setFontWeight('bold');
  s.setFrozenRows(1);
  delete BICA_HEAD_CACHE[name]; delete BICA_ROWS_CACHE[name];
  return s;
}

function bicaAddFeedback_(actor, a) {
  const tipo = String(a.tipo || '').toUpperCase();
  bicaAssert_(['ERRO', 'BUG', 'MELHORIA'].indexOf(tipo) >= 0, 'Escolha o tipo: erro, bug ou melhoria.');
  const texto = String(a.texto === null || a.texto === undefined ? '' : a.texto).trim().slice(0, 2000);
  bicaAssert_(texto.length >= 5, 'Descreva o que aconteceu (mínimo 5 caracteres).');
  return bicaLock_(function () {
    bicaEnsureSheet_('Feedback');
    const id = bicaId_('FDB');
    bicaAppend_('Feedback', {id: id, momento: bicaNow_(), ator_id: actor.id, ator_nome: actor.name, perfil: actor.role, tipo: tipo, texto: texto, pagina: bicaClean_(a.pagina, 80), status: 'NOVO', resolvido_em: '', resolvido_por: ''});
    return {id: id};
  });
}

function bicaSetFeedbackStatus_(actor, a) {
  const status = String(a.status || '').toUpperCase();
  bicaAssert_(['NOVO', 'EM_ANALISE', 'RESOLVIDO'].indexOf(status) >= 0, 'Situação inválida.');
  return bicaLock_(function () {
    bicaEnsureSheet_('Feedback');
    bicaAssert_(bicaRows_('Feedback').some(x => String(x.id) === String(a.id)), 'Registro não encontrado.');
    bicaSetRow_('Feedback', 'id', a.id, {status: status, resolvido_em: status === 'RESOLVIDO' ? bicaNow_() : '', resolvido_por: status === 'RESOLVIDO' ? actor.id : ''});
    return {id: String(a.id), status: status};
  });
}

/* ============================== EQUIPES E ACS ============================== */

function bicaAddRegistry_(actor, a) {
  const tipo = String(a.tipo || '').toUpperCase(), table = bicaRegistryTable_(tipo), name = bicaClean_(a.name, 100);
  bicaAssert_(name.length >= 2, 'Informe um nome com pelo menos dois caracteres.');
  return bicaLock_(function () {
    const rows = bicaRows_(table), canon = bicaCanon_(name);
    const same = rows.find(x => bicaTrue_(x.ativa) && bicaCanon_(x.nome) === canon);
    if (same) return {id: String(same.id), name: String(same.nome), existing: true};
    const old = rows.find(x => bicaCanon_(x.nome) === canon);
    if (old) {
      const main = bicaResolveRegistry_(tipo, old.id), active = rows.find(x => String(x.id) === main && bicaTrue_(x.ativa));
      if (active) return {id: main, name: String(active.nome), existing: true};
    }
    const id = bicaId_(tipo === 'EQUIPE' ? 'EQP' : 'ACS');
    bicaAppend_(table, {id: id, nome: name, canonico: canon, ativa: true, criado_em: bicaNow_(), criado_por: actor.id});
    bicaAudit_(actor, 'CADASTRAR_' + tipo, tipo, id, {nome: name});
    return {id: id, name: name, existing: false};
  });
}

function bicaRenameRegistry_(actor, a) {
  const tipo = String(a.tipo || '').toUpperCase(), table = bicaRegistryTable_(tipo), name = bicaClean_(a.name, 100);
  bicaAssert_(name.length >= 2, 'Informe um nome com pelo menos dois caracteres.');
  return bicaLock_(function () {
    const rows = bicaRows_(table), id = bicaResolveRegistry_(tipo, a.id);
    const item = rows.find(x => String(x.id) === id && bicaTrue_(x.ativa));
    bicaAssert_(item, 'Cadastro não encontrado.');
    bicaAssert_(!rows.some(x => String(x.id) !== id && bicaTrue_(x.ativa) && bicaCanon_(x.nome) === bicaCanon_(name)), 'Já existe outro cadastro com esse nome. Use a fusão para registros duplicados.');
    if (String(item.nome) === name) return {id: id, unchanged: true};
    bicaSetRow_(table, 'id', id, {nome: name, canonico: bicaCanon_(name)});
    bicaAudit_(actor, 'RENOMEAR_' + tipo, tipo, id, {antes: item.nome, depois: name});
    return {id: id, name: name};
  });
}

function bicaMergeRegistry_(actor, a) {
  const tipo = String(a.tipo || '').toUpperCase(), table = bicaRegistryTable_(tipo);
  return bicaLock_(function () {
    const from = bicaResolveRegistry_(tipo, a.from), to = bicaResolveRegistry_(tipo, a.to);
    bicaAssert_(from && to && from !== to, 'Selecione dois cadastros diferentes.');
    const rows = bicaRows_(table), origin = rows.find(x => String(x.id) === from && bicaTrue_(x.ativa)), main = rows.find(x => String(x.id) === to && bicaTrue_(x.ativa));
    bicaAssert_(origin && main, 'Origem ou principal não encontrado.');
    bicaAppend_('Fusoes_Cadastros', {id: bicaId_('FUS'), tipo: tipo, origem_id: from, principal_id: to, momento: bicaNow_(), ator_id: actor.id, observacao: bicaClean_(a.observacao, 250)});
    bicaSetRow_(table, 'id', from, {ativa: false});
    bicaAudit_(actor, 'FUNDIR_' + tipo, tipo, from, {principal: to, origem_nome: origin.nome, principal_nome: main.nome});
    return {from: from, to: to};
  });
}

/* ============================== RUAS ============================== */

function bicaSimilar_(s, t) {
  const a = bicaCanon_(s).replace(/\b(rua|travessa|tv|av|avenida|r)\b/g, '').replace(/\s+/g, ''), b = bicaCanon_(t).replace(/\b(rua|travessa|tv|av|avenida|r)\b/g, '').replace(/\s+/g, '');
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  const d = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; } }
  return 1 - d[b.length] / Math.max(a.length, b.length);
}
function bicaStreetNameTaken_(name, exceptId) {
  const canon = bicaCanon_(name);
  const st = bicaRows_('Ruas').find(s => String(s.status).toUpperCase() !== 'FUNDIDA' && String(s.id) !== String(exceptId || '') && bicaCanon_(s.nome) === canon);
  if (st) return String(st.nome);
  const al = bicaRows_('Apelidos_Ruas').find(x => String(x.canonico) === canon && String(x.rua_id) !== String(exceptId || ''));
  return al ? String(al.apelido) : '';
}
function bicaEstimate_(v, max) { return bicaIntOrNull_(v, 0, max, 'Estimativas precisam ser números inteiros iguais ou maiores que zero.'); }

function bicaAddStreet_(actor, data) {
  const name = bicaClean_(data.name, 140);
  bicaAssert_(name.length >= 3, 'Informe um nome de rua com pelo menos três caracteres.');
  const coord = actor.role === 'coordenacao';
  const homes = coord ? bicaEstimate_(data.homes, 100000) : null, residents = coord ? bicaEstimate_(data.residents, 1000000) : null;
  return bicaLock_(function () {
    const taken = bicaStreetNameTaken_(name);
    bicaAssert_(!taken, 'Esta rua (ou um nome alternativo dela) já está cadastrada: ' + taken + '.');
    const similar = bicaRows_('Ruas').filter(s => String(s.status).toUpperCase() !== 'FUNDIDA' && bicaSimilar_(s.nome, name) >= 0.77).map(s => String(s.nome));
    bicaAssert_(!similar.length || data.confirmSimilar === true, 'Encontramos nomes parecidos: ' + similar.join(', ') + '. Confira antes de continuar.');
    const id = bicaId_('RUA'), now = bicaNow_();
    bicaAppend_('Ruas', {id: id, nome: name, canonico: bicaCanon_(name), status: coord ? 'ATIVA' : 'PENDENTE', fundida_em: '', casas_previstas: homes === null ? '' : homes, moradores_previstos: residents === null ? '' : residents, fonte_estimativa: coord ? bicaClean_(data.source, 180) : '', criado_em: now, criado_por: actor.id});
    bicaAudit_(actor, 'CRIAR', 'RUA', id, {name: name, similar: similar});
    return {id: id, name: name, similar: similar};
  });
}

function bicaSaveStreet_(actor, a) {
  if (!a.id) return bicaAddStreet_(actor, a);
  const name = bicaClean_(a.name, 140);
  bicaAssert_(name.length >= 3, 'Informe um nome de rua com pelo menos três caracteres.');
  const homes = bicaEstimate_(a.homes, 100000), residents = bicaEstimate_(a.residents, 1000000);
  return bicaLock_(function () {
    const s = bicaRows_('Ruas').find(x => String(x.id) === String(a.id) && String(x.status).toUpperCase() !== 'FUNDIDA');
    bicaAssert_(s, 'Rua inválida ou já fundida.');
    const patch = {casas_previstas: homes === null ? '' : homes, moradores_previstos: residents === null ? '' : residents, fonte_estimativa: bicaClean_(a.source, 180), status: 'ATIVA'};
    if (bicaCanon_(s.nome) !== bicaCanon_(name) || String(s.nome) !== name) {
      const taken = bicaStreetNameTaken_(name, s.id);
      bicaAssert_(!taken, 'Este nome já pertence a outra rua (' + taken + '). Use a fusão de ruas.');
      const similar = bicaRows_('Ruas').filter(x => String(x.id) !== String(s.id) && String(x.status).toUpperCase() !== 'FUNDIDA' && bicaSimilar_(x.nome, name) >= 0.77).map(x => String(x.nome));
      bicaAssert_(!similar.length || a.confirmSimilar === true, 'Encontramos nomes parecidos: ' + similar.join(', ') + '. Confira antes de continuar.');
      if (bicaCanon_(s.nome) !== bicaCanon_(name)) bicaAppend_('Apelidos_Ruas', {id: bicaId_('ALR'), rua_id: s.id, apelido: s.nome, canonico: bicaCanon_(s.nome), criado_em: bicaNow_()});
      patch.nome = name; patch.canonico = bicaCanon_(name);
    }
    bicaSetRow_('Ruas', 'id', s.id, patch);
    bicaAudit_(actor, 'ATUALIZAR', 'RUA', s.id, {nome_anterior: s.nome, nome: name, homes: homes, residents: residents});
    return {id: String(s.id)};
  });
}

function bicaMergeStreets_(actor, a) {
  bicaAssert_(a.from && a.to && a.from !== a.to, 'Selecione duas ruas diferentes.');
  return bicaLock_(function () {
    const all = bicaRows_('Ruas'), source = all.find(s => String(s.id) === String(a.from)), target = bicaCanonStreet_(a.to, all);
    bicaAssert_(source && String(source.status).toUpperCase() !== 'FUNDIDA' && target && target.id !== String(source.id), 'Ruas inválidas para fusão.');
    bicaSetRow_('Ruas', 'id', source.id, {status: 'FUNDIDA', fundida_em: target.id});
    const names = [String(source.nome)].concat(bicaRows_('Apelidos_Ruas').filter(x => String(x.rua_id) === String(source.id)).map(x => String(x.apelido)));
    bicaAppend_('Apelidos_Ruas', names.map(n => ({id: bicaId_('ALR'), rua_id: target.id, apelido: n, canonico: bicaCanon_(n), criado_em: bicaNow_()})));
    const houses = bicaRows_('Domicilios').filter(h => { const s = bicaCanonStreet_(h.rua_id, bicaRows_('Ruas')); return s && s.id === target.id; });
    const keys = {}; let conflicts = 0;
    houses.forEach(h => { const k = bicaCanon_(h.numero) + '|' + bicaCanon_(h.complemento); if (keys[k]) conflicts++; keys[k] = true; });
    bicaAudit_(actor, 'FUNDIR', 'RUA', source.id, {destino: target.id, registros_preservados: true, estimativas_nao_somadas: true, casas_para_conferir: conflicts});
    return {from: String(source.id), to: target.id, conflicts: conflicts};
  });
}

/* ============================== BLOCOS, TERMOS E PDF ============================== */

function bicaNewBlock_(actor, a) {
  const name = bicaClean_(a.name, 160);
  bicaAssert_(name.length >= 4, 'Informe um nome para o bloco (mínimo 4 caracteres).');
  return bicaLock_(function () {
    const ids = bicaRows_('Blocos').map(b => String(b.id));
    let n = ids.length + 1, id = 'BL-' + String(n).padStart(3, '0');
    while (ids.indexOf(id) >= 0) id = 'BL-' + String(++n).padStart(3, '0');
    const now = bicaNow_();
    bicaAppend_('Blocos', {id: id, nome: name, versao: 1, config_json: JSON.stringify(bicaDefaultConfig_()), ativo: true, criado_em: now, atualizado_em: now});
    bicaAppend_('Termos', {id: bicaId_('TERMO'), bloco_id: id, versao: '1', texto_completo: BICA_TERMO_INICIAL, criado_em: now, criado_por: actor.id, ativo: true});
    bicaAppend_('Config_PDF', {bloco_id: id, campos_json: JSON.stringify(BICA_PDF_DEFAULT), atualizado_em: now, alterado_por: actor.id});
    bicaAudit_(actor, 'CRIAR', 'BLOCO', id, {name: name});
    return {id: id};
  });
}

function bicaSaveBlock_(actor, a) {
  return bicaLock_(function () {
    const b = bicaRows_('Blocos').find(x => String(x.id) === String(a.id));
    bicaAssert_(b, 'Bloco inválido.');
    const current = bicaNormConfig_(bicaJson_(b.config_json)), next = bicaNormConfig_(a.config || current);
    const changed = JSON.stringify(current) !== JSON.stringify(next);
    const name = bicaClean_(a.name, 160) || String(b.nome);
    bicaAssert_(name.length >= 4, 'O nome do bloco precisa de pelo menos 4 caracteres.');
    const version = (Number(b.versao) || 1) + (changed ? 1 : 0);
    bicaSetRow_('Blocos', 'id', b.id, {nome: name, config_json: JSON.stringify(next), versao: version, atualizado_em: bicaNow_()});
    if (changed || name !== String(b.nome)) bicaBlockHistory_(actor, b, current, next, String(b.nome), name, version);
    bicaAudit_(actor, 'ATUALIZAR_CONFIG', 'BLOCO', b.id, {nome: name, versao: version, configuracao_alterada: changed});
    return {id: String(b.id), version: version};
  });
}

function bicaSaveTerm_(actor, a) {
  const body = String(a.body || '').trim();
  bicaAssert_(body.length >= 250 && body.length < 15000, 'O texto integral do termo precisa ter entre 250 e 15.000 caracteres.');
  return bicaLock_(function () {
    const b = bicaRows_('Blocos').find(x => String(x.id) === String(a.block_id));
    bicaAssert_(b, 'Bloco inválido.');
    const t = bicaRows_('Termos').filter(x => String(x.bloco_id) === String(b.id));
    t.filter(x => bicaTrue_(x.ativo)).forEach(x => bicaSetRow_('Termos', 'id', x.id, {ativo: false}));
    const id = bicaId_('TERMO'), version = String(t.length + 1);
    bicaAppend_('Termos', {id: id, bloco_id: b.id, versao: version, texto_completo: body, criado_em: bicaNow_(), criado_por: actor.id, ativo: true});
    bicaAudit_(actor, 'NOVA_VERSAO', 'TERMO', id, {bloco: b.id, versao: version});
    return {id: id, version: version};
  });
}

function bicaSavePdfConfig_(actor, a) {
  return bicaLock_(function () {
    bicaAssert_(bicaRows_('Blocos').some(x => String(x.id) === String(a.block_id)), 'Bloco inválido.');
    const c = Object.assign({}, BICA_PDF_DEFAULT);
    BICA_PDF_FIELDS.forEach(k => { if (a.fields && typeof a.fields[k] === 'boolean') c[k] = a.fields[k]; });
    const now = bicaNow_();
    if (bicaRows_('Config_PDF').some(x => String(x.bloco_id) === String(a.block_id))) bicaSetRow_('Config_PDF', 'bloco_id', a.block_id, {campos_json: JSON.stringify(c), atualizado_em: now, alterado_por: actor.id});
    else bicaAppend_('Config_PDF', {bloco_id: a.block_id, campos_json: JSON.stringify(c), atualizado_em: now, alterado_por: actor.id});
    bicaAudit_(actor, 'CONFIG_PDF', 'BLOCO', a.block_id, {fields: c});
    return {fields: c};
  });
}

function bicaSetStage_(actor, a) {
  const stage = String(a.stage || '').toUpperCase();
  bicaAssert_(stage === 'PREPARACAO' || stage === 'OPERACAO', 'Etapa inválida.');
  return bicaLock_(function () {
    bicaSetParam_('ETAPA', stage);
    bicaAudit_(actor, 'ETAPA', 'PARAMETRO', 'ETAPA', {valor: stage});
    return {stage: stage};
  });
}

/* ============================== ACESSOS ============================== */

function bicaNewAccess_(actor, a) {
  const name = bicaClean_(a.name, 100), role = String(a.role || 'coleta') === 'coordenacao' ? 'coordenacao' : 'coleta', login = bicaClean_(a.login, 60);
  bicaAssert_(name.length >= 3, 'Informe a identificação (mínimo 3 caracteres).');
  bicaAssert_(/^[A-Za-z0-9._-]{3,60}$/.test(login), 'Login deve ter 3 a 60 letras, números, ponto, hífen ou sublinhado (sem espaços nem acentos).');
  return bicaLock_(function () {
    bicaAssert_(!bicaRows_('Acessos').some(x => String(x.login).trim().toLowerCase() === login.toLowerCase()), 'Já existe um acesso com este login.');
    const senha = bicaNewPassword_(), id = bicaId_('ACE');
    bicaAppend_('Acessos', {id: id, identificacao: name, perfil: role, login: login, senha: senha, ativo: true, criado_em: bicaNow_(), revogado_em: ''});
    bicaAudit_(actor, 'CRIAR_ACESSO', 'ACESSO', id, {name: name, role: role, login: login});
    return {id: id, login: login, senha: senha};
  });
}

function bicaSetAccessActive_(actor, a) {
  bicaAssert_(String(a.id) !== actor.id, 'Não é possível desativar o próprio acesso pelo app.');
  return bicaLock_(function () {
    const x = bicaRows_('Acessos').find(r => String(r.id) === String(a.id));
    bicaAssert_(x, 'Acesso inválido.');
    const active = a.active === true;
    bicaSetRow_('Acessos', 'id', x.id, {ativo: active, revogado_em: active ? '' : bicaNow_()});
    bicaAudit_(actor, active ? 'REATIVAR_ACESSO' : 'REVOGAR_ACESSO', 'ACESSO', x.id, {});
    return {id: String(x.id), active: active};
  });
}

function bicaResetPassword_(actor, a) {
  bicaAssert_(String(a.id) !== actor.id, 'Altere a sua própria senha diretamente na aba Acessos.');
  return bicaLock_(function () {
    const x = bicaRows_('Acessos').find(r => String(r.id) === String(a.id));
    bicaAssert_(x, 'Acesso inválido.');
    const senha = bicaNewPassword_();
    bicaSetRow_('Acessos', 'id', x.id, {senha: senha});
    bicaAudit_(actor, 'NOVA_SENHA', 'ACESSO', x.id, {});
    return {id: String(x.id), login: String(x.login), senha: senha};
  });
}

/* ============================== QUESTIONÁRIO EDITÁVEL ============================== */

/** Edição atual do questionário (cresce a cada inclusão/alteração feita no Construtor). */
function bicaEdition_() {
  const p = Math.floor(Number(bicaParam_('EDICAO_QUESTIONARIO')) || 0);
  return Math.max(BICA_EDICAO_QUESTIONARIO, p);
}

/** Questionário efetivo: BICA_QUESTIONS + aba Perguntas (mesmo id substitui; id novo entra no fim da sua área). */
function bicaQuestions_() {
  const base = JSON.parse(JSON.stringify(BICA_QUESTIONS));
  const sheet = bicaDb_().getSheetByName('Perguntas');
  if (!sheet) return base;
  const rows = bicaRows_('Perguntas');
  if (!rows.length) return base;
  const out = base.slice();
  rows.forEach(r => {
    const id = bicaStr_(r.id).trim();
    if (!id) return;
    let opts = [];
    try { opts = JSON.parse(bicaStr_(r.opcoes_json) || '[]'); } catch (e) { opts = []; }
    const cond = bicaJson_(r.condicao_json);
    const q = {id: id, group: bicaStr_(r.grupo), label: bicaStr_(r.pergunta), type: bicaStr_(r.tipo) || 'single', origin: bicaStr_(r.origem) || 'incluida', options: Array.isArray(opts) ? opts : []};
    if (cond && cond.field) q.depends = {field: String(cond.field), values: (cond.values || []).map(String)};
    if (bicaStr_(r.observacao)) q.note = bicaStr_(r.observacao);
    const since = Math.floor(Number(r.desde) || 0);
    if (since > 1) q.desde = since;
    let types = [];
    try { types = JSON.parse(bicaStr_(r.tipos_json) || '[]'); } catch (e) { types = []; }
    if (Array.isArray(types) && types.length) q.typeChanges = types;
    if (q.type === 'text' && !q.options.length) delete q.options;
    const i = out.findIndex(x => x.id === id);
    if (i >= 0) { out[i] = q; return; }
    let at = -1;
    out.forEach((x, k) => { if (x.group === q.group) at = k; });
    if (at >= 0) out.splice(at + 1, 0, q); else out.push(q);
  });
  return out;
}

function bicaSlug_(text, max) {
  const full = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''), m = max || 24;
  let cut = full.slice(0, m);
  if (full.length > m && full[m] !== '_' && cut.lastIndexOf('_') > 3) cut = cut.slice(0, cut.lastIndexOf('_')); // não corta palavra no meio
  return cut.replace(/_+$/, '') || 'item';
}
function bicaUniqueCode_(text, taken, max) {
  let base = bicaSlug_(text, max), code = base, n = 2;
  while (taken.indexOf(code) >= 0) code = base + '_' + (n++);
  taken.push(code);
  return code;
}
const BICA_TIPO_LABEL = {single: 'Única', multi: 'Múltipla', text: 'Texto livre'};

function bicaQHistory_(actor, edition, scope, qid, action, summary, details) {
  bicaEnsureSheet_('Historico_Questionario');
  bicaAppend_('Historico_Questionario', {id: bicaId_('HQ'), momento: bicaNow_(), ator_id: actor.id, ator_nome: actor.name, edicao: edition, escopo: scope, pergunta_id: qid, acao: action, resumo: String(summary).slice(0, 500), detalhes_json: JSON.stringify(details || {}).slice(0, 4000)});
}

function bicaQuestionRow_(q, actor) {
  return {id: q.id, grupo: q.group, pergunta: q.label, tipo: q.type, opcoes_json: JSON.stringify(q.options || []), tipos_json: q.typeChanges && q.typeChanges.length ? JSON.stringify(q.typeChanges) : '', condicao_json: q.depends ? JSON.stringify(q.depends) : '', origem: q.origin || 'incluida', observacao: q.note || '', desde: q.desde || '', atualizado_em: bicaNow_(), atualizado_por: actor.name || actor.id};
}
/** Acrescenta no fim da aba as colunas novas do esquema (sem mexer nas existentes). */
function bicaEnsureColumns_(name) {
  const s = bicaEnsureSheet_(name), want = BICA_SHEETS[name];
  const have = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0].map(String);
  const missing = want.filter(h => have.indexOf(h) < 0);
  if (!missing.length) return s;
  s.getRange(1, have.length + 1, 1, missing.length).setValues([missing]).setBackground('#145da4').setFontColor('#ffffff').setFontWeight('bold');
  delete BICA_HEAD_CACHE[name]; delete BICA_ROWS_CACHE[name];
  return s;
}
function bicaSaveQuestionRow_(q, actor) {
  bicaEnsureColumns_('Perguntas');
  const row = bicaQuestionRow_(q, actor);
  if (bicaRows_('Perguntas').some(r => String(r.id) === q.id)) bicaSetRow_('Perguntas', 'id', q.id, row);
  else bicaAppend_('Perguntas', row);
}
function bicaCleanOptionLabels_(list) {
  const labels = (Array.isArray(list) ? list : []).map(x => bicaClean_(typeof x === 'string' ? x : x && x.label, 150)).filter(Boolean);
  const seen = {};
  labels.forEach(l => { const k = l.toLowerCase(); bicaAssert_(!seen[k], 'Opção repetida: ' + l); seen[k] = true; });
  return labels;
}

function bicaAddQuestion_(actor, a) {
  return bicaLock_(function () {
    const catalog = bicaQuestions_();
    const label = bicaClean_(a.label, 300), group = bicaClean_(a.group, 80), type = String(a.type || '');
    bicaAssert_(label.length >= 5, 'Escreva a pergunta (pelo menos 5 caracteres).');
    bicaAssert_(group.length >= 2, 'Informe a área (grupo) da pergunta.');
    bicaAssert_(['single', 'multi', 'text'].indexOf(type) >= 0, 'Tipo de pergunta inválido.');
    bicaAssert_(!catalog.some(q => q.label.toLowerCase() === label.toLowerCase()), 'Já existe uma pergunta com este texto.');
    const edition = bicaEdition_() + 1;
    const q = {id: bicaUniqueCode_('q_' + bicaSlug_(label, 28), catalog.map(x => x.id), 34), group: group, label: label, type: type, origin: 'incluida', desde: edition};
    if (type !== 'text') {
      const labels = bicaCleanOptionLabels_(a.options);
      bicaAssert_(labels.length >= 2 && labels.length <= 30, 'Informe de 2 a 30 opções de resposta.');
      const taken = [];
      q.options = labels.map(l => [bicaUniqueCode_(l, taken, 24), l]);
    }
    if (a.depends && a.depends.field) {
      const parent = catalog.find(x => x.id === String(a.depends.field));
      bicaAssert_(parent && parent.type !== 'text', 'A condição deve usar uma pergunta de escolha.');
      const vals = (a.depends.values || []).map(String).filter(v => parent.options.some(o => o[0] === v));
      bicaAssert_(vals.length, 'Escolha ao menos uma resposta que libera a pergunta.');
      q.depends = {field: parent.id, values: vals};
    }
    const note = bicaClean_(a.note, 300);
    if (note) q.note = note;
    bicaSaveQuestionRow_(q, actor);
    bicaSetParam_('EDICAO_QUESTIONARIO', String(edition));
    let summary = 'Incluída pergunta “' + label + '” · área ' + group + ' · ' + BICA_TIPO_LABEL[type] + (q.options ? ' · ' + q.options.length + ' opções' : '');
    if (q.depends) { const parent = catalog.find(x => x.id === q.depends.field); summary += ' · aparece se “' + parent.label + '” = ' + q.depends.values.map(v => (parent.options.find(o => o[0] === v) || [v, v])[1]).join(' / '); }
    bicaQHistory_(actor, edition, 'QUESTIONARIO', q.id, 'INCLUIDA_PERGUNTA', summary, {pergunta: q});
    bicaAudit_(actor, 'INCLUIR_PERGUNTA', 'PERGUNTA', q.id, {edicao: edition, pergunta: label});
    bicaRewriteDictionary_();
    return {id: q.id, edition: edition};
  });
}

/** Corrige textos, inclui/oculta opções. Códigos nunca mudam nem são apagados; tipo e condição não mudam. */
function bicaUpdateQuestion_(actor, a) {
  return bicaLock_(function () {
    const catalog = bicaQuestions_(), q = catalog.find(x => x.id === String(a.id));
    bicaAssert_(q, 'Pergunta não encontrada.');
    const before = JSON.parse(JSON.stringify(q)), edition = bicaEdition_() + 1, changes = [];
    const label = bicaClean_(a.label, 300) || q.label, group = bicaClean_(a.group, 80) || q.group;
    if (label !== q.label) {
      bicaAssert_(label.length >= 5, 'Escreva a pergunta (pelo menos 5 caracteres).');
      bicaAssert_(!catalog.some(x => x.id !== q.id && x.label.toLowerCase() === label.toLowerCase()), 'Já existe uma pergunta com este texto.');
      changes.push(['ALTERADO_TEXTO', 'Alterado texto da pergunta: “' + q.label + '” → “' + label + '”']);
      q.label = label;
    }
    if (group !== q.group) { changes.push(['ALTERADA_AREA', 'Pergunta “' + q.label + '” movida da área ' + q.group + ' para ' + group]); q.group = group; }
    const newType = a.type ? String(a.type) : q.type;
    if (newType !== q.type) {
      bicaAssert_(['single', 'multi', 'text'].indexOf(newType) >= 0, 'Tipo de pergunta inválido.');
      if (newType === 'text') bicaAssert_(!catalog.some(x => x.depends && x.depends.field === q.id), 'Outra pergunta aparece conforme a resposta desta. Ela não pode virar texto livre.');
      if (q.type === 'text' && !(q.options || []).length) {
        const labels = bicaCleanOptionLabels_((a.options || []).filter(o => !o.code));
        bicaAssert_(labels.length >= 2, 'Para virar escolha, informe pelo menos 2 opções de resposta.');
        q.options = [];
        a.options = labels.map(l => ({label: l}));
      }
      changes.push(['ALTERADO_TIPO', 'Alterado tipo de resposta de “' + q.label + '”: ' + BICA_TIPO_LABEL[q.type] + ' → ' + BICA_TIPO_LABEL[newType]]);
      q.typeChanges = (q.typeChanges || []).concat([{edicao: edition, de: q.type, para: newType}]);
      q.type = newType;
    }
    if (a.note !== undefined) { const note = bicaClean_(a.note, 300); if (note !== (q.note || '')) { changes.push(['ALTERADA_ORIENTACAO', 'Alterada orientação ao entrevistador em “' + q.label + '”']); if (note) q.note = note; else delete q.note; } }
    if (q.type !== 'text' && Array.isArray(a.options)) {
      q.options = q.options || [];
      const taken = q.options.map(o => o[0]);
      const seen = {};
      q.options.forEach(o => { seen[String(o[1]).toLowerCase()] = o[0]; });
      a.options.forEach(inp => {
        const lab = bicaClean_(inp && inp.label, 150), hidden = !!(inp && inp.hidden);
        const cur = inp && inp.code ? q.options.find(o => o[0] === String(inp.code)) : null;
        if (cur) {
          const meta = Object.assign({}, cur[2] || {});
          if (lab && lab !== cur[1]) {
            bicaAssert_(!seen[lab.toLowerCase()] || seen[lab.toLowerCase()] === cur[0], 'Opção repetida: ' + lab);
            changes.push(['ALTERADA_OPCAO', 'Corrigido texto da opção em “' + q.label + '”: “' + cur[1] + '” → “' + lab + '”']);
            delete seen[String(cur[1]).toLowerCase()]; seen[lab.toLowerCase()] = cur[0]; cur[1] = lab;
          }
          if (hidden !== !!meta.oculta) {
            changes.push([hidden ? 'OCULTADA_OPCAO' : 'REATIVADA_OPCAO', (hidden ? 'Ocultada' : 'Reativada') + ' opção “' + cur[1] + '” em “' + q.label + '”']);
            if (hidden) meta.oculta = true; else delete meta.oculta;
          }
          if (Object.keys(meta).length) cur[2] = meta; else if (cur.length > 2) cur.length = 2;
        } else if (lab && !(inp && inp.code)) {
          bicaAssert_(!seen[lab.toLowerCase()], 'Opção repetida: ' + lab);
          const code = bicaUniqueCode_(lab, taken, 24);
          q.options.push([code, lab, {desde: edition}]);
          seen[lab.toLowerCase()] = code;
          changes.push(['INCLUIDA_OPCAO', 'Incluída opção “' + lab + '” em “' + q.label + '”']);
        }
      });
      bicaAssert_(q.options.filter(o => !(o[2] && o[2].oculta)).length >= 2, 'A pergunta precisa de pelo menos 2 opções visíveis.');
      bicaAssert_(q.options.length <= 40, 'Limite de 40 opções por pergunta.');
    }
    if (!changes.length) return {id: q.id, edition: bicaEdition_(), unchanged: true};
    bicaSaveQuestionRow_(q, actor);
    bicaSetParam_('EDICAO_QUESTIONARIO', String(edition));
    changes.forEach(c => bicaQHistory_(actor, edition, 'QUESTIONARIO', q.id, c[0], c[1], {antes: before, depois: q}));
    bicaAudit_(actor, 'ALTERAR_PERGUNTA', 'PERGUNTA', q.id, {edicao: edition, alteracoes: changes.map(c => c[0])});
    bicaRewriteDictionary_();
    return {id: q.id, edition: edition, changes: changes.length};
  });
}

/** Registra no histórico o que mudou ao publicar a configuração de um bloco. */
function bicaBlockHistory_(actor, b, current, next, oldName, newName, version) {
  const catalog = bicaQuestions_(), qLabel = id => (catalog.find(q => q.id === id) || {label: id}).label;
  const mLabel = id => (BICA_MODULES.find(m => m.id === id) || {label: id}).label;
  const edition = bicaEdition_(), rows = [];
  if (oldName !== newName) rows.push(['', 'RENOMEADO_BLOCO', 'Bloco renomeado: “' + oldName + '” → “' + newName + '”']);
  Object.keys(next.questions).forEach(id => { if (current.questions[id] !== next.questions[id]) rows.push([id, next.questions[id] ? 'ATIVADA_PERGUNTA' : 'DESATIVADA_PERGUNTA', (next.questions[id] ? 'Ativada' : 'Desativada') + ' pergunta “' + qLabel(id) + '” no ' + newName]); });
  Object.keys(next.modules).forEach(id => { if (current.modules[id] !== next.modules[id]) rows.push(['', next.modules[id] ? 'MODULO_LIGADO' : 'MODULO_DESLIGADO', 'Módulo “' + mLabel(id) + '” ' + (next.modules[id] ? 'ligado' : 'desligado') + ' no ' + newName]); });
  rows.forEach(r => bicaQHistory_(actor, edition, String(b.id), r[0], r[1], r[2], {bloco_versao: version}));
}

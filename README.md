# BICA · Pesquisa Territorial — USF Mais Córrego da Bica (Equipe 2)

Um único `index.html` que roda **ao mesmo tempo** no GitHub Pages e no Google Apps Script e grava tudo na **mesma planilha mãe**.

```
GitHub Pages (index.html) ──fetch──┐
                                   ├──► Apps Script (apps-script/*.gs) ──► Planilha Google (dados)
Apps Script /exec (mesmo HTML) ────┘        login, validação, auditoria
```

- O Apps Script é o único que acessa a planilha. O navegador nunca recebe senhas e só recebe o link da planilha se o perfil for de coordenação.
- Ao abrir a URL do Apps Script, o `doGet` busca o `index.html` deste repositório (branch `main`). Basta atualizar o GitHub para atualizar as duas versões. O Apps Script guarda uma cópia por até 5 minutos.

## Instalação (uma vez, com a conta dona da planilha)

1. **Compartilhamento da planilha:** em *Compartilhar*, mude para **Restrito**. O app continua funcionando, porque o Apps Script roda com a sua conta. A planilha guarda senhas e respostas de saúde.
2. Na planilha mãe, abra **Extensões → Apps Script**. Crie um projeto novo e não misture com o projeto antigo, para evitar funções duplicadas.
3. Crie três arquivos de script e cole o conteúdo da pasta [`apps-script/`](apps-script):
   `Config.gs`, `Schema.gs` e `Codigo.gs`. Apague o `Código.gs` vazio que vem por padrão.
4. Selecione a função **`configurarBica`**, clique em **Executar** e autorize.
   - Ela cria as abas e colunas que faltarem e **não apaga nada**.
   - Se a aba `Acessos` estiver vazia, ela cria `coordenacao` e `entrevistador1` … `entrevistador7` com senhas aleatórias. As senhas aparecem no registro de execução e na aba **Acessos**.
5. **Implantar → Nova implantação → App da Web**
   - *Executar como:* **Eu**
   - *Quem pode acessar:* **Qualquer pessoa**
   - Copie a URL que termina em **`/exec`**.
6. No GitHub, edite `index.html`, procure `const BICA_API_URL = '';` e cole a URL entre as aspas. Faça o commit.
   Também é possível informar a URL em *Configuração do servidor*, na tela de login. Nesse caso ela vale só para o aparelho em que foi digitada.
7. Teste nos dois endereços com o mesmo login:
   - GitHub Pages: `https://catarinamaia-codigom.github.io/UBS-corrego-da-bica-DEMO-01/`
   - Apps Script: a URL `/exec`

> **Contas institucionais (@upe.br):** o administrador do Google Workspace pode bloquear a opção "Qualquer pessoa". Se ela não aparecer, a versão do GitHub não consegue falar com o servidor. Nesse caso, peça a liberação ao TI ou use uma conta Gmail pessoal como dona da planilha e do script.

### Atualizar depois

> **Versão 1.1 do servidor:** depois de colar os arquivos novos, execute `configurarBica()` de novo (cria a aba **Feedback** e atualiza o **Dicionario**, sem apagar nada) e publique uma nova versão em *Gerenciar implantações*. Enquanto o servidor estiver na versão antiga, a coordenação vê um aviso vermelho no topo do app.


- **Interface (`index.html`):** basta fazer o commit no GitHub. Para o Apps Script mostrar a mudança na hora, execute `atualizarInterfaceBica()` no editor.
- **Servidor (`.gs`):** cole o novo código e vá em *Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão*. Assim a URL `/exec` não muda.
- `verificarBica()` mostra o estado da conexão sem alterar dados.

## O que mudou em relação ao simulador v0.5

| Pedido | Onde está |
|---|---|
| Login inicial com nomes e senhas na planilha | Tela de login. Senhas na aba **Acessos**; alterar ou desativar ali encerra a sessão daquele acesso |
| Planilha final conectada | `configurarBica()` liga o script à planilha onde ele foi criado, sem ID no código público |
| ACS e equipe **por casa** | Colunas `acs_id` e `equipe_id` em **Domicilios**. Seleção com botão **+ Nova** na coleta e no cadastro |
| Nomes de ACS salvos para seleção | Abas **ACS** e **Equipes**. A coordenação pode renomear e unir duplicadas |
| Editar residência no painel Domicílios | Página **Domicílios → Editar**. Moradores, equipe, ACS e GPS para todos; rua e número só para a coordenação |
| Total de moradores por rua | Tabela *Moradores por rua*: moradores informados + **3 por casa** sem informação + casas previstas ainda sem cadastro |
| Média de 3 moradores | Parâmetro `MEDIA_MORADORES_CASA` (aba **Parametros**) |
| Moradores editáveis no cadastro e na pesquisa | Campo no cadastro da casa e pergunta "Quantas pessoas moram neste domicílio?" na coleta |
| Mostrar ACS e equipe da casa | Tabela de domicílios, lista de casas da rua e aviso ao digitar o número |
| Botão direto para a planilha | Menu lateral, Indicadores e Governança (somente coordenação) |
| "Não sabe responder" junto de "Concordou" | Situação de cada pessoa: Concordou · Não concordou · **Não sabe responder** · **Ausente** |
| Ausente conta tentativa | Cada envio é uma linha em **Visitas**. Ausentes ficam pendentes e, no retorno, use *Carregar moradores já registrados*. Também existe o botão **Casa fechada / ninguém atendeu** |

Recursos trazidos do Apps Script anterior: tokens assinados, validação no servidor, envio sem duplicar (`request_id`), termos versionados com o texto gravado junto ao consentimento, etapas PREPARAÇÃO/OPERAÇÃO (TREINAMENTO/PESQUISA), auditoria, fusão de ruas e de cadastros, confirmação de localização, gestão de acessos e as abas **Resumo** e **Dicionario**.

## Abas da planilha

`Acessos` · `Parametros` · `Blocos` · `Ruas` · `Apelidos_Ruas` · `Equipes` · `ACS` · `Fusoes_Cadastros` · `Domicilios` · `Pessoas` · `Visitas` · `Participacoes` · `Entrevistas` · `Respostas` · `Termos` · `Consentimentos` · `Config_PDF` · `Dicionario` · `Auditoria` · `Resumo` · `Instrucoes`

Abas em laranja guardam dados pessoais ou credenciais. Não apague linhas para corrigir dados: use o app, que registra tudo na auditoria.

## Ética

O termo inicial é uma **minuta**. Com a etapa em OPERAÇÃO, o servidor recusa entrevistas enquanto o termo do bloco contiver "MINUTA PARA VALIDAÇÃO". Valide o protocolo antes de entrevistar moradores reais.

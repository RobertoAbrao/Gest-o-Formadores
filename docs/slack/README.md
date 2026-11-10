# Gestão Formadores ↔ Slack

O que a integração faz:

| No Slack | Quem faz | Precisa de |
|---|---|---|
| Card de cada demanda no canal de demandas, com botões de status, **Validar** e **Editar** | rotas `/api/slack/*` na Vercel | só Vercel |
| `/demanda` abre um formulário e cria a demanda | Vercel | só Vercel |
| Resposta na thread do card vira comentário no histórico do app (💾 = gravado) | Vercel | só Vercel |
| Resumo da manhã (dias úteis, ~8h): formações atrasadas e próximas, filas de demandas, projetos com buraco | Vercel Cron | só Vercel |
| Demanda criada ou mudada **no app** (automáticas, agente, calendário) aparece/atualiza no Slack | gatilho do Firestore | **plano Blaze** |
| Aviso de **tudo que entra no banco** (formação, projeto, avaliação, despesa…) | gatilho do Firestore | **plano Blaze** |

O banco do app (`demandas`) continua sendo a fonte. O Slack é a tela. Dashboard, Gerência,
Planilha, Calendário e o agente seguem lendo `demandas` como antes.

## Como funciona por dentro

```
Slack ──(botão, /demanda, thread)──► Vercel /api/slack/* ──► Firestore
                                          │                      │
                                          └── atualiza o card ◄──┘ (gatilho, só p/ o que nasceu no app)
Firestore ──(gravação do app)──► Cloud Functions (functions/) ──► Slack
Vercel Cron ──(dias úteis 11:00 UTC)──► /api/slack/resumo ──► Slack
```

- Código comum: `src/lib/slack/` (a Vercel e as Functions usam o mesmo).
- Regra contra duplicata: o que nasce no Slack grava `origem: 'slack'` no histórico; o
  gatilho ignora esses itens. Testes: `cd functions && npm test`.
- Quem pode validar: `src/lib/validadores.ts` (o mesmo arquivo que a tela `/diario` usa).

---

## Parte A — Slack (≈5 min)

1. Em <https://api.slack.com/apps> → **Create New App** → **From an app manifest** → escolha o
   workspace → cole `docs/slack/manifest.json` **trocando `SEU-APP.vercel.app` pelo domínio do app na Vercel**.
2. **Install to Workspace** → **Allow**. (Se o workspace exigir, um admin do Slack aprova.)
3. Anote dois valores:
   - **OAuth & Permissions → Bot User OAuth Token** (`xoxb-…`)
   - **Basic Information → App Credentials → Signing Secret**
4. Crie os canais (ex.: `#demandas` e `#gestao-avisos`; podem ser o mesmo). Em cada um, digite
   `/invite @Gestão`. Pegue o **ID** de cada canal: clique no nome do canal → no fim da janela,
   "ID do canal" (`C…`).

## Parte B — Vercel

5. Firebase console → ⚙️ **Configurações do projeto** → **Contas de serviço** → **Gerar nova chave privada**.
   Baixa um JSON — é uma chave de administrador do banco: não mande por chat nem coloque no Git.
6. Vercel → projeto → **Settings → Environment Variables** (ambiente *Production*; marque *Sensitive*):

   | Nome | Valor |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | o conteúdo inteiro do JSON do passo 5 |
   | `SLACK_BOT_TOKEN` | `xoxb-…` |
   | `SLACK_SIGNING_SECRET` | o Signing Secret |
   | `SLACK_CANAL_DEMANDAS` | `C…` |
   | `SLACK_CANAL_AVISOS` | `C…` |
   | `APP_URL` | `https://SEU-APP.vercel.app` |
   | `CRON_SECRET` | um texto aleatório longo (a Vercel o envia ao chamar o resumo) |

   **Nenhuma** pode ter o prefixo `NEXT_PUBLIC_` — com ele o valor vai para o navegador.
7. Faça um deploy novo (variável nova só vale em deploy novo).
8. De volta ao Slack: **Event Subscriptions** → ligar → Request URL
   `https://SEU-APP.vercel.app/api/slack/eventos` (tem de ficar **Verified**) →
   **Subscribe to bot events**: `message.channels` e `message.groups` → **Save Changes** →
   reinstale se o Slack pedir.
9. Teste no canal: `/demanda ajuda`, depois `/demanda conferir` (mostra quem do Slack ligou a
   quem do app pelo e-mail), depois `/demanda teste` e clique nos botões.
10. `/demanda importar` publica as demandas abertas antigas (25 por vez — repita até zerar).

## Parte C — Blaze + Cloud Functions

11. Firebase console → **Uso e faturamento** → mudar para **Blaze**. Crie um **alerta de orçamento**
    (ex.: US$ 5) no Google Cloud Billing. O alerta avisa; não bloqueia.
12. No terminal, na raiz do projeto:
    ```sh
    npx firebase-tools login
    npx firebase-tools firestore:databases:get "(default)"   # veja "locationId"
    ```
    Se o `locationId` não for `nam5`/`us-central1`, troque `REGIAO` em `functions/src/index.ts`
    (o gatilho tem de rodar na mesma região do banco).
13. ```sh
    npx firebase-tools functions:secrets:set SLACK_BOT_TOKEN      # cole o xoxb-…
    npx firebase-tools deploy --only functions
    ```
    No primeiro deploy ele pergunta `SLACK_CANAL_DEMANDAS`, `SLACK_CANAL_AVISOS` e `APP_URL` e
    guarda em `functions/.env.editora-lt-65cd6` (fora do Git).
14. Teste: cadastre um material de teste → aviso no canal de avisos. Abra `/diario` pelo endereço
    (saiu do menu, mas existe) e crie uma demanda → card no canal de demandas.

## Ligação Slack ↔ app (quem é quem)

O bot liga a pessoa do Slack ao usuário do app pelo **e-mail**. Quem não ligar ainda consegue
agir, mas o histórico grava "Nome (Slack)" e essa pessoa **não consegue validar**. Para
corrigir: deixe o e-mail igual nos dois, ou preencha o campo `slackUserId` (o `U…` da pessoa) no
documento dela em `usuarios`, pelo console do Firebase. `/demanda conferir` mostra a situação.

## Quando algo não chega

- **Botão dá "falha"/nada acontece** → Vercel → projeto → **Logs**, filtre por `/api/slack`.
  401 = Signing Secret errado ou faltando.
- **Card não atualiza quando mexem no app** → é a parte C: o gatilho está publicado?
  `npx firebase-tools functions:log`.
- **Resumo não veio** → Vercel → **Settings → Cron Jobs** mostra a última execução. No plano
  Hobby o horário oscila dentro da hora (8h–8h59 de Brasília).

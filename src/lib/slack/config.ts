/**
 * O que o bot precisa saber para falar com o Slack. Quem monta é o ponto de entrada:
 * a Vercel lê de variáveis de ambiente (`configDaVercel` em `servidor.ts`), e o
 * Cloud Functions lê de Secret Manager + params (`functions/src/index.ts`).
 */
export interface ConfigSlack {
  /** Bot User OAuth Token, `xoxb-...`. */
  token: string;
  /** ID do canal das demandas (ex.: `C0123ABCD`), não o nome. */
  canalDemandas: string;
  /** ID do canal dos avisos e do resumo diário. Pode ser o mesmo das demandas. */
  canalAvisos: string;
  /** Endereço público do app, para os links. Vazio = mensagens sem link. */
  appUrl: string;
}

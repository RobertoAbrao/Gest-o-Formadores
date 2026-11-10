/**
 * Simula a nuvem: a Vercel e o Cloud Functions rodam em UTC, mas o computador de quem
 * desenvolve costuma estar em Brasília — e aí um teste de fuso passa por sorte.
 * Este módulo é importado ANTES de `fuso.ts`; se alguém tirar o `fuso.ts`, o teste
 * "conta no dia de Brasília" passa a falhar, como falharia em produção.
 */
process.env.TZ = 'UTC';

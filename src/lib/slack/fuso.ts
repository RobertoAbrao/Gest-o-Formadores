/**
 * As datas do negócio são de Brasília, mas a Vercel e o Cloud Functions rodam em UTC.
 *
 * As regras reaproveitadas do app (`alertas.ts`, `diario-utils.ts`) usam `startOfToday()`
 * e `differenceInCalendarDays`, que leem o fuso do processo. Em UTC, às 22h de Brasília
 * já é "amanhã" e uma formação de amanhã viraria "começa hoje".
 *
 * O Node aplica a troca de `process.env.TZ` na hora, inclusive depois de iniciado.
 * Todo ponto de entrada do bot importa este arquivo primeiro.
 */
process.env.TZ = 'America/Sao_Paulo';

export const FUSO = 'America/Sao_Paulo';

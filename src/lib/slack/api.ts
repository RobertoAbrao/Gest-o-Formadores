import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Cliente mínimo da Web API do Slack (https://api.slack.com/web).
 *
 * Por que não o `@slack/web-api`: são quatro ou cinco métodos, e o mesmo código roda
 * na Vercel e no Cloud Functions. Um `fetch` não traz dependência nem versão para alinhar.
 */

export class ErroSlack extends Error {
  constructor(
    public readonly metodo: string,
    public readonly codigo: string,
  ) {
    super(`Slack ${metodo}: ${codigo}`);
  }
}

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chama um método da Web API. Manda como formulário (e não JSON) porque todo método
 * aceita formulário, e os de leitura (`users.info`, `users.list`) não aceitam JSON.
 * Objetos (`blocks`, `view`) vão serializados em JSON dentro do campo.
 *
 * Em 429 (limite de taxa) espera o `Retry-After` e tenta de novo, até 3 vezes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chamarSlack<T = any>(
  token: string,
  metodo: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const corpo = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null) continue;
    corpo.set(chave, typeof valor === 'string' ? valor : JSON.stringify(valor));
  }

  for (let tentativa = 0; ; tentativa++) {
    const resposta = await fetch(`https://slack.com/api/${metodo}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body: corpo.toString(),
    });

    if (resposta.status === 429 && tentativa < 3) {
      const segundos = Number(resposta.headers.get('retry-after') ?? '1');
      await espera(Math.min(Number.isFinite(segundos) ? segundos : 1, 10) * 1000);
      continue;
    }

    const json = (await resposta.json()) as { ok: boolean; error?: string };
    if (!json.ok) throw new ErroSlack(metodo, json.error ?? `http_${resposta.status}`);
    return json as T;
  }
}

/**
 * Confere se a requisição veio mesmo do Slack
 * (https://api.slack.com/authentication/verifying-requests-from-slack).
 *
 * O Slack assina `v0:<timestamp>:<corpo cru>` com o Signing Secret do app. Sem esta
 * conferência, qualquer pessoa que descobrir a URL pode criar ou concluir demandas.
 * O limite de 5 minutos impede reaproveitar uma requisição antiga capturada.
 */
export function assinaturaValida(
  segredo: string,
  timestamp: string | null,
  assinatura: string | null,
  corpoCru: string,
  agoraMs: number = Date.now(),
): boolean {
  if (!segredo || !timestamp || !assinatura) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(agoraMs / 1000 - ts) > 300) return false;

  const esperado = `v0=${createHmac('sha256', segredo).update(`v0:${timestamp}:${corpoCru}`).digest('hex')}`;
  const a = Buffer.from(esperado);
  const b = Buffer.from(assinatura);
  return a.length === b.length && timingSafeEqual(a, b);
}

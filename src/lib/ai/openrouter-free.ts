/**
 * Cliente do OpenRouter restrito a modelos gratuitos.
 *
 * Regra do projeto: nenhuma chamada pode gerar cobrança. A garantia é dupla —
 * a lista abaixo só contém modelos com preço zero E toda requisição passa por
 * `garantirGratuito`, que lança erro antes do fetch se o id do modelo não for
 * comprovadamente gratuito. Não adicione um modelo aqui sem confirmar em
 * https://openrouter.ai/api/v1/models que `pricing.prompt` e
 * `pricing.completion` são "0".
 */

/** Roteador oficial que sorteia entre os modelos gratuitos disponíveis. */
const ROTEADOR_GRATUITO = 'openrouter/free';

/**
 * Cascata usada quando o roteador falha. Todos suportam tool calling e foram
 * verificados com preço "0"/"0" em 19/08/2026.
 */
export const MODELOS_GRATUITOS = [
  ROTEADOR_GRATUITO,
  'z-ai/glm-5.2:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b:free',
] as const;

/**
 * Modelos da cascata com tool calling confirmado — é o que o agente precisa.
 * Hoje coincide com a lista inteira; existe separado para que a inclusão de um
 * modelo gratuito sem suporte a ferramentas não quebre o `/agente`.
 */
export const MODELOS_GRATUITOS_COM_TOOLS = MODELOS_GRATUITOS;

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 60_000;

export class ModeloPagoBloqueadoError extends Error {
  constructor(modelo: string) {
    super(`Modelo "${modelo}" bloqueado: este projeto só usa modelos gratuitos.`);
    this.name = 'ModeloPagoBloqueadoError';
  }
}

/**
 * Trava final: só passa o roteador gratuito ou ids com sufixo `:free`.
 * O erro é fatal de propósito — pedir um modelo pago é bug de código, não
 * indisponibilidade, e seguir para o próximo da lista esconderia isso.
 */
function garantirGratuito(modelo: string): void {
  if (modelo !== ROTEADOR_GRATUITO && !modelo.endsWith(':free')) {
    const erro = new ModeloPagoBloqueadoError(modelo);
    (erro as any).fatal = true;
    throw erro;
  }
}

export class OpenRouterIndisponivelError extends Error {
  constructor(mensagem: string, readonly causa?: unknown) {
    super(mensagem);
    this.name = 'OpenRouterIndisponivelError';
  }
}

export interface MensagemChat {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  [extra: string]: unknown;
}

export interface OpcoesChat {
  messages: MensagemChat[];
  tools?: unknown[];
  toolChoice?: 'auto' | 'none';
  temperature?: number;
  /** Restringe a cascata, ex.: só modelos com tool calling comprovado. */
  modelos?: readonly string[];
}

export function temChaveOpenRouter(): boolean {
  return !!process.env.OPENROUTER_API_KEY?.trim();
}

async function chamarModelo(modelo: string, opcoes: OpcoesChat): Promise<any> {
  garantirGratuito(modelo);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'X-Title': 'Gestão de Formadores',
      },
      body: JSON.stringify({
        model: modelo,
        messages: opcoes.messages,
        ...(opcoes.tools?.length
          ? { tools: opcoes.tools, tool_choice: opcoes.toolChoice ?? 'auto' }
          : {}),
        ...(opcoes.temperature !== undefined ? { temperature: opcoes.temperature } : {}),
        // Teto de preço no próprio OpenRouter: ele recusa qualquer rota que
        // custe mais que zero. É a terceira trava, junto da lista fixa de
        // modelos e do `garantirGratuito`.
        provider: { max_price: { prompt: 0, completion: 0 } },
      }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
      const erro = new Error(`OpenRouter ${resposta.status}: ${corpo.slice(0, 300)}`);
      // 401/403 = chave inválida e 402 = exigiria saldo: nesses casos trocar de
      // modelo não resolve, então o erro sobe imediatamente.
      (erro as any).fatal = [401, 402, 403].includes(resposta.status);
      throw erro;
    }

    return await resposta.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Percorre a cascata gratuita até um modelo responder. Erros de credencial ou
 * de saldo interrompem na hora; indisponibilidade e limite de uso seguem adiante.
 */
export async function chatGratuito(opcoes: OpcoesChat): Promise<any> {
  if (!temChaveOpenRouter()) {
    throw new OpenRouterIndisponivelError('OPENROUTER_API_KEY não está configurada.');
  }

  const cascata = opcoes.modelos ?? MODELOS_GRATUITOS;
  let ultimoErro: unknown;

  for (const modelo of cascata) {
    try {
      return await chamarModelo(modelo, opcoes);
    } catch (erro) {
      ultimoErro = erro;
      if (erro instanceof ModeloPagoBloqueadoError) throw erro;
      if ((erro as any)?.fatal) break;
      console.warn(`[openrouter] modelo gratuito "${modelo}" indisponível, tentando o próximo.`);
    }
  }

  throw new OpenRouterIndisponivelError(
    `Nenhum modelo gratuito respondeu (${cascata.length} tentativas).`,
    ultimoErro,
  );
}

/** Atalho para geração de texto simples: devolve só o conteúdo da resposta. */
export async function gerarTextoGratuito(
  prompt: string,
  opcoes: { temperature?: number; system?: string } = {},
): Promise<string> {
  const messages: MensagemChat[] = [];
  if (opcoes.system) messages.push({ role: 'system', content: opcoes.system });
  messages.push({ role: 'user', content: prompt });

  const resposta = await chatGratuito({ messages, temperature: opcoes.temperature });
  const texto = resposta?.choices?.[0]?.message?.content;

  if (typeof texto !== 'string' || !texto.trim()) {
    throw new OpenRouterIndisponivelError('O modelo gratuito devolveu uma resposta vazia.');
  }
  return texto.trim();
}

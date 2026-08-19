import { ai } from '@/ai/genkit';
import { gerarTextoGratuito, temChaveOpenRouter } from '@/lib/ai/openrouter-free';

const MODELO_PRIMARIO = 'googleai/gemini-2.5-flash';

/**
 * Gera texto pelo Gemini e, se ele falhar (cota, indisponibilidade, chave
 * ausente), repete o pedido em um modelo gratuito do OpenRouter.
 *
 * O fallback nunca escolhe um modelo pago — ver `lib/ai/openrouter-free`.
 */
export async function gerarTextoComFallback(
  prompt: string,
  config: { temperature?: number } = {},
): Promise<string> {
  try {
    const { text } = await ai.generate({
      model: MODELO_PRIMARIO,
      prompt,
      ...(config.temperature !== undefined ? { config: { temperature: config.temperature } } : {}),
    });

    const limpo = text?.trim();
    if (limpo) return limpo;
    throw new Error('O modelo primário devolveu uma resposta vazia.');
  } catch (erro) {
    if (!temChaveOpenRouter()) throw erro;

    console.warn('[ia] Gemini indisponível, usando modelo gratuito do OpenRouter.', erro);
    return gerarTextoGratuito(prompt, { temperature: config.temperature });
  }
}

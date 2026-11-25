/**
 * Prepara um arquivo para ir DENTRO de um documento da coleção `anexos`.
 *
 * Como os anexos são guardados: o arquivo vira texto base64 (data URL) no campo `url`
 * do documento. Não há Firebase Storage — o projeto está no plano Spark, e bucket novo
 * de Storage exige Blaze. O custo disso é o limite do Firestore: 1 MiB (1.048.576 bytes)
 * por documento, e base64 ocupa ~4/3 do arquivo. Foto de celular (2–5 MB) não cabe;
 * por isso imagens grandes são reduzidas no navegador antes de gravar.
 *
 * Histórico: até 25/11/2026 nada disso existia; a foto era recusada pelo Firestore e o
 * form ainda dizia "Anexo enviado" (caso Sumaré — ver enviar-anexo.ts).
 */

/** Firestore recusa documento acima disto. */
export const LIMITE_DOCUMENTO_FIRESTORE = 1_048_576;

/**
 * Teto para a data URL. A folga até o limite do documento cobre os outros campos
 * (nome do arquivo, ids, etapa, data) e os nomes dos campos, que também contam.
 */
export const LIMITE_DATA_URL = 1_000_000;

/**
 * Degraus de redução, do mais fiel ao mais enxuto. 1600 px no lado maior ainda lê bem
 * impresso em meia página (a linha do tempo é impressa); quase toda foto cabe já no 1º.
 */
export const DEGRAUS_DE_REDUCAO = [
  { ladoMaximo: 1600, qualidade: 0.82 },
  { ladoMaximo: 1280, qualidade: 0.78 },
  { ladoMaximo: 1024, qualidade: 0.72 },
  { ladoMaximo: 800, qualidade: 0.65 },
] as const;

export type LerDataUrl = (arquivo: File) => Promise<string>;
/** Devolve a imagem redesenhada como data URL JPEG. Só existe no navegador (canvas). */
export type ReduzirImagem = (arquivo: File, ladoMaximo: number, qualidade: number) => Promise<string>;

/** Recusa com mensagem pronta para mostrar a quem está anexando. */
export class AnexoRecusadoError extends Error {
  constructor(mensagem: string, options?: { cause?: unknown }) {
    super(mensagem, options);
    this.name = 'AnexoRecusadoError';
  }
}

/** Quantos caracteres a data URL do arquivo vai ter, sem precisar ler o arquivo. */
export function tamanhoDaDataUrl(bytes: number, tipo: string): number {
  return `data:${tipo || 'application/octet-stream'};base64,`.length + 4 * Math.ceil(bytes / 3);
}

/** Largura e altura que cabem em `ladoMaximo` mantendo a proporção. Nunca amplia. */
export function dimensoesReduzidas(largura: number, altura: number, ladoMaximo: number) {
  const escala = Math.min(1, ladoMaximo / Math.max(largura, altura, 1));
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

const emMB = (bytes: number) =>
  (bytes / 1024 / 1024).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export async function prepararArquivoParaFirestore(
  arquivo: File,
  deps: { lerDataUrl: LerDataUrl; reduzirImagem: ReduzirImagem },
): Promise<{ url: string; reduzida: boolean }> {
  // 1. Se cabe como está, vai como está: sem perda, e PNG transparente continua PNG.
  if (tamanhoDaDataUrl(arquivo.size, arquivo.type) <= LIMITE_DATA_URL) {
    const original = await deps.lerDataUrl(arquivo);
    if (original.length <= LIMITE_DATA_URL) return { url: original, reduzida: false };
  }

  // 2. Não cabe. Só imagem dá para reduzir.
  if (!arquivo.type.startsWith('image/')) {
    throw new AnexoRecusadoError(
      `"${arquivo.name}" tem ${emMB(arquivo.size)} MB e o limite para anexos é de cerca de 700 KB. ` +
        'Só imagens são reduzidas automaticamente — reduza o arquivo e envie de novo.',
    );
  }

  // 3. Reduz em degraus até caber.
  for (const { ladoMaximo, qualidade } of DEGRAUS_DE_REDUCAO) {
    let reduzida: string;
    try {
      reduzida = await deps.reduzirImagem(arquivo, ladoMaximo, qualidade);
    } catch (erro) {
      // Ex.: HEIC do iPhone no Chrome — o navegador não decodifica.
      throw new AnexoRecusadoError(
        `Não consegui abrir "${arquivo.name}" para reduzir o tamanho. Salve a imagem como JPG ou PNG e envie de novo.`,
        { cause: erro },
      );
    }
    if (reduzida.length <= LIMITE_DATA_URL) return { url: reduzida, reduzida: true };
  }

  throw new AnexoRecusadoError(
    `"${arquivo.name}" continua com mais de 1 MB mesmo reduzida. Envie uma imagem menor (um print da tela da foto serve).`,
  );
}

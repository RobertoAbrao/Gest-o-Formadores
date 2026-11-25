import { dimensoesReduzidas, type LerDataUrl, type ReduzirImagem } from './preparar-arquivo';

/**
 * As duas peças de navegador que `prepararArquivoParaFirestore` recebe.
 *
 * Só rodam no browser (FileReader, Image, canvas), por isso não têm teste automático:
 * a verificação manual está em REGRESSOES.md. A regra de quando e quanto reduzir fica
 * em preparar-arquivo.ts, que é testada.
 */

export const lerArquivoComoDataUrl: LerDataUrl = (arquivo) =>
  new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('O navegador não conseguiu decodificar a imagem.'));
    img.src = src;
  });
}

/**
 * Redesenha a imagem num canvas menor e exporta como JPEG.
 *
 * - Usa <img> e não createImageBitmap: o <img> respeita a orientação EXIF em todos os
 *   navegadores atuais, então foto de celular "em pé" não sai deitada.
 * - Pinta o fundo de branco antes: JPEG não tem transparência e, sem isso, a área
 *   transparente de um PNG grande (brasão) sairia preta.
 */
export const reduzirImagemNoNavegador: ReduzirImagem = async (arquivo, ladoMaximo, qualidade) => {
  const endereco = URL.createObjectURL(arquivo);
  try {
    const img = await carregarImagem(endereco);
    const { largura, altura } = dimensoesReduzidas(img.naturalWidth, img.naturalHeight, ladoMaximo);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(img, 0, 0, largura, altura);
    return canvas.toDataURL('image/jpeg', qualidade);
  } finally {
    URL.revokeObjectURL(endereco);
  }
};

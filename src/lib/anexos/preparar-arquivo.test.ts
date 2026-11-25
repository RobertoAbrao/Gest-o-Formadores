/**
 * Regressão — foto de celular recusada pelo Firestore (linha do tempo de Sumaré, 25/11/2026).
 *
 * A imagem vai DENTRO do documento de `anexos`, como texto base64 (data URL), e o
 * Firestore recusa documento acima de 1 MiB. Base64 ocupa ~4/3 do arquivo: qualquer
 * foto acima de ~750 KB estourava. Foto de celular passa disso quase sempre. Uma foto
 * de 700 KB entrou — no limite.
 *
 * Por que não Firebase Storage: o projeto está no plano Spark, e bucket novo de
 * Storage exige Blaze. Então a imagem é reduzida no navegador até caber.
 *
 * A redução de verdade (canvas) só roda no navegador — a verificação manual dela está
 * em REGRESSOES.md. Aqui ela é um dublê que devolve textos de tamanho conhecido.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITE_DATA_URL, prepararArquivoParaFirestore, type ReduzirImagem } from './preparar-arquivo';

const KB = 1024;

/** Arquivo com `bytes` bytes de verdade — o tamanho é o que importa aqui. */
const arquivo = (nome: string, tipo: string, bytes: number) => new File([new Uint8Array(bytes)], nome, { type: tipo });

/** Lê como o FileReader leria: prefixo + base64 (4 caracteres a cada 3 bytes). */
const lerDataUrl = async (f: File) => `data:${f.type};base64,` + 'A'.repeat(4 * Math.ceil(f.size / 3));

/** Dublê do canvas: devolve um JPEG cujo tamanho depende do lado máximo pedido. */
function reducaoQueDevolve(tamanhoPorLado: (ladoMaximo: number) => number) {
  const chamadas: Array<{ ladoMaximo: number; qualidade: number }> = [];
  const reduzir: ReduzirImagem = async (_f, ladoMaximo, qualidade) => {
    chamadas.push({ ladoMaximo, qualidade });
    return 'data:image/jpeg;base64,' + 'A'.repeat(tamanhoPorLado(ladoMaximo));
  };
  return { reduzir, chamadas };
}

test('Sumaré 25/11/2026: foto de celular de 3 MB é reduzida até caber no documento do Firestore', async () => {
  // Reduções maiores ainda não cabem; a partir de 1280 px cabe.
  const { reduzir, chamadas } = reducaoQueDevolve((lado) => (lado > 1280 ? 1_400_000 : 600_000));
  const r = await prepararArquivoParaFirestore(arquivo('foto-sumare.jpg', 'image/jpeg', 3 * 1024 * KB), {
    lerDataUrl,
    reduzirImagem: reduzir,
  });
  assert.ok(r.url.length <= LIMITE_DATA_URL, `esperado até ${LIMITE_DATA_URL} caracteres, veio ${r.url.length}`);
  assert.equal(r.reduzida, true);
  assert.ok(chamadas.length >= 1, 'a imagem não passou pela redução');
});

test('Sumaré 25/11/2026: a foto de 700 KB que funcionou continua indo do jeito que veio, sem redução', async () => {
  const { reduzir, chamadas } = reducaoQueDevolve(() => 1);
  const r = await prepararArquivoParaFirestore(arquivo('foto-700kb.jpg', 'image/jpeg', 700 * KB), {
    lerDataUrl,
    reduzirImagem: reduzir,
  });
  assert.equal(r.reduzida, false);
  assert.equal(chamadas.length, 0);
  assert.equal(r.url, await lerDataUrl(arquivo('foto-700kb.jpg', 'image/jpeg', 700 * KB)));
});

test('imagem que nem a menor redução faz caber: recusa com mensagem que diz o nome e o limite', async () => {
  const { reduzir } = reducaoQueDevolve(() => 2_000_000);
  await assert.rejects(
    prepararArquivoParaFirestore(arquivo('panorama.png', 'image/png', 8 * 1024 * KB), { lerDataUrl, reduzirImagem: reduzir }),
    (e: Error) => /panorama\.png/.test(e.message) && /1 MB/.test(e.message),
  );
});

test('arquivo grande que não é imagem: recusa com mensagem clara, sem tentar reduzir', async () => {
  const { reduzir, chamadas } = reducaoQueDevolve(() => 1);
  await assert.rejects(
    prepararArquivoParaFirestore(arquivo('ata.pdf', 'application/pdf', 2 * 1024 * KB), { lerDataUrl, reduzirImagem: reduzir }),
    (e: Error) => /ata\.pdf/.test(e.message) && /MB/.test(e.message),
  );
  assert.equal(chamadas.length, 0);
});

test('imagem grande que o navegador não consegue abrir (ex.: HEIC no Chrome): pede JPG ou PNG', async () => {
  const reduzir: ReduzirImagem = async () => {
    throw new Error('EncodingError: The source image cannot be decoded.');
  };
  await assert.rejects(
    prepararArquivoParaFirestore(arquivo('IMG_0001.HEIC', 'image/heic', 3 * 1024 * KB), { lerDataUrl, reduzirImagem: reduzir }),
    (e: Error) => /IMG_0001\.HEIC/.test(e.message) && /JPG ou PNG/.test(e.message),
  );
});

test('borda do limite: data URL com exatamente o limite vai como veio; um byte a mais é reduzida', async () => {
  const prefixo = 'data:image/png;base64,'.length;
  const exata = async () => 'data:image/png;base64,' + 'A'.repeat(LIMITE_DATA_URL - prefixo);
  const umAMais = async () => 'data:image/png;base64,' + 'A'.repeat(LIMITE_DATA_URL - prefixo + 1);
  const f = arquivo('brasao.png', 'image/png', 10);

  const a = reducaoQueDevolve(() => 10);
  const r1 = await prepararArquivoParaFirestore(f, { lerDataUrl: exata, reduzirImagem: a.reduzir });
  assert.equal(r1.reduzida, false);
  assert.equal(a.chamadas.length, 0);

  const b = reducaoQueDevolve(() => 10);
  const r2 = await prepararArquivoParaFirestore(f, { lerDataUrl: umAMais, reduzirImagem: b.reduzir });
  assert.equal(r2.reduzida, true);
  assert.ok(r2.url.length <= LIMITE_DATA_URL);
});

test('dimensões reduzidas: mantêm a proporção em pé e deitada, e nunca ampliam imagem pequena', async () => {
  const { dimensoesReduzidas } = await import('./preparar-arquivo');
  assert.deepEqual(dimensoesReduzidas(4000, 3000, 1600), { largura: 1600, altura: 1200 });
  assert.deepEqual(dimensoesReduzidas(3000, 4000, 1600), { largura: 1200, altura: 1600 });
  assert.deepEqual(dimensoesReduzidas(800, 600, 1600), { largura: 800, altura: 600 });
  assert.deepEqual(dimensoesReduzidas(1600, 1600, 1600), { largura: 1600, altura: 1600 });
  assert.deepEqual(dimensoesReduzidas(10000, 10, 800), { largura: 800, altura: 1 });
});

test('a conta do tamanho sem ler o arquivo bate com um base64 de verdade', async () => {
  const { tamanhoDaDataUrl } = await import('./preparar-arquivo');
  for (const bytes of [0, 1, 2, 3, 700 * KB, 3 * 1024 * KB + 1]) {
    const f = arquivo('x.jpg', 'image/jpeg', bytes);
    const real = 'data:image/jpeg;base64,' + Buffer.from(await f.arrayBuffer()).toString('base64');
    assert.equal(tamanhoDaDataUrl(bytes, 'image/jpeg'), real.length, `${bytes} bytes`);
  }
  // Sem tipo, o FileReader usa application/octet-stream.
  assert.equal(tamanhoDaDataUrl(3, ''), 'data:application/octet-stream;base64,'.length + 4);
});

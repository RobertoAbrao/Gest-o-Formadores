/**
 * Regressão — "imagem salva" que não salvava (linha do tempo de Sumaré, 25/11/2026).
 *
 * O que aconteceu: a Alessandra anexava uma foto numa etapa do projeto Sumaré, via
 * "Anexo enviado" e a imagem nunca aparecia. A foto passava do limite de 1 MB por
 * documento do Firestore e era recusada — mas o formulário (form-projeto.tsx)
 * disparava o `setDoc` SEM esperar a resposta e mostrava o sucesso na hora. A
 * recusa ia só para o console. Com uma foto de 700 KB deu certo, o que confirmou
 * a causa.
 *
 * Por que nada pegou: não havia teste nenhum no app, e o envio não tinha como ser
 * testado — a gravação estava enterrada dentro do componente.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase/firestore';
import { enviarAnexo, type EnviarAnexoParams } from './enviar-anexo';

const AGORA = Timestamp.fromDate(new Date('2026-11-25T15:00:00Z'));

function params(extra: Partial<EnviarAnexoParams> = {}): EnviarAnexoParams {
  return {
    arquivo: new File(['x'], 'foto-sumare.jpg', { type: 'image/jpeg' }),
    vinculo: { projetoId: 'sumare', etapa: 'simulados.s1', autorId: 'alessandra' },
    preparar: async () => 'data:image/jpeg;base64,eA==',
    novoId: () => 'anexo-1',
    gravar: async () => {},
    agora: () => AGORA,
    ...extra,
  };
}

test('Sumaré 25/11/2026: não diz "Anexo enviado" antes de o Firestore confirmar a gravação', async () => {
  let confirmarGravacao!: () => void;
  const gravacao = new Promise<void>((resolve) => (confirmarGravacao = resolve));

  let terminou = false;
  const envio = enviarAnexo(params({ gravar: () => gravacao })).then(() => (terminou = true));

  // Dá tempo para tudo o que não depende do banco acontecer.
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(terminou, false, 'o envio terminou com a gravação ainda pendente no Firestore');

  confirmarGravacao();
  await envio;
  assert.equal(terminou, true);
});

test('Sumaré 25/11/2026: quando o Firestore recusa o documento, o envio falha — não finge sucesso', async () => {
  const recusa = Object.assign(new Error('Document exceeds the maximum allowed size'), { code: 'invalid-argument' });
  await assert.rejects(enviarAnexo(params({ gravar: async () => { throw recusa; } })), recusa);
});

test('arquivo recusado na preparação (grande demais) não chega a ser gravado', async () => {
  let gravou = false;
  await assert.rejects(
    enviarAnexo(
      params({
        preparar: async () => { throw new Error('grande demais'); },
        gravar: async () => { gravou = true; },
      }),
    ),
    /grande demais/,
  );
  assert.equal(gravou, false);
});

test('grava nome, url, data e o vínculo com a etapa, e devolve o id do documento', async () => {
  const gravados: unknown[] = [];
  const r = await enviarAnexo(params({ gravar: async (id, dados) => { gravados.push({ id, dados }); } }));
  const esperado = {
    projetoId: 'sumare',
    etapa: 'simulados.s1',
    autorId: 'alessandra',
    nome: 'foto-sumare.jpg',
    url: 'data:image/jpeg;base64,eA==',
    dataUpload: AGORA,
  };
  assert.deepEqual(gravados, [{ id: 'anexo-1', dados: esperado }]);
  assert.deepEqual(r, { id: 'anexo-1', anexo: esperado });
});

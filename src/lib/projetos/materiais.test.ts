/**
 * Material do projeto: lista fixa sem perder o que já estava gravado (25/11/2026).
 *
 * Antes, "Material" em Projetos > Editar era texto livre. Passou a ser uma lista fixa
 * dos produtos da Editora LT, com vários por projeto. O campo no Firestore continua
 * o mesmo (`material`, texto "Sabe, Conecta Enem") para não exigir migração.
 *
 * O que estes testes travam: texto antigo que não é produto do catálogo NUNCA some
 * sozinho — nem ao abrir, nem ao marcar outro produto. Só sai se alguém desmarcar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIAIS_CATALOGO,
  SELOS_MATERIAIS,
  alternarMaterial,
  conferirMateriaisNovos,
  escreverMateriais,
  lerMateriais,
} from './materiais';

test('catálogo: os 11 produtos do menu do site, na ordem do site', () => {
  assert.deepEqual(MATERIAIS_CATALOGO, [
    'Sabe', 'Revisão dos Saberes', 'Conecta Enem', 'Livros Técnicos',
    'Lúmina', 'Robô Garden', 'Trânsito', 'Povos do Brasil', 'Orquestrando', 'Mundo Sustentável',
    'Peripécias',
  ]);
  assert.deepEqual(SELOS_MATERIAIS.map((s) => s.selo), ['Horizontes', 'Gralha Azul', 'Serelepes']);
});

test('valor já no formato novo volta idêntico (ler e escrever não mexem em nada)', () => {
  const gravado = 'Sabe, Conecta Enem, Peripécias';
  assert.equal(escreverMateriais(lerMateriais(gravado)), gravado);
});

test('vazio, nulo e só vírgulas viram lista vazia e texto vazio', () => {
  for (const v of [undefined, null, '', '   ', ', ,']) {
    assert.deepEqual(lerMateriais(v), [], `entrada ${JSON.stringify(v)}`);
  }
  assert.equal(escreverMateriais([]), '');
});

test('texto antigo livre é preservado como "texto antigo", sem virar produto', () => {
  assert.deepEqual(lerMateriais('Apostila própria do município'), [
    { nome: 'Apostila própria do município', doCatalogo: false },
  ]);
});

test('grafia diferente de um produto é reconhecida e ganha o nome oficial', () => {
  assert.deepEqual(lerMateriais('SABE,  lumina , conecta   enem, ROBO GARDEN'), [
    { nome: 'Sabe', doCatalogo: true },
    { nome: 'Lúmina', doCatalogo: true },
    { nome: 'Conecta Enem', doCatalogo: true },
    { nome: 'Robô Garden', doCatalogo: true },
  ]);
});

test('repetido conta uma vez só, mesmo com grafia diferente', () => {
  assert.equal(escreverMateriais(lerMateriais('Sabe, sabe, SABE')), 'Sabe');
});

test('marcar um produto mantém o texto antigo que já estava lá', () => {
  assert.equal(alternarMaterial('Apostila própria', 'Sabe'), 'Sabe, Apostila própria');
});

test('marcar e desmarcar produtos: grava na ordem do catálogo, não na ordem do clique', () => {
  let v = alternarMaterial('', 'Peripécias');
  v = alternarMaterial(v, 'Sabe');
  assert.equal(v, 'Sabe, Peripécias');
  v = alternarMaterial(v, 'Peripécias');
  assert.equal(v, 'Sabe');
  v = alternarMaterial(v, 'Sabe');
  assert.equal(v, '');
});

test('desmarcar o texto antigo é o único jeito de ele sair', () => {
  assert.equal(alternarMaterial('Sabe, Apostila própria', 'Apostila própria'), 'Sabe');
});

test('desmarcar reconhece o produto escrito do jeito antigo ("SABE")', () => {
  assert.equal(alternarMaterial('SABE, Lúmina', 'Sabe'), 'Lúmina');
});

test('IA: aceita só produtos do catálogo e devolve a grafia oficial', () => {
  assert.deepEqual(conferirMateriaisNovos('conecta enem, sabe'), { valor: 'Sabe, Conecta Enem', foraDaLista: [] });
  assert.deepEqual(conferirMateriaisNovos(undefined), { valor: undefined, foraDaLista: [] });
  assert.deepEqual(conferirMateriaisNovos('Sabe, Livro do Professor'), {
    valor: 'Sabe, Livro do Professor',
    foraDaLista: ['Livro do Professor'],
  });
});

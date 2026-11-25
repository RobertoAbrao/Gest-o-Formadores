/**
 * Anos comprados por material (25/11/2026).
 *
 * A equipe registrava à mão textos como "TODOS OS ANOS - 1° AO 9° ANO - LP E MAT +
 * LIVRO DO COORDENADOR". Agora marca anos, componentes e o Livro do Coordenador por
 * material, e o resumo é montado a partir disso. Estes testes travam o texto do resumo
 * e a regra do que vai para o banco (só material ainda marcado, sem compra vazia).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompraMaterial } from '@/lib/types';
import {
  ANOS_FUNDAMENTAL,
  atualizarCompra,
  compraDe,
  limparCompras,
  linhasCompra,
  resumirAnos,
  resumirCompra,
} from './compra-material';

const compra = (material: string, extra: Partial<CompraMaterial> = {}): CompraMaterial => ({
  material,
  anos: [],
  componentes: [],
  ...extra,
});

test('o exemplo da equipe: 1º ao 9º, LP e MAT, com Livro do Coordenador', () => {
  assert.equal(
    resumirCompra(compra('Sabe', { anos: [...ANOS_FUNDAMENTAL], componentes: ['LP', 'MAT'], livroCoordenador: true })),
    'Todos os anos (1º ao 9º) - LP e MAT + Livro do Coordenador'
  );
});

test('anos: faixas, pares e soltos', () => {
  assert.equal(resumirAnos(['1', '2', '3', '4', '5']), '1º ao 5º ano');
  assert.equal(resumirAnos(['6', '7', '8', '9']), '6º ao 9º ano');
  assert.equal(resumirAnos(['5']), '5º ano');
  assert.equal(resumirAnos(['1', '2']), '1º e 2º ano');
  assert.equal(resumirAnos(['1', '2', '3', '5']), '1º ao 3º e 5º ano');
  assert.equal(resumirAnos(['1', '2', '3', '7', '8', '9']), '1º ao 3º e 7º ao 9º ano');
  assert.equal(resumirAnos(['2', '4', '6']), '2º, 4º e 6º ano');
});

test('anos: a ordem do clique não importa', () => {
  assert.equal(resumirAnos(['3', '1', '2']), '1º ao 3º ano');
});

test('anos: Educação Infantil sozinha e junto com o Fundamental', () => {
  assert.equal(resumirAnos(['EI']), 'Educação Infantil');
  assert.equal(resumirAnos(['EI', '1', '2', '3']), 'Educação Infantil e 1º ao 3º ano');
  // "Todos os anos" fala só do Fundamental; com o Infantil junto, a faixa fica explícita.
  assert.equal(resumirAnos(['EI', ...ANOS_FUNDAMENTAL]), 'Educação Infantil e 1º ao 9º ano');
});

test('componentes: ordem oficial LP, MAT, CN, CH', () => {
  assert.equal(resumirCompra(compra('Sabe', { componentes: ['CH', 'LP', 'CN', 'MAT'] })), 'LP, MAT, CN e CH');
});

test('resumo parcial: falta ano, falta componente, só o livro, nada', () => {
  assert.equal(resumirCompra(compra('Sabe', { componentes: ['LP'] })), 'LP');
  assert.equal(resumirCompra(compra('Sabe', { anos: ['1'] })), '1º ano');
  assert.equal(resumirCompra(compra('Sabe', { livroCoordenador: true })), 'Livro do Coordenador');
  assert.equal(resumirCompra(compra('Sabe')), '');
  assert.equal(resumirCompra(undefined), '');
});

test('código desconhecido ou repetido é ignorado', () => {
  assert.equal(resumirAnos(['1', '1', '10', 'X', '2']), '1º e 2º ano');
});

test('atualizar a compra de um material não mexe na dos outros', () => {
  let compras = atualizarCompra([], 'Sabe', { anos: ['1'] });
  compras = atualizarCompra(compras, 'Peripécias', { anos: ['EI'] });
  compras = atualizarCompra(compras, 'Sabe', { componentes: ['LP'] });
  assert.deepEqual(compraDe(compras, 'Sabe'), compra('Sabe', { anos: ['1'], componentes: ['LP'] }));
  assert.deepEqual(compraDe(compras, 'Peripécias'), compra('Peripécias', { anos: ['EI'] }));
  assert.deepEqual(compraDe(compras, 'Lúmina'), compra('Lúmina'));
});

test('gravar: só material ainda marcado, sem compra vazia, na ordem do campo Material', () => {
  const compras = [
    compra('Peripécias', { anos: ['EI'] }),
    compra('Sabe', { anos: ['2', '1'], componentes: ['MAT', 'LP'] }),
    compra('Lúmina', { anos: ['3'] }), // desmarcado no campo Material → sai
    compra('Conecta Enem'), // marcado, mas nada preenchido → sai
  ];
  assert.deepEqual(limparCompras(compras, 'Sabe, Conecta Enem, Peripécias'), [
    { material: 'Sabe', anos: ['1', '2'], componentes: ['LP', 'MAT'], livroCoordenador: false },
    { material: 'Peripécias', anos: ['EI'], componentes: [], livroCoordenador: false },
  ]);
});

test('gravar: projeto antigo sem o campo, ou só com texto antigo, grava lista vazia', () => {
  assert.deepEqual(limparCompras(undefined, 'Sabe'), []);
  assert.deepEqual(limparCompras([compra('Sabe', { anos: ['1'] })], 'Apostila própria'), []);
  assert.deepEqual(limparCompras([compra('Sabe', { anos: ['1'] })], undefined), []);
});

test('linhas para telas e IA: uma por material com compra', () => {
  assert.deepEqual(
    linhasCompra('Sabe, Peripécias', [
      compra('Sabe', { anos: [...ANOS_FUNDAMENTAL], componentes: ['LP', 'MAT'], livroCoordenador: true }),
      compra('Peripécias', { anos: ['EI'] }),
    ]),
    ['Sabe: Todos os anos (1º ao 9º) - LP e MAT + Livro do Coordenador', 'Peripécias: Educação Infantil']
  );
  assert.deepEqual(linhasCompra('Sabe', undefined), []);
});

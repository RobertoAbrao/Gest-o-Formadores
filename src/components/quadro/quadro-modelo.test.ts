/**
 * As filas do Dashboard (redesenho de 25/11/2026) abrem o Acompanhamento já filtrado:
 * `/quadro?fila=atrasadas`. Este teste trava o contrato do endereço — se uma fila
 * mudar de id, o link do Dashboard abriria o quadro sem filtro, sem erro nenhum.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filaDoEndereco } from './quadro-modelo';
import { IDS_FILAS_DE_FORMACAO } from '@/lib/dashboard/filas';

test('o link de cada fila do Dashboard abre o Acompanhamento filtrado nela', () => {
  for (const id of IDS_FILAS_DE_FORMACAO) {
    assert.equal(filaDoEndereco(`?fila=${id}`), id);
  }
});

test('fila desconhecida ou ausente no endereço abre o quadro sem filtro', () => {
  assert.equal(filaDoEndereco('?fila=inventada'), null);
  assert.equal(filaDoEndereco('?outra=1'), null);
  assert.equal(filaDoEndereco(''), null);
});

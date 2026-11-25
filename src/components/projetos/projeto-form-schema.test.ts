/**
 * Todo campo do formulário de projeto também é gravado pelo robô guiado (/agente).
 *
 * O robô não usa o `onSubmit`: grava por etapa, recortando o payload com
 * `CHAVES_POR_ETAPA` (e limpa o "sujo" com `CAMPOS_FORM_POR_ETAPA`). Campo novo que
 * entra no formulário e não entra nesses mapas é salvo pela tela de Projetos e
 * perdido em silêncio pelo robô — nenhuma tela avisa.
 *
 * Escrito em 25/11/2026, ao criar `materiaisComprados` (anos comprados por material):
 * estes testes falham se o próximo campo novo esquecer os mapas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProjetoImplatancao } from '@/lib/types';
import {
  CAMPOS_FORM_POR_ETAPA,
  CHAVES_POR_ETAPA,
  buildDefaultValues,
  buildProjetoPayload,
  formSchema,
} from './projeto-form-schema';

const todas = (mapa: Record<string, readonly string[]>) => new Set(Object.values(mapa).flat());

function projeto(extra: Partial<ProjetoImplatancao> = {}): ProjetoImplatancao {
  return { id: 'p1', municipio: 'Sumaré', uf: 'SP', dataMigracao: null, ...extra } as ProjetoImplatancao;
}

test('robô: toda chave que o formulário grava está em alguma etapa (CHAVES_POR_ETAPA)', () => {
  const payload = buildProjetoPayload(buildDefaultValues(projeto()), 'Ana');
  const cobertas = todas(CHAVES_POR_ETAPA);
  const faltando = Object.keys(payload).filter((k) => !cobertas.has(k));
  assert.deepEqual(faltando, [], `o robô não grava: ${faltando.join(', ')}`);
});

test('robô: todo campo do formulário está em alguma etapa (CAMPOS_FORM_POR_ETAPA)', () => {
  const cobertos = todas(CAMPOS_FORM_POR_ETAPA);
  const faltando = Object.keys(formSchema.shape).filter((k) => k !== 'anexo' && !cobertos.has(k));
  assert.deepEqual(faltando, [], `fora das etapas: ${faltando.join(', ')}`);
});

test('anos comprados: abrir e salvar devolve o que estava gravado', () => {
  const materiaisComprados = [
    { material: 'Sabe', anos: ['1', '2', '3'], componentes: ['LP', 'MAT'], livroCoordenador: true },
  ];
  const payload = buildProjetoPayload(buildDefaultValues(projeto({ material: 'Sabe', materiaisComprados })), 'Ana');
  assert.deepEqual(payload.materiaisComprados, materiaisComprados);
});

test('anos comprados: projeto antigo, sem o campo, continua abrindo e salvando', () => {
  const valores = buildDefaultValues(projeto({ material: 'Apostila própria' }));
  assert.deepEqual(valores.materiaisComprados, []);
  const payload = buildProjetoPayload(valores, 'Ana');
  assert.equal(payload.material, 'Apostila própria');
  assert.deepEqual(payload.materiaisComprados, []);
});

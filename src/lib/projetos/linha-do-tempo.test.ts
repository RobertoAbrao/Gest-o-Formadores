/**
 * Regressão — a Implantação sumiu da linha do tempo (achado em 25/11/2026, caso Sumaré).
 *
 * Em 03/2026 o campo `dataImplantacao` virou `dataInicioImplantacao` e, depois, a lista
 * `implantacoes`. A linha do tempo (/projeto-relatorio/[id]) continuou lendo o nome
 * antigo — que o formulário não grava mais. Resultado: desde então nenhum projeto
 * editado mostra a Implantação, nem as imagens anexadas a ela (etapa `implantacoes.N`).
 *
 * Por que nada pegou: o `tsc` acusava "Property 'dataImplantacao' does not exist", mas o
 * build roda com `ignoreBuildErrors: true` e não havia checagem de tipos em lugar nenhum.
 *
 * Datas ao meio-dia UTC: o dia é o mesmo em qualquer fuso do Brasil (teste determinístico).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase/firestore';
import type { Anexo, ProjetoImplatancao } from '@/lib/types';
import { montarLinhaDoTempo } from './linha-do-tempo';

const dia = (iso: string) => Timestamp.fromDate(new Date(`${iso}T12:00:00Z`));
const anexo = (id: string, etapa: string): Anexo => ({
  id,
  etapa,
  nome: `${id}.jpg`,
  url: `data:image/jpeg;base64,${id}`,
  dataUpload: dia('2026-11-25'),
  projetoId: 'sumare',
});

/** Projeto do jeito que o formulário grava hoje (buildProjetoPayload). */
function projeto(extra: Partial<ProjetoImplatancao> = {}): ProjetoImplatancao {
  return {
    id: 'sumare',
    municipio: 'Sumaré',
    uf: 'SP',
    dataMigracao: null,
    ...extra,
  } as ProjetoImplatancao;
}

const implantacoes = (marcos: ReturnType<typeof montarLinhaDoTempo>) => marcos.filter((m) => m.tipo === 'implantacao');

test('Sumaré 25/11/2026: a Implantação gravada no formato atual aparece na linha do tempo, com a imagem anexada', () => {
  const p = projeto({
    implantacoes: [{ titulo: 'Implantação', dataInicio: dia('2026-03-10'), dataFim: dia('2026-03-12'), detalhes: 'Rede municipal', anexosIds: [] }],
    dataInicioImplantacao: dia('2026-03-10'),
  });
  const marcos = montarLinhaDoTempo(p, [anexo('foto-impl', 'implantacoes.0')]);

  const [imp] = implantacoes(marcos);
  assert.ok(imp, 'a Implantação não apareceu na linha do tempo');
  assert.deepEqual(imp.anexos.map((a) => a.id), ['foto-impl']);
  assert.equal(imp.descricao.detalhes, 'Rede municipal');
  assert.equal(imp.ordem.toISOString(), '2026-03-10T12:00:00.000Z');
  assert.equal(imp.data, 'De 10/03/2026 a 12/03/2026');
});

test('várias implantações viram um marco cada, na ordem das datas, cada uma com os seus anexos', () => {
  const p = projeto({
    implantacoes: [
      { titulo: 'Escolas urbanas', dataInicio: dia('2026-05-04'), anexosIds: ['por-id'] },
      { titulo: 'Escolas do campo', dataInicio: dia('2026-04-06') },
    ],
  });
  const marcos = montarLinhaDoTempo(p, [anexo('por-id', 'implantacoes.0'), anexo('da-segunda', 'implantacoes.1')]);

  assert.deepEqual(
    implantacoes(marcos).map((m) => [m.titulo, m.anexos.map((a) => a.id)]),
    [
      ['Escolas do campo', ['da-segunda']],
      ['Escolas urbanas', ['por-id']],
    ],
  );
});

test('anexo aparece mesmo antes de o projeto ser salvo (achado pela etapa) e não aparece duas vezes', () => {
  // O upload grava o anexo na hora; o id só entra em implantacoes[0].anexosIds quando
  // alguém clica em Salvar. Os dois caminhos têm de levar ao mesmo anexo, uma vez só.
  const p = projeto({ implantacoes: [{ dataInicio: dia('2026-03-10'), anexosIds: ['a1'] }] });
  const marcos = montarLinhaDoTempo(p, [anexo('a1', 'implantacoes.0'), anexo('a2', 'implantacoes.0')]);
  assert.deepEqual(implantacoes(marcos)[0].anexos.map((a) => a.id), ['a1', 'a2']);
});

test('projeto antigo (antes de 03/2026, só `dataImplantacao`) continua mostrando a Implantação e a imagem da etapa antiga', () => {
  const p = projeto({ implantacaoDetalhes: 'formato antigo' });
  (p as unknown as { dataImplantacao: Timestamp }).dataImplantacao = dia('2025-09-01');
  const [imp] = implantacoes(montarLinhaDoTempo(p, [anexo('antiga', 'implantacao')]));
  assert.ok(imp, 'a Implantação do projeto antigo sumiu');
  assert.equal(imp.ordem.toISOString(), '2025-09-01T12:00:00.000Z');
  assert.deepEqual(imp.anexos.map((a) => a.id), ['antiga']);
  assert.equal(imp.descricao.detalhes, 'formato antigo');
});

test('projeto de 03/2026 em diante sem a lista (só `dataInicioImplantacao`) também aparece', () => {
  const p = projeto({ dataInicioImplantacao: dia('2026-03-20'), dataFimImplantacao: null });
  const [imp] = implantacoes(montarLinhaDoTempo(p, []));
  assert.equal(imp?.data, '20/03/2026');
});

test('implantação sem data não entra (vale para toda etapa); projeto sem nenhuma data fica vazio', () => {
  const p = projeto({ implantacoes: [{ titulo: 'A definir', dataInicio: null }] });
  assert.deepEqual(montarLinhaDoTempo(p, [anexo('x', 'implantacoes.0')]), []);
});

test('as outras etapas seguem como estavam: simulado pela etapa do anexo, e o marco final por último', () => {
  const p = projeto({
    simulados: { s1: { dataInicio: dia('2026-06-01'), dataFim: dia('2026-06-05'), ok: true, detalhes: '', anexosIds: [] } },
    implantacoes: [{ dataInicio: dia('2026-03-10') }],
  } as unknown as Partial<ProjetoImplatancao>);
  const marcos = montarLinhaDoTempo(p, [anexo('sim', 'simulados.s1')]);
  assert.deepEqual(marcos.map((m) => m.tipo), ['implantacao', 'simulado', 'concluido']);
  assert.deepEqual(marcos[1].anexos.map((a) => a.id), ['sim']);
});

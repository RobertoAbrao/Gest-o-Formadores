/**
 * Regressão — o Dashboard do Administrador escondia trabalho (achado em 25/11/2026,
 * na mesa redonda sobre o Dashboard).
 *
 * O que acontecia (tudo calculado dentro de src/app/(app)/dashboard/page.tsx):
 *  - demanda vencida há 2+ dias saía de todas as listas: a tela só olhava "hoje a +7"
 *    e "ontem" — e o número "Demandas Pendentes" continuava contando ela. Toda
 *    formação concluída cria uma demanda de agradecimento com prazo de 2 dias, que
 *    assim sumia do Dashboard logo depois de vencer;
 *  - demanda sem prazo nunca aparecia;
 *  - formação com "devolutiva" no título era pulada inteira, e com ela os avisos de
 *    logística ("reservar transporte") dos formadores;
 *  - a janela "próximos 7 dias" terminava às 00:00 do 7º dia: evento desse dia com
 *    hora gravada ficava de fora.
 *
 * Por que nada pegou: a regra vivia dentro do componente, misturada com o Firestore,
 * e o projeto não tinha teste nenhum até 25/11/2026.
 *
 * Datas ao meio-dia UTC: o dia é o mesmo em qualquer fuso do Brasil e no CI (UTC).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase/firestore';
import type { Demanda, Formacao, Lembrete, ProjetoImplatancao } from '@/lib/types';
import { agruparAgenda, itensDeOntem, montarAgenda, type EntradaAgenda, type ItemAgenda } from './agenda';
import { contarFilasDeDemanda, contarFilasDeFormacao } from './filas';
import { linkGoogleAgenda } from './google-agenda';

/** Quarta, 25/11/2026, 00:00 no fuso local — o "hoje" de todos os testes. */
const HOJE = new Date(2026, 10, 25);
/** `n` dias a partir de hoje, ao meio-dia UTC. */
const dia = (n: number) => Timestamp.fromDate(new Date(Date.UTC(2026, 10, 25 + n, 12)));

function formacao(extra: Partial<Formacao> = {}): Formacao {
  return {
    id: 'f1',
    codigo: 'REG-1',
    titulo: 'Formação Matemática — 5º ano',
    descricao: '',
    status: 'preparacao',
    municipio: 'Registro',
    uf: 'SP',
    dataInicio: dia(-8),
    dataFim: dia(-6),
    formadoresIds: ['paulo'],
    formadoresNomes: ['Paulo Lima'],
    materiaisIds: [],
    ...extra,
  };
}

function demanda(extra: Partial<Demanda> = {}): Demanda {
  return {
    id: 'd1',
    dataCriacao: dia(-10),
    dataAtualizacao: dia(-10),
    municipio: 'Registro',
    uf: 'SP',
    demanda: 'Enviar lista de presença assinada',
    status: 'Pendente',
    responsavelNome: 'Bruno',
    responsavelId: 'bruno',
    prazo: dia(-5),
    ...extra,
  };
}

function projeto(extra: Partial<ProjetoImplatancao> = {}): ProjetoImplatancao {
  return {
    id: 'p1',
    municipio: 'Sete Barras',
    uf: 'SP',
    dataMigracao: null,
    diagnostica: { data: null },
    simulados: { s1: {}, s2: {}, s3: {}, s4: {} },
    devolutivas: { d1: {}, d2: {}, d3: {}, d4: {} },
    ...extra,
  } as ProjetoImplatancao;
}

function lembrete(extra: Partial<Lembrete> = {}): Lembrete {
  return { id: 'l1', titulo: 'Ligar para a secretaria', data: dia(0), concluido: false, dataCriacao: dia(-1), ...extra };
}

const agenda = (e: Partial<EntradaAgenda>, recemConcluidas?: Set<string>) =>
  montarAgenda({ formacoes: [], demandas: [], projetos: [], lembretes: [], ...e }, HOJE, { recemConcluidas });

const daDemanda = (itens: ItemAgenda[], id = 'd1') => itens.find((i) => i.demandaId === id);
const daFormacao = (itens: ItemAgenda[], id = 'f1') => itens.find((i) => i.tipo === 'formacao' && i.formacaoId === id);
const doProjeto = (itens: ItemAgenda[]) => itens.filter((i) => i.tipo === 'projeto');

// ---------------------------------------------------------------------------
// Demandas
// ---------------------------------------------------------------------------

test('Dashboard 25/11/2026: demanda vencida há 5 dias continua em "Atrasado" (antes sumia depois de 1 dia)', () => {
  const item = daDemanda(agenda({ demandas: [demanda({ prazo: dia(-5) })] }));
  assert.ok(item, 'a demanda vencida sumiu do Dashboard');
  assert.equal(item.grupo, 'atrasado');
  assert.equal(item.quando, 'Venceu há 5 dias');
  assert.equal(item.tom, 'atrasado');
});

test('a demanda de agradecimento criada ao concluir uma formação não some depois que vence', () => {
  const agradecimento = demanda({ demanda: 'Enviar e-mail de agradecimento e feedback', origem: 'automatica', prazo: dia(-10) });
  const item = daDemanda(agenda({ demandas: [agradecimento] }));
  assert.equal(item?.grupo, 'atrasado');
  assert.equal(item?.automatica, true);
});

test('demanda vencida ontem fica em "Atrasado", com "Venceu ontem"', () => {
  const item = daDemanda(agenda({ demandas: [demanda({ prazo: dia(-1) })] }));
  assert.equal(item?.grupo, 'atrasado');
  assert.equal(item?.quando, 'Venceu ontem');
});

test('Dashboard 25/11/2026: demanda sem prazo aparece em "Sem prazo" (antes não aparecia em lugar nenhum)', () => {
  const item = daDemanda(agenda({ demandas: [demanda({ prazo: null })] }));
  assert.ok(item, 'a demanda sem prazo não apareceu');
  assert.equal(item.grupo, 'sem-prazo');
  assert.equal(item.quando, 'Sem prazo');
});

test('demanda concluída ou validada não aparece', () => {
  const itens = agenda({
    demandas: [demanda({ id: 'a', status: 'Concluída' }), demanda({ id: 'b', status: 'Em andamento', validado: true })],
  });
  assert.deepEqual(itens.filter((i) => i.tipo === 'demanda'), []);
});

test('demanda vencendo hoje, amanhã, no 7º dia e no 8º dia', () => {
  const itens = agenda({
    demandas: [
      demanda({ id: 'hoje', prazo: dia(0) }),
      demanda({ id: 'amanha', prazo: dia(1) }),
      demanda({ id: 'setimo', prazo: dia(7) }),
      demanda({ id: 'oitavo', prazo: dia(8) }),
    ],
  });
  const ver = (id: string) => [daDemanda(itens, id)?.grupo, daDemanda(itens, id)?.quando];
  assert.deepEqual(ver('hoje'), ['hoje', 'Vence hoje']);
  assert.deepEqual(ver('amanha'), ['proximos', 'Vence amanhã']);
  assert.deepEqual(ver('setimo'), ['proximos', 'Vence qua, 02/12']);
  assert.deepEqual(ver('oitavo'), ['adiante', 'Vence qui, 03/12']);
});

test('o número da fila de demanda é o que aparece na tela', () => {
  const itens = agenda({
    demandas: [
      demanda({ id: 'v1', prazo: dia(-5) }),
      demanda({ id: 'v2', prazo: dia(-1) }),
      demanda({ id: 's', prazo: null }),
      demanda({ id: 'h', prazo: dia(0) }),
    ],
  });
  assert.deepEqual(contarFilasDeDemanda(itens), { 'dem-vencidas': 2, 'dem-sem-prazo': 1 });
});

test('na mesma data, a demanda urgente vem primeiro', () => {
  const grupos = agruparAgenda(
    agenda({
      demandas: [
        demanda({ id: 'normal', demanda: 'A', prazo: dia(-2) }),
        demanda({ id: 'urgente', demanda: 'B', prazo: dia(-2), prioridade: 'Urgente' }),
      ],
    }),
  );
  assert.deepEqual(grupos.atrasado.map((i) => i.demandaId), ['urgente', 'normal']);
});

// ---------------------------------------------------------------------------
// Janela de 7 dias
// ---------------------------------------------------------------------------

test('Dashboard 25/11/2026: evento no 7º dia entra em "Próximos 7 dias", mesmo gravado ao meio-dia (antes ficava de fora)', () => {
  const [marco] = doProjeto(agenda({ projetos: [projeto({ dataMigracao: dia(7) })] }));
  assert.ok(marco, 'o marco do projeto não apareceu');
  assert.equal(marco.grupo, 'proximos');
  assert.equal(marco.quando, 'qua, 02/12');
});

// ---------------------------------------------------------------------------
// Devolutivas: sem sumir e sem duplicar
// ---------------------------------------------------------------------------

test('Dashboard 25/11/2026: formação com "Devolutiva" no título aparece, e o aviso de logística dela também (antes os dois sumiam)', () => {
  const devolutiva = formacao({
    id: 'fdev',
    titulo: 'Devolutiva 1: Iguape',
    municipio: 'Iguape',
    dataInicio: dia(3),
    dataFim: dia(3),
    logistica: [{ formadorId: 'ana', formadorNome: 'Ana Ribeiro', alertaLembrete: 'Reservar transporte', diasLembrete: 2, checkin: dia(3) }],
  });
  const itens = agenda({ formacoes: [devolutiva] });

  const item = daFormacao(itens, 'fdev');
  assert.ok(item, 'a formação de devolutiva sumiu');
  assert.equal(item.grupo, 'proximos');

  const aviso = itens.find((i) => i.tipo === 'logistica');
  assert.ok(aviso, 'o aviso de logística da devolutiva sumiu');
  assert.equal(aviso.titulo, 'Reservar transporte');
  assert.equal(aviso.quando, 'Amanhã');
  assert.equal(aviso.detalhe, 'para Ana Ribeiro');
});

test('devolutiva do projeto ligada a uma formação aparece uma vez só, pela formação', () => {
  const f = formacao({ id: 'fdev', titulo: 'Devolutiva 1: Iguape', dataInicio: dia(3), dataFim: dia(3) });
  const p = projeto({
    municipio: 'Iguape',
    devolutivas: { d1: { dataInicio: dia(3), dataFim: dia(3), formacaoId: 'fdev' }, d2: {}, d3: {}, d4: {} },
  });
  const itens = agenda({ formacoes: [f], projetos: [p] });
  assert.ok(daFormacao(itens, 'fdev'));
  assert.deepEqual(doProjeto(itens).map((i) => i.titulo), []);
});

test('devolutiva criada pelo Calendário (vínculo gravado só na formação) também não duplica', () => {
  const f = formacao({ id: 'fcal', titulo: 'Devolutiva', projetoId: 'p1', etapaCalendario: 'devolutiva', dataInicio: dia(3), dataFim: dia(4) });
  const p = projeto({ devolutivas: { d1: { dataInicio: dia(3), dataFim: dia(4) }, d2: {}, d3: {}, d4: {} } });
  assert.deepEqual(doProjeto(agenda({ formacoes: [f], projetos: [p] })).map((i) => i.titulo), []);
});

test('devolutiva do projeto que ainda não virou formação aparece como marco do projeto', () => {
  const p = projeto({ devolutivas: { d1: { dataInicio: dia(3), dataFim: dia(3) }, d2: {}, d3: {}, d4: {} } });
  assert.deepEqual(
    doProjeto(agenda({ projetos: [p] })).map((i) => [i.titulo, i.grupo]),
    [['Devolutiva 1 — Sete Barras/SP', 'proximos']],
  );
});

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------

test('a Implantação aparece nos três formatos do banco (lista atual, campo de 03/2026 e campo antigo)', () => {
  const atual = projeto({ id: 'a', implantacoes: [{ titulo: 'Implantação', dataInicio: dia(2), dataFim: dia(2) }] });
  const intermediario = projeto({ id: 'b', dataInicioImplantacao: dia(2) });
  const antigo = projeto({ id: 'c' });
  (antigo as unknown as { dataImplantacao: Timestamp }).dataImplantacao = dia(2);

  const itens = doProjeto(agenda({ projetos: [atual, intermediario, antigo] }));
  assert.deepEqual(
    itens.map((i) => [i.projetoId, i.titulo.split(' — ')[0], i.grupo]),
    [
      ['a', 'Implantação', 'proximos'],
      ['b', 'Implantação', 'proximos'],
      ['c', 'Implantação', 'proximos'],
    ],
  );
});

test('marco de projeto e aviso de logística que já passaram não ficam presos em "Atrasado"', () => {
  const p = projeto({ simulados: { s1: { dataInicio: dia(-30), dataFim: dia(-28) }, s2: {}, s3: {}, s4: {} } });
  const f = formacao({
    id: 'f9',
    dataInicio: dia(5),
    dataFim: dia(5),
    logistica: [{ formadorId: 'x', formadorNome: 'Paulo Lima', alertaLembrete: 'Comprar passagem', diasLembrete: 10, checkin: dia(5) }],
  });
  const itens = agenda({ projetos: [p], formacoes: [f] });
  assert.deepEqual(itens.filter((i) => i.tipo !== 'formacao').map((i) => i.grupo), ['passado', 'passado', 'passado']);
  assert.equal(agruparAgenda(itens).atrasado.length, 0);
});

test('"Ontem" mostra só o que aconteceu ontem e não pede ação', () => {
  const p = projeto({ simulados: { s1: { dataInicio: dia(-3), dataFim: dia(-1) }, s2: {}, s3: {}, s4: {} } });
  const itens = agenda({ projetos: [p], demandas: [demanda({ prazo: dia(-1) })] });
  assert.deepEqual(itensDeOntem(itens, HOJE).map((i) => i.titulo), ['Fim: Simulado 1 — Sete Barras/SP']);
});

// ---------------------------------------------------------------------------
// Formações
// ---------------------------------------------------------------------------

test('formação: encerrada vai para "Atrasado", acontecendo para "Hoje", a realizar para "Próximos"', () => {
  const itens = agenda({
    formacoes: [
      formacao({ id: 'encerrada', dataInicio: dia(-8), dataFim: dia(-6) }),
      formacao({ id: 'acontecendo', dataInicio: dia(-1), dataFim: dia(1) }),
      formacao({ id: 'logo', dataInicio: dia(2), dataFim: dia(3) }),
      formacao({ id: 'longe', dataInicio: dia(14), dataFim: dia(15) }),
    ],
  });
  const ver = (id: string) => [daFormacao(itens, id)?.grupo, daFormacao(itens, id)?.quando];
  assert.deepEqual(ver('encerrada'), ['atrasado', 'Terminou há 6 dias']);
  assert.deepEqual(ver('acontecendo'), ['hoje', 'Acontecendo · até qui, 26/11']);
  assert.deepEqual(ver('logo'), ['proximos', 'Começa sex, 27/11']);
  assert.deepEqual(ver('longe'), ['adiante', 'Começa qua, 09/12']);
});

test('formação concluída sai da agenda; a recém-concluída fica com "falta arquivar"', () => {
  const concluida = formacao({ status: 'concluido' });
  assert.equal(daFormacao(agenda({ formacoes: [concluida] })), undefined);

  const item = daFormacao(agenda({ formacoes: [concluida] }, new Set(['f1'])));
  assert.equal(item?.grupo, 'atrasado');
  assert.equal(item?.quando, 'Concluída · falta arquivar');
});

test('"Falta concluir" e "Sem formador" não contam formação concluída (o card "Formações Ativas" contava)', () => {
  const contagem = contarFilasDeFormacao(
    [
      formacao({ id: 'encerrada', formadoresIds: [] }),
      formacao({ id: 'concluida', status: 'concluido', formadoresIds: [] }),
      formacao({ id: 'arquivada', status: 'arquivado', formadoresIds: [] }),
    ],
    HOJE,
  );
  assert.equal(contagem.atrasadas, 1);
  assert.equal(contagem['sem-formador'], 1);
});

// ---------------------------------------------------------------------------
// Lembretes e Google Agenda
// ---------------------------------------------------------------------------

test('lembrete vencido e não feito fica em "Atrasado", com o nome de quem criou', () => {
  const item = agenda({ lembretes: [lembrete({ data: dia(-2), criadoPorNome: 'Carla Souza' })] }).find((i) => i.tipo === 'lembrete');
  assert.equal(item?.grupo, 'atrasado');
  assert.equal(item?.quando, 'Atrasado há 2 dias');
  assert.equal(item?.detalhe, 'lembrete de Carla');
});

test('link do Google Agenda: evento de dia inteiro, do dia ao dia seguinte; sem data não há link', () => {
  const link = linkGoogleAgenda({ titulo: 'Implantação — Sete Barras/SP', data: new Date(2026, 10, 27), local: '', detalhe: 'Projeto 2026' });
  const params = new URL(link!).searchParams;
  assert.equal(params.get('dates'), '20261127/20261128');
  assert.equal(params.get('text'), 'Implantação — Sete Barras/SP');
  assert.equal(params.get('details'), 'Projeto 2026');
  assert.equal(linkGoogleAgenda({ titulo: 'x', data: null, local: '' }), null);
});

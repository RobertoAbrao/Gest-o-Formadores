import './utc-primeiro';
import '@/lib/slack/fuso';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import type { Demanda, Formacao } from '@/lib/types';
import { assinaturaValida } from '@/lib/slack/api';
import { avisoDeCriacao, avisoDeStatusDaFormacao } from '@/lib/slack/avisos';
import { cardDaDemanda } from '@/lib/slack/card-demanda';
import { sincronizarMudanca } from '@/lib/slack/demandas';
import { lerFormulario, prazoDoFormulario } from '@/lib/slack/modais';
import { montarResumo } from '@/lib/slack/resumo';

/**
 * Rodar: `npm test` dentro de functions/. Não fala com Slack nem com o banco de verdade:
 * o `fetch` e o Firestore são trocados por dublês que anotam o que foi chamado.
 */

const dia = (iso: string) => Timestamp.fromDate(new Date(iso));

const demanda = (extra: Partial<Demanda> = {}): Demanda =>
  ({
    id: 'd1',
    municipio: 'Ribeirão Preto',
    uf: 'SP',
    demanda: 'Enviar <lista> & material',
    status: 'Pendente',
    responsavelId: 'u1',
    responsavelNome: 'Ana',
    prioridade: 'Normal',
    prazo: null,
    historico: [],
    ...extra,
  }) as unknown as Demanda;

// ---------------------------------------------------------------------------

describe('assinatura do Slack', () => {
  const segredo = 'segredo-de-teste';
  const corpo = 'command=%2Fdemanda&text=';
  const agora = 1_800_000_000_000;
  const ts = String(agora / 1000);
  const assinar = (c: string) => `v0=${createHmac('sha256', segredo).update(`v0:${ts}:${c}`).digest('hex')}`;

  it('aceita a assinatura certa', () => assert.equal(assinaturaValida(segredo, ts, assinar(corpo), corpo, agora), true));
  it('recusa corpo adulterado', () => assert.equal(assinaturaValida(segredo, ts, assinar(corpo), `${corpo}x`, agora), false));
  it('recusa requisição com mais de 5 minutos', () =>
    assert.equal(assinaturaValida(segredo, ts, assinar(corpo), corpo, agora + 6 * 60 * 1000), false));
  it('recusa quando o segredo não foi configurado', () => assert.equal(assinaturaValida('', ts, assinar(corpo), corpo, agora), false));
});

describe('card da demanda', () => {
  const rotulos = (d: Demanda) => cardDaDemanda(d, null).blocks[2].elements.map((b: { text: { text: string } }) => b.text.text);

  it('aberta: os outros status + Editar', () =>
    assert.deepEqual(rotulos(demanda()), ['Em andamento', 'Aguardando retorno', 'Concluir', 'Editar']));
  it('concluída: Validar, Reabrir, Editar', () =>
    assert.deepEqual(rotulos(demanda({ status: 'Concluída' })), ['Validar', 'Reabrir', 'Editar']));
  it('validada: Reabrir, Editar', () =>
    assert.deepEqual(rotulos(demanda({ status: 'Concluída', validado: true })), ['Reabrir', 'Editar']));
  it('escapa o texto do usuário', () => {
    const texto = cardDaDemanda(demanda(), null).blocks[0].text.text;
    assert.match(texto, /&lt;lista&gt; &amp; material/);
  });
  it('marca o responsável quando ele tem Slack', () =>
    assert.match(JSON.stringify(cardDaDemanda(demanda(), 'U9').blocks[1]), /<@U9>/));
});

describe('avisos', () => {
  it('formador: não vaza CPF, PIX, banco nem e-mail', () => {
    const texto = avisoDeCriacao(
      'formadores',
      'f1',
      { nomeCompleto: 'Bia', uf: 'MG', cpf: '123.456.789-00', pix: 'chave-pix', banco: 'Banco X', email: 'bia@x.com' },
      '',
    )!;
    assert.match(texto, /Bia/);
    for (const sensivel of ['123.456', 'chave-pix', 'Banco X', 'bia@x.com']) assert.ok(!texto.includes(sensivel), sensivel);
  });
  it('avaliação: não vaza nome nem e-mail de quem respondeu', () => {
    const texto = avisoDeCriacao('avaliacoes', 'a1', { formacaoTitulo: 'BNCC', nomeCompleto: 'Carlos Souza', email: 'c@x.com', avaliacaoEditora: '5' }, '')!;
    assert.ok(!texto.includes('Carlos') && !texto.includes('c@x.com'));
    assert.match(texto, /5\/5/);
  });
  it('demandas e usuarios não geram aviso', () => {
    assert.equal(avisoDeCriacao('demandas', 'x', {}, ''), null);
    assert.equal(avisoDeCriacao('usuarios', 'x', {}, ''), null);
  });
  it('coleção desconhecida sai só com nome e id', () =>
    assert.equal(avisoDeCriacao('novaColecao', 'abc', { segredo: 's' }, ''), '🗂️ Novo registro em *novaColecao* (`abc`)'));
  it('link para o app quando APP_URL existe', () =>
    assert.match(avisoDeCriacao('materiais', 'm1', { titulo: 'Guia' }, 'https://app.exemplo/')!, /<https:\/\/app\.exemplo\/materiais\|Guia>/));
  it('formação: só concluir, arquivar e reabrir viram aviso', () => {
    assert.match(avisoDeStatusDaFormacao({ status: 'preparacao' }, { status: 'concluido', titulo: 'T' }, '')!, /concluída/);
    assert.match(avisoDeStatusDaFormacao({ status: 'concluido' }, { status: 'preparacao', titulo: 'T' }, '')!, /reaberta/);
    assert.equal(avisoDeStatusDaFormacao({ status: 'preparacao' }, { status: 'em-formacao' }, ''), null);
  });
});

describe('fuso e formulário', () => {
  it('prazo do datepicker = meia-noite de Brasília (03:00 UTC)', () =>
    assert.equal(prazoDoFormulario('2026-11-20')!.toISOString(), '2026-11-20T03:00:00.000Z'));
  it('lê os campos do modal', () => {
    const f = lerFormulario({
      municipio: { v: { value: '  Campinas ' } },
      uf: { v: { selected_option: { value: 'SP' } } },
      prioridade: { v: { selected_option: { value: 'Urgente' } } },
      prazo: { v: { selected_date: null } },
    });
    assert.deepEqual([f.municipio, f.uf, f.prioridade, f.prazo], ['Campinas', 'SP', 'Urgente', undefined]);
  });
});

describe('resumo diário', () => {
  // 10/11/2026, meia-noite em Brasília.
  const hoje = new Date(2026, 10, 10);
  const formacao = (extra: Partial<Formacao>): Formacao =>
    ({ id: 'f', titulo: 'F', municipio: 'Santos', uf: 'SP', status: 'preparacao', formadoresIds: ['x'], dataInicio: null, dataFim: null, ...extra }) as unknown as Formacao;

  it('formação gravada às 22h de Brasília conta no dia de Brasília (não no de UTC)', () => {
    // 10/11 22:00 em Brasília = 11/11 01:00 UTC. Com o processo em UTC (padrão da Vercel e
    // do Cloud Functions), ela cairia no dia 11 e o resumo diria "Começa em 1 dia".
    const texto = montarResumo({
      formacoes: [formacao({ titulo: 'Noturna', dataInicio: dia('2026-11-11T01:00:00Z') as never })],
      projetos: [],
      demandas: [],
      hoje,
      appUrl: '',
      links: new Map(),
    });
    assert.match(texto, /Noturna.*Começa hoje/);
  });

  it('cada formação aparece uma vez, na pior gravidade', () => {
    const texto = montarResumo({
      formacoes: [formacao({ titulo: 'Atrasada', formadoresIds: [], dataInicio: dia('2026-11-01T03:00:00Z') as never, dataFim: dia('2026-11-03T03:00:00Z') as never })],
      projetos: [],
      demandas: [],
      hoje,
      appUrl: '',
      links: new Map(),
    });
    assert.equal(texto.match(/Atrasada/g)?.length, 1);
    assert.match(texto, /terminaram e falta concluir/);
    assert.doesNotMatch(texto, /Formações sem formadores/);
  });

  it('dia tranquilo diz que está tudo em dia', () =>
    assert.match(montarResumo({ formacoes: [], projetos: [], demandas: [], hoje, appUrl: '', links: new Map() }), /Nada atrasado/));
});

// ---------------------------------------------------------------------------
// Sincronização: a regra que evita mensagem duplicada
// ---------------------------------------------------------------------------

describe('gatilho da demanda', () => {
  const chamadas: { metodo: string; params: Record<string, string> }[] = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: { body: string }) => {
    const metodo = String(url).split('/api/')[1];
    chamadas.push({ metodo, params: Object.fromEntries(new URLSearchParams(init.body)) });
    const resposta = metodo === 'users.lookupByEmail' ? { ok: false, error: 'users_not_found' } : { ok: true, channel: 'C1', ts: '111.222' };
    return new Response(JSON.stringify(resposta), { status: 200 });
  }) as typeof fetch;
  afterEach(() => (chamadas.length = 0));
  process.on('exit', () => (globalThis.fetch = fetchOriginal));

  const gravados: unknown[] = [];
  const db = {
    collection: () => ({
      get: async () => ({ docs: [] }),
      doc: () => ({ id: 'novo' }),
    }),
    runTransaction: async (fn: (tx: unknown) => unknown) =>
      fn({ get: async () => ({ exists: true, get: () => undefined }), update: (_r: unknown, dados: unknown) => gravados.push(dados) }),
  } as never;
  const ref = {} as never;
  const cfg = { token: 'xoxb', canalDemandas: 'C1', canalAvisos: 'C2', appUrl: '' };
  const metodos = () => chamadas.map((c) => c.metodo);
  const item = (id: string, origem?: 'slack', tipo: 'comentario' | 'alteracao' = 'alteracao') =>
    ({ id, autorNome: 'Ana', autorId: 'u1', tipo, texto: tipo === 'comentario' ? 'oi' : 'Status alterado de "Pendente" para "Concluída".', origem, data: null }) as never;
  const comCard = (extra: Partial<Demanda> = {}) => demanda({ slackChannel: 'C1', slackTs: '111.222', ...extra });

  it('criada no app → publica o card e grava o endereço', async () => {
    assert.equal(await sincronizarMudanca(db, cfg, ref, null, demanda()), 'publicada');
    assert.deepEqual(metodos(), ['chat.postMessage']);
    assert.deepEqual(gravados.at(-1), { slackChannel: 'C1', slackTs: '111.222' });
  });

  it('criada pelo /demanda (já tem card) → não publica de novo', async () => {
    assert.equal(await sincronizarMudanca(db, cfg, ref, null, comCard()), 'criada-no-slack');
    assert.deepEqual(metodos(), []);
  });

  it('botão do Slack → atualiza o card mas NÃO repete a linha na thread', async () => {
    const antes = comCard();
    const depois = comCard({ status: 'Concluída', historico: [item('h1', 'slack')] });
    await sincronizarMudanca(db, cfg, ref, antes, depois);
    assert.deepEqual(metodos(), ['chat.update']);
  });

  it('comentário feito no app → vai para a thread marcado "(no app)"', async () => {
    await sincronizarMudanca(db, cfg, ref, comCard(), comCard({ historico: [item('h2', undefined, 'comentario')] }));
    assert.deepEqual(metodos(), ['chat.postMessage']);
    assert.equal(chamadas[0].params.thread_ts, '111.222');
    assert.match(chamadas[0].params.text, /\(no app\): oi/);
  });

  it('só o bot gravando slackTs → nada a fazer (sem laço infinito)', async () => {
    assert.equal(await sincronizarMudanca(db, cfg, ref, demanda(), comCard()), 'nada-a-fazer');
    assert.deepEqual(metodos(), []);
  });

  it('excluída no app → card vira "Excluída"', async () => {
    assert.equal(await sincronizarMudanca(db, cfg, ref, comCard(), null), 'excluida');
    assert.deepEqual(metodos(), ['chat.update']);
    assert.match(chamadas[0].params.text, /excluída/);
  });
});

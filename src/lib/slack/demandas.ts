import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase-admin/firestore';
import type { Demanda, HistoricoItem, StatusDemanda } from '@/lib/types';
import { podeValidar } from '@/lib/validadores';
import { chamarSlack, ErroSlack } from './api';
import { cardDaDemanda, cardExcluido, resumoDaDemanda } from './card-demanda';
import type { ConfigSlack } from './config';
import { prazoDoFormulario, type Formulario } from './modais';
import { slackDoUsuario, type Autor, type UsuarioApp } from './pessoas';
import { dataBR, escapar, paraData } from './texto';

/**
 * Demandas: o que o bot grava no banco e como o card do Slack acompanha.
 *
 * Regra que evita mensagem duplicada:
 *  - mudança que NASCE no Slack (botão, formulário, resposta na thread): quem grava é a
 *    rota da Vercel, que também atualiza o card e escreve na thread. O item do histórico
 *    leva `origem: 'slack'`;
 *  - mudança que nasce no app (demanda automática, agente, outras telas): o gatilho do
 *    Firestore (`functions/`) percebe e leva para o Slack. Ele ignora itens `origem: 'slack'`.
 *
 * Os textos do histórico são os mesmos do Diário de Bordo (`diario/page.tsx`,
 * `form-diario.tsx`), para o histórico ler igual venha de onde vier.
 */

export type Resultado = { ok: true; demanda: Demanda; itens: HistoricoItem[] } | { ok: false; motivo: string };

export const lerDemanda = (snap: DocumentSnapshot): Demanda =>
  ({ ...snap.data(), id: snap.id }) as unknown as Demanda;

export const estaAberta = (d: Pick<Demanda, 'status' | 'validado'>) => d.status !== 'Concluída' && !d.validado;

function novoItem(
  db: Firestore,
  autor: Autor,
  texto: string,
  tipo: HistoricoItem['tipo'] = 'alteracao',
  extra: Partial<HistoricoItem> = {},
): HistoricoItem {
  return {
    id: db.collection('demandas').doc().id,
    data: Timestamp.now() as unknown as HistoricoItem['data'],
    autorId: autor.autorId,
    autorNome: autor.autorNome,
    tipo,
    texto,
    origem: 'slack',
    ...extra,
  };
}

const NAO_EXISTE = { ok: false as const, motivo: 'Esta demanda não existe mais no app.' };

// ---------------------------------------------------------------------------
// Gravações que nascem no Slack
// ---------------------------------------------------------------------------

export async function mudarStatus(db: Firestore, id: string, para: StatusDemanda, autor: Autor): Promise<Resultado> {
  const ref = db.collection('demandas').doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return NAO_EXISTE;
    const d = lerDemanda(snap);
    if (d.status === para) return { ok: false, motivo: `Já está como "${para}".` };

    const itens = [novoItem(db, autor, `Status alterado de "${d.status}" para "${para}".`)];
    const payload: Record<string, unknown> = { status: para };
    // Reabrir uma demanda já validada invalida a validação anterior (mesma regra do Diário).
    if (para !== 'Concluída' && d.validado) {
      payload.validado = false;
      itens.push(novoItem(db, autor, 'Validação removida: a demanda foi reaberta.'));
    }

    tx.update(ref, {
      ...payload,
      historico: FieldValue.arrayUnion(...itens),
      dataAtualizacao: FieldValue.serverTimestamp(),
    });
    return { ok: true, demanda: { ...d, ...payload, historico: [...(d.historico ?? []), ...itens] }, itens };
  });
}

export async function validar(db: Firestore, id: string, autor: Autor): Promise<Resultado> {
  if (!podeValidar(autor.email)) {
    return {
      ok: false,
      motivo: autor.ligado
        ? 'Você não está na lista de quem pode validar demandas.'
        : 'Seu Slack não está ligado a um usuário do app, então não sei se você pode validar. Rode `/demanda conferir`.',
    };
  }
  const ref = db.collection('demandas').doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return NAO_EXISTE;
    const d = lerDemanda(snap);
    if (d.validado) return { ok: false, motivo: 'Já está validada.' };
    if (d.status !== 'Concluída') return { ok: false, motivo: 'Só dá para validar uma demanda concluída.' };

    const itens = [novoItem(db, autor, 'Demanda validada.')];
    tx.update(ref, {
      validado: true,
      historico: FieldValue.arrayUnion(...itens),
      dataAtualizacao: FieldValue.serverTimestamp(),
    });
    return { ok: true, demanda: { ...d, validado: true, historico: [...(d.historico ?? []), ...itens] }, itens };
  });
}

export async function editar(
  db: Firestore,
  id: string,
  form: Formulario,
  autor: Autor,
  admins: UsuarioApp[],
): Promise<Resultado> {
  const ref = db.collection('demandas').doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return NAO_EXISTE;
    const d = lerDemanda(snap);

    const mudancas: Record<string, unknown> = {};
    const itens: HistoricoItem[] = [];

    if (form.responsavelId && form.responsavelId !== d.responsavelId) {
      const nome = admins.find((u) => u.uid === form.responsavelId)?.nome || 'N/A';
      mudancas.responsavelId = form.responsavelId;
      mudancas.responsavelNome = nome;
      itens.push(novoItem(db, autor, `Responsável alterado para "${nome}".`));
    }
    const prioridade = form.prioridade ?? 'Normal';
    if (prioridade !== (d.prioridade ?? 'Normal')) {
      mudancas.prioridade = prioridade;
      itens.push(novoItem(db, autor, `Prioridade alterada de "${d.prioridade ?? 'Normal'}" para "${prioridade}".`));
    }
    const prazoNovo = prazoDoFormulario(form.prazo);
    if ((paraData(d.prazo)?.getTime() ?? null) !== (prazoNovo?.getTime() ?? null)) {
      mudancas.prazo = prazoNovo ? Timestamp.fromDate(prazoNovo) : null;
      itens.push(novoItem(db, autor, `Prazo alterado para ${prazoNovo ? dataBR(prazoNovo) : 'N/A'}.`));
    }

    if (!itens.length) return { ok: false, motivo: 'Nada mudou.' };
    tx.update(ref, {
      ...mudancas,
      historico: FieldValue.arrayUnion(...itens),
      dataAtualizacao: FieldValue.serverTimestamp(),
    });
    return { ok: true, demanda: { ...d, ...mudancas, historico: [...(d.historico ?? []), ...itens] } as Demanda, itens };
  });
}

/**
 * Resposta na thread de um card → comentário no histórico.
 * `null` quando a thread não é de demanda ou a resposta já foi gravada (o Slack
 * reenvia o evento se não recebeu o "ok" a tempo).
 */
export async function comentar(
  db: Firestore,
  threadTs: string,
  mensagemTs: string,
  texto: string,
  autor: Autor,
): Promise<Demanda | null> {
  const achadas = await db.collection('demandas').where('slackTs', '==', threadTs).limit(1).get();
  if (achadas.empty) return null;
  const ref = achadas.docs[0].ref;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const d = lerDemanda(snap);
    if ((d.historico ?? []).some((h) => h.slackTs === mensagemTs)) return null;

    const item = novoItem(db, autor, texto, 'comentario', { slackTs: mensagemTs });
    tx.update(ref, { historico: FieldValue.arrayUnion(item), dataAtualizacao: FieldValue.serverTimestamp() });
    return { ...d, historico: [...(d.historico ?? []), item] };
  });
}

/**
 * `/demanda` → card no canal + documento no banco. O card vai primeiro, para o documento
 * já nascer com `slackTs` e o gatilho do Firestore saber que não precisa publicar.
 */
export async function criar(
  db: Firestore,
  cfg: ConfigSlack,
  form: Formulario,
  autor: Autor,
  admins: UsuarioApp[],
): Promise<Demanda> {
  const ref = db.collection('demandas').doc();
  const prazo = prazoDoFormulario(form.prazo);
  const agora = Timestamp.now();
  const demanda = {
    id: ref.id,
    municipio: form.municipio ?? '',
    uf: form.uf ?? '',
    demanda: form.demanda ?? '',
    status: 'Pendente' as StatusDemanda,
    responsavelId: form.responsavelId ?? '',
    responsavelNome: admins.find((u) => u.uid === form.responsavelId)?.nome || 'N/A',
    prioridade: form.prioridade ?? 'Normal',
    prazo: prazo ? Timestamp.fromDate(prazo) : null,
    origem: 'manual' as const,
    anexosIds: [] as string[],
    // Mesmo formato do formulário do Diário: o item de criação usa o id do documento.
    historico: [{ ...novoItem(db, autor, 'Demanda criada.', 'criacao'), id: ref.id }],
  };

  const card = await publicarCard(db, cfg, demanda as unknown as Demanda);
  try {
    await ref.set({
      ...demanda,
      slackChannel: card.channel,
      slackTs: card.ts,
      dataCriacao: agora,
      dataAtualizacao: agora,
    });
  } catch (e) {
    await chamarSlack(cfg.token, 'chat.delete', { channel: card.channel, ts: card.ts }).catch(() => undefined);
    throw e;
  }
  return { ...demanda, slackChannel: card.channel, slackTs: card.ts } as unknown as Demanda;
}

// ---------------------------------------------------------------------------
// Card e thread
// ---------------------------------------------------------------------------

export async function publicarCard(db: Firestore, cfg: ConfigSlack, d: Demanda): Promise<{ channel: string; ts: string }> {
  const responsavel = await slackDoUsuario(db, cfg.token, d.responsavelId);
  const card = cardDaDemanda(d, responsavel);
  // A marcação no texto é o que faz o responsável receber notificação.
  const text = responsavel ? `<@${responsavel}> nova demanda para você — ${resumoDaDemanda(d)}` : card.text;
  const r = await chamarSlack(cfg.token, 'chat.postMessage', {
    channel: cfg.canalDemandas,
    text,
    blocks: card.blocks,
    unfurl_links: false,
  });
  return { channel: r.channel, ts: r.ts };
}

/**
 * Publica o card de uma demanda que ainda não tem e grava o endereço dele.
 * A transação impede dois cards para a mesma demanda (gatilho e `/demanda importar`
 * ao mesmo tempo): quem chegar depois apaga a própria mensagem.
 */
export async function publicarSeFaltar(db: Firestore, cfg: ConfigSlack, ref: DocumentReference, d: Demanda): Promise<boolean> {
  if (d.slackTs) return false;
  const card = await publicarCard(db, cfg, d);
  const gravou = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('slackTs')) return false;
    tx.update(ref, { slackChannel: card.channel, slackTs: card.ts });
    return true;
  });
  if (!gravou) await chamarSlack(cfg.token, 'chat.delete', { channel: card.channel, ts: card.ts }).catch(() => undefined);
  return gravou;
}

export async function atualizarCard(db: Firestore, cfg: ConfigSlack, d: Demanda): Promise<void> {
  if (!d.slackChannel || !d.slackTs) return;
  const card = cardDaDemanda(d, await slackDoUsuario(db, cfg.token, d.responsavelId));
  try {
    await chamarSlack(cfg.token, 'chat.update', { channel: d.slackChannel, ts: d.slackTs, text: card.text, blocks: card.blocks });
  } catch (e) {
    // Mensagem apagada no Slack: o banco continua certo, só não há card para atualizar.
    if (e instanceof ErroSlack && ['message_not_found', 'cant_update_message', 'channel_not_found'].includes(e.codigo)) return;
    throw e;
  }
}

export async function marcarCardExcluido(cfg: ConfigSlack, d: Demanda): Promise<void> {
  if (!d.slackChannel || !d.slackTs) return;
  const card = cardExcluido(d);
  await chamarSlack(cfg.token, 'chat.update', { channel: d.slackChannel, ts: d.slackTs, text: card.text, blocks: card.blocks }).catch(
    () => undefined,
  );
}

const linhaDoHistorico = (h: HistoricoItem, veioDoApp: boolean) =>
  `${h.tipo === 'comentario' ? '💬' : '✏️'} *${escapar(h.autorNome)}*${veioDoApp ? ' (no app)' : ''}: ${escapar(h.texto)}`;

/** Escreve na thread do card o que mudou. Se o responsável mudou, marca o novo com @. */
export async function contarNaThread(
  db: Firestore,
  cfg: ConfigSlack,
  d: Demanda,
  itens: HistoricoItem[],
  veioDoApp: boolean,
): Promise<void> {
  if (!d.slackChannel || !d.slackTs || !itens.length) return;
  const linhas = itens.map((h) => linhaDoHistorico(h, veioDoApp));
  if (itens.some((h) => h.texto.startsWith('Responsável alterado'))) {
    const novo = await slackDoUsuario(db, cfg.token, d.responsavelId);
    if (novo) linhas.push(`👤 Agora com <@${novo}>.`);
  }
  await chamarSlack(cfg.token, 'chat.postMessage', {
    channel: d.slackChannel,
    thread_ts: d.slackTs,
    text: linhas.join('\n'),
    unfurl_links: false,
  });
}

/** Depois de gravar uma ação vinda do Slack: card novo + linha na thread. */
export async function refletirAcaoDoSlack(db: Firestore, cfg: ConfigSlack, r: Extract<Resultado, { ok: true }>) {
  await atualizarCard(db, cfg, r.demanda);
  await contarNaThread(db, cfg, r.demanda, r.itens, false);
}

// ---------------------------------------------------------------------------
// Gatilho do Firestore (functions/): mudanças que nasceram no app
// ---------------------------------------------------------------------------

const CAMPOS_DO_CARD = [
  'status',
  'responsavelId',
  'responsavelNome',
  'prazo',
  'prioridade',
  'validado',
  'demanda',
  'municipio',
  'uf',
  'origem',
  'projetoOrigemNome',
  'etapaProjeto',
] as const;

const mesmoValor = (a: unknown, b: unknown) => {
  const da = paraData(a);
  const dbb = paraData(b);
  if (da || dbb) return (da?.getTime() ?? null) === (dbb?.getTime() ?? null);
  return (a ?? null) === (b ?? null);
};

export async function sincronizarMudanca(
  db: Firestore,
  cfg: ConfigSlack,
  ref: DocumentReference,
  antes: Demanda | null,
  depois: Demanda | null,
): Promise<string> {
  if (!depois) {
    if (antes?.slackTs) await marcarCardExcluido(cfg, antes);
    return 'excluida';
  }

  if (!depois.slackTs) {
    // Criada no app, ou demanda antiga aberta que mudou: ganha card agora.
    if (!antes || estaAberta(depois)) {
      return (await publicarSeFaltar(db, cfg, ref, depois)) ? 'publicada' : 'ja-publicada';
    }
    return 'sem-card';
  }
  if (!antes) return 'criada-no-slack';

  const idsAntes = new Set((antes.historico ?? []).map((h) => h.id));
  const novosDoApp = (depois.historico ?? []).filter((h) => !idsAntes.has(h.id) && h.origem !== 'slack');
  const mudouCard = CAMPOS_DO_CARD.some((c) => !mesmoValor(antes[c], depois[c]));

  // Atualizar o card é idempotente: se a mudança veio do Slack, a rota já fez o mesmo.
  if (mudouCard) await atualizarCard(db, cfg, depois);
  await contarNaThread(db, cfg, depois, novosDoApp, true);
  return mudouCard || novosDoApp.length ? 'sincronizada' : 'nada-a-fazer';
}

/** `/demanda importar`: publica as demandas abertas que ainda não têm card. */
export async function importarAbertas(db: Firestore, cfg: ConfigSlack, limite: number): Promise<{ publicadas: number; restantes: number }> {
  const snap = await db.collection('demandas').where('status', '!=', 'Concluída').get();
  const faltam = snap.docs.map((s) => ({ ref: s.ref, d: lerDemanda(s) })).filter((x) => estaAberta(x.d) && !x.d.slackTs);
  let publicadas = 0;
  for (const { ref, d } of faltam.slice(0, limite)) {
    if (await publicarSeFaltar(db, cfg, ref, d)) publicadas++;
  }
  return { publicadas, restantes: Math.max(0, faltam.length - limite) };
}

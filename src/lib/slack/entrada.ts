import type { Firestore } from 'firebase-admin/firestore';
import type { StatusDemanda } from '@/lib/types';
import { STATUS_OPTIONS } from '@/components/diario/diario-utils';
import { chamarSlack } from './api';
import { ACAO } from './card-demanda';
import type { ConfigSlack } from './config';
import { comentar, criar, editar, importarAbertas, lerDemanda, mudarStatus, refletirAcaoDoSlack, validar } from './demandas';
import { lerFormulario, MODAL, modalCriar, modalEditar } from './modais';
import { autorDoSlack, conferirLigacoes, responsaveisPossiveis } from './pessoas';

/**
 * As três portas por onde o Slack fala com o app: comando (`/demanda`), interação
 * (botão, formulário) e evento (resposta na thread).
 *
 * Cada função devolve `corpo` (o que responder ao Slack, já) e `depois` (o que fazer
 * depois de responder). O Slack desiste em 3 segundos; só fica antes da resposta o
 * que não pode esperar — abrir um modal (o `trigger_id` vence em 3 s) ou validar um
 * formulário (o erro só aparece no modal se vier na resposta).
 */
export interface Tratamento {
  corpo: unknown | null;
  depois?: () => Promise<void>;
}

const efemera = (texto: string) => ({ response_type: 'ephemeral', text: texto });

async function responderPelaUrl(url: string | null, texto: string) {
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...efemera(texto), replace_original: false }),
  });
}

async function avisarSoParaQuemClicou(cfg: ConfigSlack, canal: string | undefined, usuario: string, texto: string) {
  if (!canal) return;
  await chamarSlack(cfg.token, 'chat.postEphemeral', { channel: canal, user: usuario, text: texto });
}

const AJUDA = [
  '*Demandas no Slack*',
  '• `/demanda` — abre o formulário de nova demanda (`/demanda texto` já preenche a descrição)',
  '• Botões do card — mudam status, validam, abrem a edição de responsável, prazo e prioridade',
  '• Responder na thread do card — vira comentário no histórico do app (💾 = gravado)',
  '• `/demanda conferir` — mostra quem do Slack está ligado a quem do app',
  '• `/demanda importar` — publica aqui as demandas abertas que ainda não têm card',
].join('\n');

// ---------------------------------------------------------------------------
// /demanda
// ---------------------------------------------------------------------------

export async function tratarComando(db: Firestore, cfg: ConfigSlack, p: URLSearchParams): Promise<Tratamento> {
  const texto = (p.get('text') ?? '').trim();
  const sub = texto.split(/\s+/)[0]?.toLowerCase() ?? '';
  const usuario = p.get('user_id') ?? '';
  const respostaUrl = p.get('response_url');

  if (sub === 'ajuda' || sub === 'help') return { corpo: efemera(AJUDA) };

  if (sub === 'conferir') {
    return {
      corpo: efemera('🔎 Conferindo quem está ligado a quem… a resposta chega aqui em instantes.'),
      depois: async () => responderPelaUrl(respostaUrl, await conferirLigacoes(db, cfg.token)),
    };
  }

  if (sub === 'importar') {
    return {
      corpo: efemera('📥 Publicando as demandas abertas que ainda não têm card…'),
      depois: async () => {
        const r = await importarAbertas(db, cfg, 25);
        await responderPelaUrl(
          respostaUrl,
          r.restantes
            ? `Publiquei ${r.publicadas}. Faltam ${r.restantes} — rode \`/demanda importar\` de novo.`
            : `✅ Publiquei ${r.publicadas}. Todas as demandas abertas já têm card.`,
        );
      },
    };
  }

  const [admins, autor] = await Promise.all([responsaveisPossiveis(db), autorDoSlack(db, cfg.token, usuario)]);
  if (!admins.length) return { corpo: efemera('Não achei nenhum administrador no app para ser responsável.') };
  await chamarSlack(cfg.token, 'views.open', {
    trigger_id: p.get('trigger_id'),
    view: modalCriar(admins, texto, autor.ligado ? autor.autorId : undefined),
  });
  return { corpo: null };
}

// ---------------------------------------------------------------------------
// Botões e formulários
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tratarInteracao(db: Firestore, cfg: ConfigSlack, payload: any): Promise<Tratamento> {
  const usuario: string = payload.user?.id ?? '';

  if (payload.type === 'block_actions') {
    const acao = payload.actions?.[0];
    if (!acao) return { corpo: null };
    const canal: string | undefined = payload.channel?.id;
    const valor = JSON.parse(acao.value || '{}') as { id?: string; para?: StatusDemanda };
    if (!valor.id) return { corpo: null };

    if (acao.action_id === ACAO.editar) {
      const [snap, admins] = await Promise.all([db.collection('demandas').doc(valor.id).get(), responsaveisPossiveis(db)]);
      if (!snap.exists) {
        return { corpo: null, depois: () => avisarSoParaQuemClicou(cfg, canal, usuario, 'Esta demanda não existe mais no app.') };
      }
      await chamarSlack(cfg.token, 'views.open', { trigger_id: payload.trigger_id, view: modalEditar(lerDemanda(snap), admins) });
      return { corpo: null };
    }

    const ehStatus = String(acao.action_id).startsWith(ACAO.status);
    if (!ehStatus && acao.action_id !== ACAO.validar) return { corpo: null };
    if (ehStatus && !STATUS_OPTIONS.includes(valor.para as StatusDemanda)) return { corpo: null };

    const autor = await autorDoSlack(db, cfg.token, usuario);
    const r = ehStatus ? await mudarStatus(db, valor.id, valor.para as StatusDemanda, autor) : await validar(db, valor.id, autor);
    return {
      corpo: null,
      depois: async () => {
        if (!r.ok) return avisarSoParaQuemClicou(cfg, canal, usuario, r.motivo);
        await refletirAcaoDoSlack(db, cfg, r);
        if (!autor.ligado) {
          await avisarSoParaQuemClicou(cfg, canal, usuario, 'Gravei, mas seu Slack não está ligado a um usuário do app — no histórico aparece "(Slack)". Veja `/demanda conferir`.');
        }
      },
    };
  }

  if (payload.type === 'view_submission') {
    const view = payload.view;
    const form = lerFormulario(view?.state?.values ?? {});
    const [admins, autor] = await Promise.all([responsaveisPossiveis(db), autorDoSlack(db, cfg.token, usuario)]);

    if (view?.callback_id === MODAL.criar) {
      if (!form.municipio) return { corpo: { response_action: 'errors', errors: { municipio: 'Informe o município.' } } };
      if (!form.demanda) return { corpo: { response_action: 'errors', errors: { demanda: 'Descreva a demanda.' } } };
      try {
        await criar(db, cfg, form, autor, admins);
      } catch (e) {
        console.error('Slack: erro ao criar demanda', e);
        return { corpo: { response_action: 'errors', errors: { demanda: 'Não consegui salvar no app. Tente de novo.' } } };
      }
      return { corpo: null };
    }

    if (view?.callback_id === MODAL.editar) {
      const { id } = JSON.parse(view.private_metadata || '{}') as { id?: string };
      if (!id) return { corpo: null };
      const r = await editar(db, id, form, autor, admins);
      if (!r.ok) {
        if (r.motivo === 'Nada mudou.') return { corpo: null };
        return { corpo: { response_action: 'errors', errors: { responsavel: r.motivo } } };
      }
      return { corpo: null, depois: () => refletirAcaoDoSlack(db, cfg, r) };
    }
  }

  return { corpo: null };
}

// ---------------------------------------------------------------------------
// Eventos: resposta na thread de um card
// ---------------------------------------------------------------------------

/** `<@U1>` → `@Nome`; `<https://x|rótulo>` → `rótulo (https://x)`; anexos entram pelo nome. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function textoLegivel(db: Firestore, cfg: ConfigSlack, ev: any): Promise<string> {
  let texto = String(ev.text ?? '');
  const ids = [...new Set([...texto.matchAll(/<@([A-Z0-9]+)>/g)].map((m) => m[1]))];
  for (const id of ids) {
    const nome = (await autorDoSlack(db, cfg.token, id).catch(() => null))?.autorNome.replace(/ \(Slack\)$/, '') ?? id;
    texto = texto.replaceAll(`<@${id}>`, `@${nome}`);
  }
  texto = texto
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2 ($1)')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anexos = (ev.files ?? []).map((f: any) => `[anexo no Slack: ${f.name}${f.permalink ? ` — ${f.permalink}` : ''}]`);
  return [texto.trim(), ...anexos].filter(Boolean).join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tratarEvento(db: Firestore, cfg: ConfigSlack, corpo: any): Promise<Tratamento> {
  if (corpo?.type === 'url_verification') return { corpo: { challenge: corpo.challenge } };
  if (corpo?.type !== 'event_callback') return { corpo: null };

  const ev = corpo.event;
  const respostaNaThread =
    ev?.type === 'message' &&
    ev.user &&
    !ev.bot_id &&
    ev.thread_ts &&
    ev.thread_ts !== ev.ts &&
    (!ev.subtype || ev.subtype === 'thread_broadcast' || ev.subtype === 'file_share');
  if (!respostaNaThread) return { corpo: null };

  return {
    corpo: null,
    depois: async () => {
      const [autor, texto] = await Promise.all([autorDoSlack(db, cfg.token, ev.user), textoLegivel(db, cfg, ev)]);
      if (!texto) return;
      const demanda = await comentar(db, ev.thread_ts, ev.ts, texto, autor);
      if (!demanda) return; // thread que não é de demanda, ou resposta já gravada
      // 💾 na mensagem: o sinal visível de que foi para o histórico do app.
      await chamarSlack(cfg.token, 'reactions.add', { channel: ev.channel, timestamp: ev.ts, name: 'floppy_disk' }).catch(() => undefined);
    },
  };
}

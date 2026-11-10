import type { Demanda, StatusDemanda } from '@/lib/types';
import { STATUS_OPTIONS } from '@/components/diario/diario-utils';
import { dataBR, escapar, truncar } from './texto';

/**
 * O card de uma demanda no canal: é a "linha" que o Diário de Bordo mostrava.
 * Função pura — recebe a demanda e devolve o JSON do Block Kit
 * (https://api.slack.com/block-kit), sem falar com Slack nem banco.
 */

export interface MensagemSlack {
  /** Texto de reserva: aparece na notificação do celular e em leitores de tela. */
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: any[];
}

export const EMOJI_STATUS: Record<StatusDemanda, string> = {
  Pendente: '⏳',
  'Em andamento': '🔧',
  'Aguardando retorno': '📨',
  Concluída: '✅',
};

const ROTULO_BOTAO: Record<StatusDemanda, string> = {
  Pendente: 'Voltar a pendente',
  'Em andamento': 'Em andamento',
  'Aguardando retorno': 'Aguardando retorno',
  Concluída: 'Concluir',
};

/** IDs das ações. O roteador de interações (`interacoes.ts`) lê estes mesmos nomes. */
export const ACAO = {
  status: 'demanda_status',
  validar: 'demanda_validar',
  editar: 'demanda_editar',
} as const;

export const resumoDaDemanda = (d: Pick<Demanda, 'municipio' | 'uf' | 'demanda'>): string =>
  `${d.municipio}/${d.uf}: ${truncar(String(d.demanda ?? '').replace(/\s+/g, ' '), 90)}`;

const botaoStatus = (id: string, para: StatusDemanda, indice: number, rotulo = ROTULO_BOTAO[para]) => ({
  type: 'button',
  action_id: `${ACAO.status}_${indice}`,
  text: { type: 'plain_text', text: rotulo },
  value: JSON.stringify({ id, para }),
  ...(para === 'Concluída' ? { style: 'primary' } : {}),
});

function botoes(d: Demanda) {
  const editar = {
    type: 'button',
    action_id: ACAO.editar,
    text: { type: 'plain_text', text: 'Editar' },
    value: JSON.stringify({ id: d.id }),
  };

  if (d.validado) return [botaoStatus(d.id, 'Em andamento', 0, 'Reabrir'), editar];

  if (d.status === 'Concluída') {
    return [
      {
        type: 'button',
        action_id: ACAO.validar,
        text: { type: 'plain_text', text: 'Validar' },
        style: 'primary',
        value: JSON.stringify({ id: d.id }),
      },
      botaoStatus(d.id, 'Em andamento', 0, 'Reabrir'),
      editar,
    ];
  }

  return [
    ...STATUS_OPTIONS.filter((s) => s !== d.status).map((s, i) => botaoStatus(d.id, s, i)),
    editar,
  ];
}

export function cardDaDemanda(d: Demanda, responsavelSlackId: string | null): MensagemSlack {
  const responsavel = responsavelSlackId ? `<@${responsavelSlackId}>` : escapar(d.responsavelNome || 'sem responsável');
  const prazo = dataBR(d.prazo);
  const selos = [
    `${EMOJI_STATUS[d.status] ?? '•'} *${escapar(d.status)}*`,
    d.prioridade === 'Urgente' ? '🔥 *Urgente*' : '',
    d.validado ? '☑️ Validada' : '',
  ].filter(Boolean);

  const origem =
    d.origem === 'automatica'
      ? `🤖 automática${d.projetoOrigemNome ? ` · projeto ${escapar(d.projetoOrigemNome)}` : ''}${d.etapaProjeto ? ` · ${escapar(d.etapaProjeto)}` : ''}`
      : '✍️ manual';

  return {
    text: `📋 ${resumoDaDemanda(d)} — ${d.status}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `${selos.join('   ')}\n${escapar(truncar(String(d.demanda ?? ''), 2800))}` },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `📍 ${escapar(d.municipio)}/${escapar(d.uf)}` },
          { type: 'mrkdwn', text: `👤 ${responsavel}` },
          { type: 'mrkdwn', text: `⏰ ${prazo ? `prazo ${prazo}` : 'sem prazo'}` },
          { type: 'mrkdwn', text: origem },
        ],
      },
      { type: 'actions', block_id: `demanda_${d.id}`, elements: botoes(d) },
    ],
  };
}

/** O que fica no lugar do card quando a demanda é excluída no app. */
export function cardExcluido(d: Pick<Demanda, 'municipio' | 'uf' | 'demanda'>): MensagemSlack {
  return {
    text: `🗑️ Demanda excluída: ${resumoDaDemanda(d)}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `🗑️ *Excluída no app*\n~${escapar(truncar(String(d.demanda ?? ''), 2800))}~` },
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `📍 ${escapar(d.municipio)}/${escapar(d.uf)}` }] },
    ],
  };
}

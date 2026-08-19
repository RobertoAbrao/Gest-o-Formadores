import { differenceInCalendarDays, startOfToday } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import type { Demanda, HistoricoItem, StatusDemanda } from '@/lib/types';

export const STATUS_OPTIONS: StatusDemanda[] = [
  'Pendente',
  'Em andamento',
  'Aguardando retorno',
  'Concluída',
];

export const PRIORIDADE_OPTIONS: NonNullable<Demanda['prioridade']>[] = ['Normal', 'Urgente'];

export const STATUS_CONFIG: Record<
  StatusDemanda,
  { label: string; dot: string; hint: string }
> = {
  Pendente: {
    label: 'Pendente',
    dot: 'bg-slate-400',
    hint: 'Ainda não foi iniciada',
  },
  'Em andamento': {
    label: 'Em andamento',
    dot: 'bg-blue-500',
    hint: 'Alguém está trabalhando nisso agora',
  },
  'Aguardando retorno': {
    label: 'Aguardando retorno',
    dot: 'bg-amber-500',
    hint: 'Bloqueada, esperando resposta de terceiros',
  },
  Concluída: {
    label: 'Concluída',
    dot: 'bg-emerald-500',
    hint: 'Entregue — aguardando validação',
  },
};

/* -------------------------------------------------------------------------- */
/* Prazo / SLA                                                                */
/* -------------------------------------------------------------------------- */

export type SlaLevel = 'vencido' | 'hoje' | 'proximo' | 'ok' | 'sem-prazo' | 'encerrado';

export interface Sla {
  level: SlaLevel;
  /** Dias corridos até o prazo. Negativo = atrasado. `null` quando não há prazo. */
  dias: number | null;
  /** Texto curto para o chip do card, ex.: "Atrasada 3d". */
  label: string;
  /** Texto completo para o tooltip, ex.: "Venceu em 16/08/2026 — 3 dias de atraso.". */
  detalhe: string;
  chipClass: string;
  barClass: string;
}

const SEM_PRAZO: Sla = {
  level: 'sem-prazo',
  dias: null,
  label: 'Sem prazo',
  detalhe: 'Nenhum prazo definido para esta demanda.',
  chipClass: 'border-dashed border-muted-foreground/40 text-muted-foreground bg-transparent',
  barClass: 'bg-violet-400/60',
};

const plural = (n: number, singular: string, pluralWord: string) =>
  `${n} ${n === 1 ? singular : pluralWord}`;

export function getSla(demanda: Pick<Demanda, 'prazo' | 'status' | 'validado'>): Sla {
  const prazoDate = demanda.prazo?.toDate?.();

  if (demanda.status === 'Concluída' || demanda.validado) {
    return {
      level: 'encerrado',
      dias: null,
      label: demanda.validado ? 'Validada' : 'Concluída',
      detalhe: prazoDate ? `Prazo era ${prazoDate.toLocaleDateString('pt-BR')}.` : 'Encerrada.',
      chipClass:
        'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
      barClass: 'bg-emerald-500',
    };
  }

  if (!prazoDate) return SEM_PRAZO;

  const dias = differenceInCalendarDays(prazoDate, startOfToday());
  const data = prazoDate.toLocaleDateString('pt-BR');

  if (dias < 0) {
    const atraso = Math.abs(dias);
    return {
      level: 'vencido',
      dias,
      label: `Atrasada ${atraso}d`,
      detalhe: `Venceu em ${data} — ${plural(atraso, 'dia', 'dias')} de atraso.`,
      chipClass:
        'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300',
      barClass: 'bg-red-500',
    };
  }

  if (dias === 0) {
    return {
      level: 'hoje',
      dias,
      label: 'Vence hoje',
      detalhe: `O prazo termina hoje, ${data}.`,
      chipClass:
        'border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
      barClass: 'bg-orange-500',
    };
  }

  if (dias <= 3) {
    return {
      level: 'proximo',
      dias,
      label: `Faltam ${dias}d`,
      detalhe: `Vence em ${data} — ${plural(dias, 'dia', 'dias')}.`,
      chipClass:
        'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      barClass: 'bg-amber-500',
    };
  }

  return {
    level: 'ok',
    dias,
    label: data,
    detalhe: `Vence em ${data} — ${plural(dias, 'dia', 'dias')}.`,
    chipClass: 'border-border bg-muted/60 text-muted-foreground',
    barClass: 'bg-muted-foreground/30',
  };
}

export const LEGENDA_SLA: { label: string; className: string }[] = [
  { label: 'Atrasada', className: 'bg-red-500' },
  { label: 'Vence hoje', className: 'bg-orange-500' },
  { label: 'Até 3 dias', className: 'bg-amber-500' },
  { label: 'No prazo', className: 'bg-muted-foreground/30' },
  { label: 'Sem prazo', className: 'bg-violet-400/60' },
  { label: 'Concluída', className: 'bg-emerald-500' },
];

/* -------------------------------------------------------------------------- */
/* Filas — chips de foco no topo do quadro                                    */
/* -------------------------------------------------------------------------- */

export type QueueId = 'atrasadas' | 'hoje' | 'proximas' | 'urgentes' | 'semPrazo' | 'validar';

export interface QueueDef {
  id: QueueId;
  label: string;
  descricao: string;
  /** Cor do número quando a fila tem itens. */
  tone: string;
  match: (demanda: Demanda) => boolean;
}

const estaAberta = (d: Demanda) => d.status !== 'Concluída' && !d.validado;

export const QUEUES: QueueDef[] = [
  {
    id: 'atrasadas',
    label: 'Atrasadas',
    descricao: 'O prazo já venceu e a demanda continua aberta',
    tone: 'text-red-600 dark:text-red-400',
    match: (d) => estaAberta(d) && getSla(d).level === 'vencido',
  },
  {
    id: 'hoje',
    label: 'Vencem hoje',
    descricao: 'O prazo termina hoje',
    tone: 'text-orange-600 dark:text-orange-400',
    match: (d) => estaAberta(d) && getSla(d).level === 'hoje',
  },
  {
    id: 'proximas',
    label: 'Próximos 3 dias',
    descricao: 'Prazo dentro dos próximos 3 dias',
    tone: 'text-amber-600 dark:text-amber-400',
    match: (d) => estaAberta(d) && getSla(d).level === 'proximo',
  },
  {
    id: 'urgentes',
    label: 'Urgentes',
    descricao: 'Abertas e marcadas com prioridade urgente',
    tone: 'text-rose-600 dark:text-rose-400',
    match: (d) => estaAberta(d) && d.prioridade === 'Urgente',
  },
  {
    id: 'semPrazo',
    label: 'Sem prazo',
    descricao: 'Abertas e sem data limite — risco de ficarem esquecidas',
    tone: 'text-violet-600 dark:text-violet-400',
    match: (d) => estaAberta(d) && !d.prazo,
  },
  {
    id: 'validar',
    label: 'A validar',
    descricao: 'Concluídas que ainda aguardam validação',
    tone: 'text-teal-600 dark:text-teal-400',
    match: (d) => d.status === 'Concluída' && !d.validado,
  },
];

/* -------------------------------------------------------------------------- */
/* Ordenação                                                                  */
/* -------------------------------------------------------------------------- */

export type OrdenacaoId = 'prazo' | 'prioridade' | 'atualizacao' | 'criacao';

export const ORDENACOES: { id: OrdenacaoId; label: string }[] = [
  { id: 'prazo', label: 'Prazo mais próximo' },
  { id: 'prioridade', label: 'Prioridade' },
  { id: 'atualizacao', label: 'Atualizada recentemente' },
  { id: 'criacao', label: 'Criada recentemente' },
];

const ms = (t: Timestamp | null | undefined) => t?.toMillis?.() ?? 0;
/** Demandas sem prazo vão para o fim de qualquer ordenação por prazo. */
const prazoMs = (d: Demanda) => d.prazo?.toMillis?.() ?? Number.POSITIVE_INFINITY;

export function ordenarDemandas(demandas: Demanda[], ordem: OrdenacaoId): Demanda[] {
  const copia = [...demandas];
  switch (ordem) {
    case 'prioridade':
      return copia.sort((a, b) => {
        const urgente = Number(b.prioridade === 'Urgente') - Number(a.prioridade === 'Urgente');
        if (urgente !== 0) return urgente;
        return prazoMs(a) - prazoMs(b);
      });
    case 'atualizacao':
      return copia.sort((a, b) => ms(b.dataAtualizacao) - ms(a.dataAtualizacao));
    case 'criacao':
      return copia.sort((a, b) => ms(b.dataCriacao) - ms(a.dataCriacao));
    case 'prazo':
    default:
      return copia.sort((a, b) => {
        const pa = prazoMs(a);
        const pb = prazoMs(b);
        // Ambas sem prazo: cai no desempate por prioridade/criação abaixo.
        if (pa !== pb && Number.isFinite(pa - pb)) return pa - pb;
        if (pa !== pb) return Number.isFinite(pa) ? -1 : 1;
        const urgente = Number(b.prioridade === 'Urgente') - Number(a.prioridade === 'Urgente');
        if (urgente !== 0) return urgente;
        return ms(b.dataCriacao) - ms(a.dataCriacao);
      });
  }
}

/* -------------------------------------------------------------------------- */
/* Filtros — estado persistido entre visitas                                  */
/* -------------------------------------------------------------------------- */

export type JanelaConcluidas = '7' | '30' | '90' | 'todas';

export interface DiarioFiltros {
  busca: string;
  responsavelId: string;
  prioridade: 'all' | 'Normal' | 'Urgente';
  escopo: 'todas' | 'minhas';
  queue: QueueId | null;
  ordenacao: OrdenacaoId;
  janelaConcluidas: JanelaConcluidas;
}

export const FILTROS_PADRAO: DiarioFiltros = {
  busca: '',
  responsavelId: 'all',
  prioridade: 'all',
  escopo: 'todas',
  queue: null,
  ordenacao: 'prazo',
  janelaConcluidas: '30',
};

export const FILTROS_STORAGE_KEY = 'diario:filtros:v1';

/** Campos que contam como "filtro ativo" para o botão de limpar. */
export function contarFiltrosAtivos(f: DiarioFiltros): number {
  let n = 0;
  if (f.busca.trim()) n++;
  if (f.responsavelId !== 'all') n++;
  if (f.prioridade !== 'all') n++;
  if (f.escopo !== 'todas') n++;
  if (f.queue) n++;
  return n;
}

/**
 * Lê os filtros do localStorage validando cada campo — um valor salvo por uma
 * versão antiga não pode derrubar a página.
 */
export function carregarFiltros(): DiarioFiltros {
  if (typeof window === 'undefined') return FILTROS_PADRAO;
  try {
    const bruto = window.localStorage.getItem(FILTROS_STORAGE_KEY);
    if (!bruto) return FILTROS_PADRAO;
    const salvo = JSON.parse(bruto) as Partial<DiarioFiltros>;
    const queueValida = QUEUES.some((q) => q.id === salvo.queue);
    const ordemValida = ORDENACOES.some((o) => o.id === salvo.ordenacao);
    return {
      busca: typeof salvo.busca === 'string' ? salvo.busca : FILTROS_PADRAO.busca,
      responsavelId:
        typeof salvo.responsavelId === 'string'
          ? salvo.responsavelId
          : FILTROS_PADRAO.responsavelId,
      prioridade:
        salvo.prioridade === 'Normal' || salvo.prioridade === 'Urgente' || salvo.prioridade === 'all'
          ? salvo.prioridade
          : FILTROS_PADRAO.prioridade,
      escopo: salvo.escopo === 'minhas' ? 'minhas' : 'todas',
      queue: queueValida ? (salvo.queue as QueueId) : null,
      ordenacao: ordemValida ? (salvo.ordenacao as OrdenacaoId) : FILTROS_PADRAO.ordenacao,
      janelaConcluidas: (['7', '30', '90', 'todas'] as const).includes(
        salvo.janelaConcluidas as JanelaConcluidas,
      )
        ? (salvo.janelaConcluidas as JanelaConcluidas)
        : FILTROS_PADRAO.janelaConcluidas,
    };
  } catch {
    return FILTROS_PADRAO;
  }
}

export function salvarFiltros(filtros: DiarioFiltros): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FILTROS_STORAGE_KEY, JSON.stringify(filtros));
  } catch {
    /* modo privado / cota cheia: filtros simplesmente não persistem */
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers de apresentação                                                    */
/* -------------------------------------------------------------------------- */

/** Identificador curto e estável, no espírito da "issue key" do Jira. */
export function getDemandaKey(id: string): string {
  return `DEM-${id.slice(0, 5).toUpperCase()}`;
}

export function getIniciais(nome?: string): string {
  if (!nome?.trim()) return '?';
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

export function getUltimaAtividade(demanda: Demanda): HistoricoItem | null {
  if (!demanda.historico?.length) return null;
  return [...demanda.historico].sort((a, b) => ms(b.data) - ms(a.data))[0] ?? null;
}

export function contarComentarios(demanda: Demanda): number {
  return demanda.historico?.filter((h) => h.tipo === 'comentario').length ?? 0;
}

export function formatEtapaName(etapa?: string): string {
  if (!etapa) return '';
  const [tipo, identificador = ''] = etapa.split('_');
  if (!identificador) return tipo.charAt(0).toUpperCase() + tipo.slice(1);
  if (tipo === 'implantacao') return 'Implantação';
  if (tipo === 'diagnostica') return 'Diagnóstica';
  if (tipo === 'simulado') return `Simulado ${identificador.replace('s', '')}`;
  if (tipo === 'devolutiva') return `Devolutiva ${identificador.replace('d', '')}`;
  return etapa;
}

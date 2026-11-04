/**
 * Regras do quadro de Acompanhamento — puras, sem React nem Firestore.
 *
 * O quadro tem duas camadas, como as filas do Jira Service Management:
 *  - COLUNAS dizem em que fase cada formação está (vem de `faseDaFormacao`);
 *  - FILAS são contadores clicáveis que FILTRAM o quadro ("o que precisa de ação").
 *
 * Contagem das filas é INCLUSIVA: uma formação atrasada e sem formador conta nas
 * duas. Assim o número da fila é sempre igual ao número de cards que aparecem ao
 * clicar nela. (A faixa antiga contava cada formação uma vez só, pela gravidade
 * mais alta, e "N sem formadores" mostrava menos do que existia.)
 */

import type { Timestamp } from 'firebase/firestore';
import type { Formacao } from '@/lib/types';
import type { Alerta } from '@/lib/alertas';
import type { FaseFormacao } from '@/lib/fase-formacao';

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/**
 * Devolutivas antigas foram gravadas só como "Devolutiva 2", sem o município.
 * Remendo de exibição: o certo seria corrigir o título gravado.
 */
export function tituloDaFormacao(f: Pick<Formacao, 'titulo' | 'municipio'>): string {
  const t = f.titulo || 'Sem título';
  return t.startsWith('Devolutiva') && !t.includes(':') && f.municipio ? `${t}: ${f.municipio}` : t;
}

const paraData = (t: Timestamp | null | undefined): Date | null => {
  if (!t) return null;
  try {
    return t.toDate();
  } catch {
    return null;
  }
};

const dd = (d: Date) => String(d.getDate()).padStart(2, '0');
const mm = (d: Date) => String(d.getMonth() + 1).padStart(2, '0');

/** "12/11", "12–14/11" ou "28/11–02/12". Vazio se não há data. */
export function periodoCurto(f: Pick<Formacao, 'dataInicio' | 'dataFim'>): string {
  const ini = paraData(f.dataInicio) ?? paraData(f.dataFim);
  const fim = paraData(f.dataFim) ?? ini;
  if (!ini || !fim) return '';
  const mesmoDia = ini.toDateString() === fim.toDateString();
  if (mesmoDia) return `${dd(ini)}/${mm(ini)}`;
  const mesmoMes = ini.getMonth() === fim.getMonth() && ini.getFullYear() === fim.getFullYear();
  return mesmoMes ? `${dd(ini)}–${dd(fim)}/${mm(fim)}` : `${dd(ini)}/${mm(ini)}–${dd(fim)}/${mm(fim)}`;
}

/** Nomes curtos ("Ana, João +1"). Formação antiga pode não ter `formadoresNomes`. */
export function formadoresCurto(f: Pick<Formacao, 'formadoresIds' | 'formadoresNomes'>): string {
  const nomes = (f.formadoresNomes || []).filter(Boolean).map((n) => n.trim().split(/\s+/)[0]);
  if (nomes.length > 0) {
    return nomes.length <= 2 ? nomes.join(', ') : `${nomes.slice(0, 2).join(', ')} +${nomes.length - 2}`;
  }
  const n = (f.formadoresIds || []).length;
  return n === 0 ? '' : n === 1 ? '1 formador' : `${n} formadores`;
}

// ---------------------------------------------------------------------------
// Ordem dentro da coluna
// ---------------------------------------------------------------------------

/**
 * Princípio único: **o mais próximo de hoje fica no topo**. Nas colunas de futuro
 * é ordem crescente de data; nas de passado, decrescente. Sem data vai para o fim.
 */
const ORDEM_POR_FASE: Record<FaseFormacao, 'proximas-primeiro' | 'recentes-primeiro'> = {
  'a-realizar': 'proximas-primeiro',
  acontecendo: 'proximas-primeiro',
  encerrada: 'recentes-primeiro',
  concluida: 'recentes-primeiro',
  arquivada: 'recentes-primeiro',
};

const ms = (t: Timestamp | null | undefined) => paraData(t)?.getTime() ?? null;

export function ordenarColuna(items: Formacao[], fase: FaseFormacao): Formacao[] {
  const modo = ORDEM_POR_FASE[fase];
  // Coluna de futuro se guia pelo início; a de passado, pelo fim (com o início como
  // reserva, para o card não cair no fim só por não ter data de término).
  const dataDe = (f: Formacao) =>
    modo === 'proximas-primeiro' ? ms(f.dataInicio) ?? ms(f.dataFim) : ms(f.dataFim) ?? ms(f.dataInicio);

  return [...items].sort((a, b) => {
    const da = dataDe(a);
    const db = dataDe(b);
    if (da === null && db === null) return (a.titulo || '').localeCompare(b.titulo || '');
    if (da === null) return 1;
    if (db === null) return -1;
    return modo === 'proximas-primeiro' ? da - db : db - da;
  });
}

// ---------------------------------------------------------------------------
// Filas
// ---------------------------------------------------------------------------

export type FilaId = 'atrasadas' | 'em-breve' | 'sem-formador' | 'sem-data' | 'avaliacao-aberta';

export interface ContextoCard {
  formacao: Formacao;
  fase: FaseFormacao;
  alertas: Alerta[];
}

export interface Fila {
  id: FilaId;
  rotulo: string;
  /** Explica a regra no tooltip — a pessoa precisa saber por que o card está ali. */
  dica: string;
  /** Cor do número quando há algo na fila. */
  tom: string;
  combina: (c: ContextoCard) => boolean;
}

const temMotivo = (c: ContextoCard, motivo: Alerta['motivo']) => c.alertas.some((a) => a.motivo === motivo);

export const FILAS: Fila[] = [
  {
    id: 'atrasadas',
    rotulo: 'Falta concluir',
    dica: 'A data de fim já passou e ninguém marcou a formação como concluída.',
    tom: 'text-destructive',
    combina: (c) => temMotivo(c, 'fim-vencido'),
  },
  {
    id: 'em-breve',
    rotulo: 'Começam em 7 dias',
    dica: 'Começam hoje ou nos próximos 7 dias — hora de conferir o checklist "antes".',
    tom: 'text-amber-600 dark:text-amber-500',
    combina: (c) => temMotivo(c, 'comeca-em-breve'),
  },
  {
    id: 'sem-formador',
    rotulo: 'Sem formador',
    dica: 'Ainda não concluídas e sem nenhum formador vinculado.',
    tom: 'text-foreground',
    combina: (c) => temMotivo(c, 'sem-formadores'),
  },
  {
    id: 'sem-data',
    rotulo: 'Sem data',
    dica: 'Sem data de início nem de fim. Ficam em "A realizar" até alguém agendar.',
    tom: 'text-foreground',
    combina: (c) => c.fase !== 'concluida' && !c.formacao.dataInicio && !c.formacao.dataFim,
  },
  {
    id: 'avaliacao-aberta',
    rotulo: 'Avaliação aberta',
    dica: 'O formulário de avaliação está recebendo respostas. Feche no detalhe, aba Avaliações.',
    tom: 'text-sky-600 dark:text-sky-400',
    combina: (c) => c.formacao.avaliacoesAbertas === true,
  },
];

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Procura no título, município, UF, código e nome dos formadores; ignora acento. */
export function combinaBusca(f: Formacao, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return true;
  const alvo = normalizar(
    [f.titulo, f.municipio, f.uf, f.codigo, ...(f.formadoresNomes || [])].filter(Boolean).join(' ')
  );
  return t.split(/\s+/).every((parte) => alvo.includes(parte));
}

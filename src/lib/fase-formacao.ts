/**
 * Fase de uma formação: em que ponto ela está HOJE.
 *
 * Regra decidida com a coordenação em 04/11/2026:
 *  - **a data diz a fase**: a realizar → acontecendo → encerrada. Ninguém precisa
 *    "mover" a formação; o calendário move;
 *  - **concluir e arquivar são sempre decisão humana**: só essas duas ficam
 *    gravadas em `status` e só um botão as grava.
 *
 * Por que uma função e não o campo gravado: antes o quadro calculava a coluna pela
 * data, mas o alerta, o Dashboard, a Visão Gerencial e as despesas liam o `status`
 * gravado, que só mudava se alguém trocasse um Select no modal. Eram duas fontes de
 * verdade, e o card chegava a se contradizer ("Em Formação" com o selo "deveria ter
 * começado"). Toda tela que precisa saber a fase deve chamar ESTA função.
 *
 * Os valores antigos `preparacao`, `em-formacao` e `pos-formacao` continuam no
 * banco (e o formulário ainda grava `preparacao` ao criar), mas não significam
 * mais nada: todos querem dizer "ainda não concluída".
 */

import { differenceInCalendarDays, startOfToday } from 'date-fns';
import type { Formacao } from '@/lib/types';

export type FaseFormacao = 'a-realizar' | 'acontecendo' | 'encerrada' | 'concluida' | 'arquivada';

/** As colunas do quadro, na ordem em que aparecem. Arquivada fica fora do quadro. */
export const FASES_DO_QUADRO = ['a-realizar', 'acontecendo', 'encerrada', 'concluida'] as const;

export const FASES: Record<FaseFormacao, { titulo: string; dica: string; ponto: string; selo: string }> = {
  'a-realizar': {
    titulo: 'A realizar',
    dica: 'A data de início ainda não chegou (ou não há data).',
    ponto: 'bg-emerald-500',
    selo: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400',
  },
  acontecendo: {
    titulo: 'Acontecendo',
    dica: 'Hoje está entre a data de início e a de fim.',
    ponto: 'bg-sky-500',
    selo: 'border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-400',
  },
  encerrada: {
    titulo: 'Encerrada',
    dica: 'A data de fim já passou e ninguém marcou como concluída.',
    ponto: 'bg-amber-500',
    selo: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400',
  },
  concluida: {
    titulo: 'Concluída',
    dica: 'Alguém marcou como concluída.',
    ponto: 'bg-violet-500',
    selo: 'border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-400',
  },
  arquivada: {
    titulo: 'Arquivada',
    dica: 'Fora do quadro; aparece em Arquivados.',
    ponto: 'bg-muted-foreground',
    selo: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  },
};

const paraData = (t: { toDate: () => Date } | null | undefined): Date | null => {
  if (!t) return null;
  try {
    return t.toDate();
  } catch {
    return null;
  }
};

/**
 * Compara por DIA de calendário, não por instante: uma formação cujo início foi
 * gravado às 08h de hoje já está "acontecendo" à meia-noite. (A regra antiga usava
 * `isAfter` com hora e deixava o primeiro dia em "Preparação".)
 *
 * Só uma das datas preenchida: vale para as duas (evento de um dia). Nenhuma data:
 * "a realizar" — é planejamento, e a fila "Sem data" aponta o buraco.
 */
export function faseDaFormacao(
  f: Pick<Formacao, 'status' | 'dataInicio' | 'dataFim'>,
  hoje: Date = startOfToday()
): FaseFormacao {
  if (f.status === 'arquivado') return 'arquivada';
  if (f.status === 'concluido') return 'concluida';

  const inicio = paraData(f.dataInicio as any) ?? paraData(f.dataFim as any);
  const fim = paraData(f.dataFim as any) ?? inicio;
  if (!inicio || !fim) return 'a-realizar';

  if (differenceInCalendarDays(inicio, hoje) > 0) return 'a-realizar';
  if (differenceInCalendarDays(fim, hoje) >= 0) return 'acontecendo';
  return 'encerrada';
}

/** Concluir só faz sentido depois que a formação começou. */
export const podeConcluir = (fase: FaseFormacao) => fase === 'acontecendo' || fase === 'encerrada';

/**
 * O formador lança despesa enquanto a formação acontece e depois dela, até alguém
 * concluir. Antes, valia só o status gravado `em-formacao`, que quase ninguém marcava.
 */
export const aceitaDespesa = (fase: FaseFormacao) => fase === 'acontecendo' || fase === 'encerrada';

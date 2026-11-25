'use client';

import { Fragment, type ReactNode } from 'react';
import { CalendarPlus, Check, KanbanSquare, Loader2, MapPin, Milestone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ItemAgenda, Tom } from '@/lib/dashboard/agenda';
import { linkGoogleAgenda } from '@/lib/dashboard/google-agenda';
import { cn } from '@/lib/utils';

/** A urgência vem escrita no texto ("Venceu há 3 dias"); a cor só reforça. */
const COR_DO_TOM: Record<Tom, string> = {
  atrasado: 'font-semibold text-destructive',
  atencao: 'font-semibold text-amber-700 dark:text-amber-500',
  andamento: 'font-semibold text-primary',
  neutro: 'font-semibold text-foreground',
  feito: 'font-semibold text-emerald-700 dark:text-emerald-500',
  'sem-prazo': 'italic',
};

export interface AcoesDoItem {
  onAbrir: (item: ItemAgenda) => void;
  onConcluirFormacao: (item: ItemAgenda) => void;
  onArquivarFormacao: (item: ItemAgenda) => void;
  /** Demanda: concluir. Lembrete: marcar como feito. */
  onMarcarFeito: (item: ItemAgenda) => void;
  /** Chave do item com uma gravação em andamento. */
  ocupado: string | null;
}

/**
 * Um item em duas linhas: o título e uma linha de contexto. Formadores e histórico
 * ficam no detalhe — a versão com tudo no card ficou amontoada no protótipo.
 *
 * O título é o botão que abre o detalhe e cobre a linha inteira (`after:inset-0`);
 * a bolinha de concluir e os botões ficam por cima (`z-10`). Botão só onde decide
 * algo: Concluir (formação que terminou) e Arquivar (logo depois de concluir).
 */
export function ItemDaAgenda({ item, acoes }: { item: ItemAgenda; acoes: AcoesDoItem }) {
  const ocupado = acoes.ocupado === item.chave;
  const abrivel = item.tipo !== 'lembrete';
  const linkAgenda = item.fase !== 'concluida' ? linkGoogleAgenda(item) : null;

  const contexto: ReactNode[] = [
    <span key="quando" className={COR_DO_TOM[item.tom]}>
      {item.quando}
    </span>,
  ];
  if (item.urgente) contexto.push(<span key="urgente" className="text-xs font-semibold text-destructive">● Urgente</span>);
  if (item.semFormador) contexto.push(<span key="sem-formador" className="rounded border bg-muted px-1.5 text-[11px]">Sem formador</span>);
  if (item.local) contexto.push(item.local);
  if (item.responsavel) contexto.push(item.responsavel);
  if (item.detalhe) contexto.push(item.detalhe);
  if (item.automatica) {
    contexto.push(
      <span key="automatica" className="rounded border bg-background px-1.5 text-[11px]" title="Criada automaticamente pelo sistema">
        automática
      </span>
    );
  }

  let marcador: ReactNode;
  if (item.tipo === 'demanda' || item.tipo === 'lembrete') {
    const rotulo = item.tipo === 'demanda' ? 'Concluir demanda' : 'Marcar lembrete como feito';
    marcador = (
      <button
        type="button"
        title={rotulo}
        aria-label={`${rotulo}: ${item.titulo}`}
        disabled={ocupado}
        onClick={() => acoes.onMarcarFeito(item)}
        className="group/marca relative flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-muted-foreground/50 bg-background text-emerald-600 transition-colors before:absolute before:-inset-2.5 hover:border-emerald-600 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:hover:bg-emerald-950 md:h-5 md:w-5"
      >
        {ocupado ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3 opacity-0 transition-opacity group-hover/marca:opacity-100" strokeWidth={3} />
        )}
      </button>
    );
  } else if (item.tipo === 'formacao') {
    marcador =
      item.fase === 'concluida' ? <Check className="h-[17px] w-[17px] text-emerald-600" /> : <KanbanSquare className="h-[17px] w-[17px]" />;
  } else {
    marcador = item.tipo === 'projeto' ? <Milestone className="h-[17px] w-[17px]" /> : <MapPin className="h-[17px] w-[17px]" />;
  }

  let acao: ReactNode = null;
  if (item.tipo === 'formacao' && item.fase === 'encerrada') {
    acao = (
      <Button size="sm" className="h-7 px-2.5 text-xs max-md:h-9" disabled={ocupado} onClick={() => acoes.onConcluirFormacao(item)}>
        {ocupado && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        Concluir
      </Button>
    );
  } else if (item.tipo === 'formacao' && item.fase === 'concluida') {
    acao = (
      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs max-md:h-9" disabled={ocupado} onClick={() => acoes.onArquivarFormacao(item)}>
        {ocupado && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        Arquivar
      </Button>
    );
  }

  return (
    <li className="group relative grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md border-b px-1.5 py-2.5 last:border-b-0 hover:bg-muted/40 max-md:py-3">
      <div className="relative z-10 flex justify-center text-muted-foreground">{marcador}</div>
      <div className="min-w-0">
        {abrivel ? (
          <button
            type="button"
            onClick={() => acoes.onAbrir(item)}
            className="block w-full text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            <span className="line-clamp-2 text-sm font-semibold leading-snug">{item.titulo}</span>
          </button>
        ) : (
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.titulo}</p>
        )}
        {/* No computador a linha de contexto fica numa linha só; o prazo e o "Urgente" vêm primeiro e não são cortados. */}
        <p className="mt-0.5 text-[13px] text-muted-foreground md:truncate">
          {contexto.map((parte, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span aria-hidden className="mx-1 opacity-50">
                  ·
                </span>
              )}
              {parte}
            </Fragment>
          ))}
        </p>
      </div>
      <div className="relative z-10 flex items-center gap-1">
        {linkAgenda && (
          <a
            href={linkAgenda}
            target="_blank"
            rel="noreferrer"
            title="Adicionar ao Google Agenda"
            aria-label={`Adicionar ao Google Agenda: ${item.titulo}`}
            className="hidden rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary focus-visible:opacity-100 group-hover:opacity-100 md:inline-flex"
          >
            <CalendarPlus className="h-4 w-4" />
          </a>
        )}
        {acao}
      </div>
    </li>
  );
}

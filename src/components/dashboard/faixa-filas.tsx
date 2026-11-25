'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface FilaDaFaixa {
  id: string;
  rotulo: string;
  dica: string;
  /** Cor do número quando há algo na fila. */
  tom: string;
  /** `null` = não deu para carregar: mostra "—", porque um 0 falso é pior que um erro. */
  n: number | null;
  /** Fila de formação: abre o /quadro já filtrado. Sem `href`, filtra a própria tela. */
  href?: string;
  /** Rótulo pequeno acima da primeira fila de um grupo ("Demandas"). */
  grupo?: string;
}

/**
 * Contadores clicáveis no topo do Dashboard, no mesmo desenho da BarraFilas do
 * /quadro: no celular rolam de lado; a partir do `sm` viram grade.
 */
export function FaixaFilas({
  filas,
  ativa,
  carregando,
  onFiltrar,
}: {
  filas: FilaDaFaixa[];
  ativa: string | null;
  carregando: boolean;
  onFiltrar: (id: string | null) => void;
}) {
  return (
    <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 pt-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
      {filas.map((fila) => {
        if (carregando) {
          return (
            <div key={fila.id} className="min-w-[8.5rem] shrink-0 rounded-lg border bg-card px-3 py-2 sm:min-w-0">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </div>
          );
        }

        const ativaAgora = ativa === fila.id;
        const classe = cn(
          'relative flex min-w-[8.5rem] shrink-0 snap-start flex-col items-start rounded-lg border bg-card px-3 py-2 text-left transition-colors sm:min-w-0',
          'hover:border-primary/50 hover:bg-accent/30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ativaAgora && 'border-primary bg-primary/5 ring-1 ring-primary'
        );
        const conteudo = (
          <>
            {fila.grupo && (
              <span className="absolute -top-2 left-2.5 bg-background px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {fila.grupo}
              </span>
            )}
            {fila.href && <ArrowUpRight className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
            <span className={cn('text-2xl font-bold leading-none tabular-nums', fila.n ? fila.tom : 'text-muted-foreground/40')}>
              {fila.n === null ? '—' : fila.n}
            </span>
            <span className="mt-1 text-xs font-medium text-muted-foreground">{fila.rotulo}</span>
          </>
        );

        return (
          <Tooltip key={fila.id}>
            <TooltipTrigger asChild>
              {fila.href ? (
                <Link href={fila.href} className={classe}>
                  {conteudo}
                </Link>
              ) : (
                <button type="button" aria-pressed={ativaAgora} onClick={() => onFiltrar(ativaAgora ? null : fila.id)} className={classe}>
                  {conteudo}
                </button>
              )}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {fila.dica}
              <span className="mt-1 block text-muted-foreground">
                {fila.href ? 'Abre o Acompanhamento já filtrado.' : ativaAgora ? 'Clique para remover o filtro.' : 'Clique para filtrar a lista.'}
              </span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

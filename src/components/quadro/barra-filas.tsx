'use client';

import { CalendarX2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PendenciaProjeto } from '@/lib/alertas';
import { cn } from '@/lib/utils';
import { FILAS, type FilaId } from './quadro-modelo';

/**
 * Filas (contadores que também são filtros) + busca, no padrão da /diario.
 * As etapas de projeto sem data ficam num botão à parte: não são formações, então
 * não filtram o quadro — só listam o que falta agendar.
 */
export function BarraFilas({
  contagem,
  filaAtiva,
  onFila,
  busca,
  onBusca,
  pendencias,
}: {
  contagem: Record<FilaId, number>;
  filaAtiva: FilaId | null;
  onFila: (id: FilaId | null) => void;
  busca: string;
  onBusca: (v: string) => void;
  pendencias: PendenciaProjeto[];
}) {
  return (
    <div className="space-y-3">
      {/* No celular as filas rolam de lado; a partir do sm viram grade. */}
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
        {FILAS.map((fila) => {
          const n = contagem[fila.id] ?? 0;
          const ativa = filaAtiva === fila.id;
          return (
            <Tooltip key={fila.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => onFila(ativa ? null : fila.id)}
                  className={cn(
                    'flex min-w-[8.5rem] shrink-0 snap-start flex-col items-start rounded-lg border bg-card px-3 py-2 text-left transition-colors sm:min-w-0',
                    'hover:border-primary/50 hover:bg-accent/30',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ativa && 'border-primary bg-primary/5 ring-1 ring-primary'
                  )}
                >
                  <span className={cn('text-2xl font-bold leading-none', n > 0 ? fila.tom : 'text-muted-foreground/40')}>
                    {n}
                  </span>
                  <span className="mt-1 text-xs font-medium text-muted-foreground">{fila.rotulo}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {fila.dica}
                <span className="mt-1 block text-muted-foreground">
                  {ativa ? 'Clique para remover o filtro.' : 'Clique para filtrar o quadro.'}
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar por título, município, código ou formador"
            aria-label="Buscar formações"
            className="h-10 pl-8 pr-9"
          />
          {busca && (
            <button
              type="button"
              onClick={() => onBusca('')}
              aria-label="Limpar busca"
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {pendencias.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 shrink-0 justify-start">
                <CalendarX2 className="mr-2 h-4 w-4 text-muted-foreground" />
                {pendencias.length} {pendencias.length === 1 ? 'etapa de projeto sem data' : 'etapas de projeto sem data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-80 w-80 overflow-y-auto">
              <p className="mb-1 text-sm font-medium">Falta agendar</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Etapa sem data não vira formação, por isso não aparece no quadro.
              </p>
              <ul className="space-y-1 text-xs">
                {pendencias.map((pd, i) => (
                  <li key={pd.projetoId + pd.etapa + i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{pd.projetoNome}</span>
                    <span>
                      {pd.etapa} <span className="text-muted-foreground">({pd.texto})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

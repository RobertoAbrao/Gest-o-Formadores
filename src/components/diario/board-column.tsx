'use client';

import { useState } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Demanda, StatusDemanda } from '@/lib/types';
import { STATUS_CONFIG } from './diario-utils';

const PAGINA = 15;

export interface BoardColumnProps {
  status: StatusDemanda;
  demandas: Demanda[];
  /** Quantas demandas existem antes de qualquer recorte de período (coluna Concluída). */
  totalSemRecorte?: number;
  isDropTarget: boolean;
  onDropDemanda: (status: StatusDemanda) => void;
  onDragEnter: (status: StatusDemanda) => void;
  onDragLeave: () => void;
  renderCard: (demanda: Demanda) => React.ReactNode;
  /** Controle extra no cabeçalho, ex.: o seletor de período da coluna Concluída. */
  headerExtra?: React.ReactNode;
  emptyLabel?: string;
}

export function BoardColumn({
  status,
  demandas,
  totalSemRecorte,
  isDropTarget,
  onDropDemanda,
  onDragEnter,
  onDragLeave,
  renderCard,
  headerExtra,
  emptyLabel = 'Nada por aqui.',
}: BoardColumnProps) {
  const [limite, setLimite] = useState(PAGINA);
  const config = STATUS_CONFIG[status];
  const visiveis = demandas.slice(0, limite);
  const restantes = demandas.length - visiveis.length;

  return (
    <div
      onDragOver={(e) => {
        // Sem preventDefault o navegador recusa o drop.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={() => onDragEnter(status)}
      onDragLeave={(e) => {
        // Ignora a troca de alvo entre filhos da própria coluna.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        onDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropDemanda(status);
      }}
      className={cn(
        'flex min-w-[280px] snap-start flex-col rounded-lg border bg-muted/40 transition-colors md:min-w-0',
        isDropTarget && 'border-primary bg-primary/5 ring-2 ring-primary/40',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', config.dot)} />
              <h2 className="truncate text-sm font-semibold">{config.label}</h2>
              <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {demandas.length}
                {totalSemRecorte !== undefined && totalSemRecorte !== demandas.length && (
                  <span className="font-normal">/{totalSemRecorte}</span>
                )}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{config.hint}</TooltipContent>
        </Tooltip>
        {headerExtra}
      </div>

      <ScrollArea className="h-[calc(100vh-27rem)] min-h-[18rem]">
        <div className="flex flex-col gap-2 p-2">
          {demandas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
              <Inbox className="h-6 w-6 opacity-40" />
              {emptyLabel}
            </div>
          ) : (
            <>
              {visiveis.map((demanda) => renderCard(demanda))}
              {restantes > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setLimite((l) => l + PAGINA)}
                >
                  <ChevronDown className="mr-1 h-3.5 w-3.5" />
                  Ver mais {restantes}
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FASES, type FaseFormacao } from '@/lib/fase-formacao';
import { cn } from '@/lib/utils';

/** Cards renderizados de saída; o resto entra no "Ver mais" (Concluída cresce sem parar). */
const PAGINA = 25;

export function ColunaQuadro<T>({
  fase,
  itens,
  total,
  filtrando,
  renderCard,
  className,
}: {
  fase: FaseFormacao;
  itens: T[];
  /** Quantos há na coluna sem filtro — para mostrar "3/9" quando há fila ou busca. */
  total: number;
  filtrando: boolean;
  renderCard: (item: T) => ReactNode;
  className?: string;
}) {
  const [limite, setLimite] = useState(PAGINA);
  const config = FASES[fase];
  const visiveis = itens.slice(0, limite);
  const restantes = itens.length - visiveis.length;

  return (
    <section aria-label={config.titulo} className={cn('flex min-w-0 flex-col rounded-lg border bg-muted/40', className)}>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', config.ponto)} />
              <h2 className="truncate text-sm font-semibold">{config.titulo}</h2>
              <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {itens.length}
                {filtrando && total !== itens.length && <span className="font-normal">/{total}</span>}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{config.dica}</TooltipContent>
        </Tooltip>
      </div>

      {/* No desktop cada coluna rola sozinha; no celular a página rola (uma coluna por vez). */}
      <div className="flex flex-col gap-2 p-2 lg:max-h-[calc(100vh-22rem)] lg:min-h-[16rem] lg:overflow-y-auto">
        {itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
            <Inbox className="h-6 w-6 opacity-40" />
            {filtrando ? 'Nada aqui com este filtro.' : 'Nenhuma formação nesta fase.'}
          </div>
        ) : (
          <>
            {visiveis.map((item) => renderCard(item))}
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
    </section>
  );
}

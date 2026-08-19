'use client';

import { ArrowUpDown, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  LEGENDA_SLA,
  ORDENACOES,
  PRIORIDADE_OPTIONS,
  QUEUES,
  contarFiltrosAtivos,
  type DiarioFiltros,
  type QueueId,
} from './diario-utils';

export interface DiarioToolbarProps {
  filtros: DiarioFiltros;
  onChange: (patch: Partial<DiarioFiltros>) => void;
  onLimpar: () => void;
  /** Contagem de cada fila, já considerando os demais filtros ativos. */
  queueCounts: Record<QueueId, number>;
  responsaveis: { id: string; nome: string }[];
  totalVisivel: number;
  totalGeral: number;
}

export function DiarioToolbar({
  filtros,
  onChange,
  onLimpar,
  queueCounts,
  responsaveis,
  totalVisivel,
  totalGeral,
}: DiarioToolbarProps) {
  const filtrosAtivos = contarFiltrosAtivos(filtros);

  return (
    <div className="space-y-3">
      {/* Filas: contadores que também são filtros */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {QUEUES.map((queue) => {
          const count = queueCounts[queue.id] ?? 0;
          const ativa = filtros.queue === queue.id;
          return (
            <Tooltip key={queue.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => onChange({ queue: ativa ? null : queue.id })}
                  className={cn(
                    'flex flex-col items-start rounded-lg border bg-card px-3 py-2 text-left transition-colors',
                    'hover:border-primary/50 hover:bg-accent/30',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ativa && 'border-primary bg-primary/5 ring-1 ring-primary',
                  )}
                >
                  <span
                    className={cn(
                      'text-2xl font-bold leading-none',
                      count > 0 ? queue.tone : 'text-muted-foreground/40',
                    )}
                  >
                    {count}
                  </span>
                  <span className="mt-1 text-xs font-medium text-muted-foreground">
                    {queue.label}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {queue.descricao}
                <span className="mt-1 block text-muted-foreground">
                  {ativa ? 'Clique para remover o filtro.' : 'Clique para filtrar o quadro.'}
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-2 md:flex-row md:flex-wrap md:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por município, demanda ou responsável..."
            className="h-9 pl-8"
            value={filtros.busca}
            onChange={(e) => onChange({ busca: e.target.value })}
          />
        </div>

        <ToggleGroup
          type="single"
          value={filtros.escopo}
          onValueChange={(v) => v && onChange({ escopo: v as DiarioFiltros['escopo'] })}
          className="h-9 rounded-md border"
        >
          <ToggleGroupItem value="todas" className="h-8 px-3 text-xs">
            Todas
          </ToggleGroupItem>
          <ToggleGroupItem value="minhas" className="h-8 px-3 text-xs">
            Minhas
          </ToggleGroupItem>
        </ToggleGroup>

        <Select
          value={filtros.responsavelId}
          onValueChange={(v) => onChange({ responsavelId: v })}
        >
          <SelectTrigger className="h-9 w-full md:w-[180px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.prioridade}
          onValueChange={(v) => onChange({ prioridade: v as DiarioFiltros['prioridade'] })}
        >
          <SelectTrigger className="h-9 w-full md:w-[150px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {PRIORIDADE_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.ordenacao}
          onValueChange={(v) => onChange({ ordenacao: v as DiarioFiltros['ordenacao'] })}
        >
          <SelectTrigger className="h-9 w-full md:w-[210px]">
            <ArrowUpDown className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {ORDENACOES.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtrosAtivos > 0 && (
          <Button variant="ghost" size="sm" onClick={onLimpar} className="h-9 gap-1 text-xs">
            <X className="h-3.5 w-3.5" />
            Limpar ({filtrosAtivos})
          </Button>
        )}
      </div>

      {/* Legenda + contagem: explica as cores que antes eram mudas */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
        <span className="font-medium">
          {totalVisivel} de {totalGeral} demandas
        </span>
        <span className="hidden md:inline">
          Arraste um card entre colunas para mudar o status.
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-3">
          {LEGENDA_SLA.map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span className={cn('h-2 w-3 rounded-sm', item.className)} />
              {item.label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

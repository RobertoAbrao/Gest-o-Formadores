'use client';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Flag,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Target,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Demanda, StatusDemanda } from '@/lib/types';
import {
  STATUS_CONFIG,
  STATUS_OPTIONS,
  contarComentarios,
  formatEtapaName,
  getDemandaKey,
  getIniciais,
  getSla,
  getUltimaAtividade,
} from './diario-utils';

export interface DemandaCardProps {
  demanda: Demanda;
  onOpen: (demanda: Demanda) => void;
  onMoverStatus: (demanda: Demanda, status: StatusDemanda) => void;
  onAlternarPrioridade: (demanda: Demanda) => void;
  onValidar: (demanda: Demanda) => void;
  onExcluir: (demanda: Demanda) => void;
  canValidate: boolean;
  canDelete: boolean;
  /** `true` enquanto uma mutação otimista desta demanda está em voo. */
  isBusy?: boolean;
  isDragging?: boolean;
  onDragStart: (demanda: Demanda) => void;
  onDragEnd: () => void;
}

export function DemandaCard({
  demanda,
  onOpen,
  onMoverStatus,
  onAlternarPrioridade,
  onValidar,
  onExcluir,
  canValidate,
  canDelete,
  isBusy = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: DemandaCardProps) {
  const sla = getSla(demanda);
  const atividade = getUltimaAtividade(demanda);
  const comentarios = contarComentarios(demanda);
  const isUrgente = demanda.prioridade === 'Urgente';
  const encerrada = demanda.status === 'Concluída' || !!demanda.validado;
  const outrosStatus = STATUS_OPTIONS.filter((s) => s !== demanda.status);

  const atividadeRelativa = atividade?.data?.toDate
    ? formatDistanceToNow(atividade.data.toDate(), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', demanda.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(demanda);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(demanda)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(demanda);
        }
      }}
      className={cn(
        'group relative flex cursor-grab flex-col gap-2 overflow-hidden rounded-md border bg-card p-2.5 pl-3.5 text-left shadow-sm',
        'transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'active:cursor-grabbing',
        isDragging && 'opacity-40',
        encerrada && 'bg-muted/40',
        isBusy && 'pointer-events-none opacity-60',
      )}
    >
      {/* Barra lateral: cor = situação do prazo */}
      <span className={cn('absolute inset-y-0 left-0 w-1', sla.barClass)} aria-hidden />

      {isBusy && (
        <span className="absolute right-2 top-2 z-10">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </span>
      )}

      {/* Linha 1: prazo + prioridade + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none',
                  sla.chipClass,
                )}
              >
                {sla.label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{sla.detalhe}</TooltipContent>
          </Tooltip>

          {isUrgente && !encerrada && (
            <span className="flex items-center gap-1 rounded border border-rose-300 bg-rose-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
              <AlertTriangle className="h-3 w-3" />
              Urgente
            </span>
          )}

          {demanda.validado && (
            <span className="flex items-center gap-1 rounded border border-teal-300 bg-teal-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-teal-800 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
              <BadgeCheck className="h-3 w-3" />
              Validada
            </span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              className="h-6 w-6 shrink-0 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <span className="sr-only">Ações da demanda</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Flag className="mr-2 h-4 w-4" />
                Mover para
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {outrosStatus.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoverStatus(demanda, status);
                      }}
                    >
                      <span className={cn('mr-2 h-2 w-2 rounded-full', STATUS_CONFIG[status].dot)} />
                      {STATUS_CONFIG[status].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAlternarPrioridade(demanda);
              }}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {isUrgente ? 'Remover urgência' : 'Marcar como urgente'}
            </DropdownMenuItem>

            {demanda.status === 'Concluída' && !demanda.validado && canValidate && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onValidar(demanda);
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Validar demanda
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onOpen(demanda);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Abrir e editar
            </DropdownMenuItem>

            {canDelete && (
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onExcluir(demanda);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
              {getDemandaKey(demanda.id)}
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Linha 2: identificação e resumo */}
      <div className="space-y-1">
        <p className="text-sm font-semibold leading-tight">
          {demanda.municipio}
          <span className="font-normal text-muted-foreground"> · {demanda.uf}</span>
        </p>
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{demanda.demanda}</p>
      </div>

      {/* Linha 3: contexto do projeto */}
      {(demanda.projetoOrigemId || demanda.etapaProjeto || demanda.sincronizadoCalendario) && (
        <div className="flex flex-wrap items-center gap-1">
          {demanda.projetoOrigemId && (
            <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
              <ClipboardList className="h-2.5 w-2.5" />
              {demanda.projetoOrigemNome || `Projeto ${demanda.projetoOrigemId.slice(0, 4)}`}
            </Badge>
          )}
          {demanda.etapaProjeto && (
            <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
              <Target className="h-2.5 w-2.5" />
              {formatEtapaName(demanda.etapaProjeto)}
            </Badge>
          )}
          {demanda.sincronizadoCalendario && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center rounded border border-blue-300 px-1 py-0.5 text-blue-600 dark:border-blue-800 dark:text-blue-400">
                  <CalendarDays className="h-2.5 w-2.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Já foi lançada na agenda</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Rodapé: responsável e última atividade */}
      <div className="flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                {getIniciais(demanda.responsavelNome)}
              </span>
              <span className="truncate">{demanda.responsavelNome}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>Responsável: {demanda.responsavelNome}</TooltipContent>
        </Tooltip>

        <span className="flex shrink-0 items-center gap-2">
          {comentarios > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {comentarios}
            </span>
          )}
          {atividadeRelativa && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate">{atividadeRelativa}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <span className="font-medium">{atividade?.autorNome}</span>
                {atividade?.tipo === 'comentario' ? ' comentou: ' : ': '}
                {atividade?.texto}
              </TooltipContent>
            </Tooltip>
          )}
        </span>
      </div>

      {/* Última mensagem humana em destaque — o "diário" propriamente dito */}
      {atividade?.tipo === 'comentario' && (
        <p className="line-clamp-1 rounded bg-muted/60 px-1.5 py-1 text-[11px] italic text-muted-foreground">
          &ldquo;{atividade.texto}&rdquo;
        </p>
      )}
    </div>
  );
}

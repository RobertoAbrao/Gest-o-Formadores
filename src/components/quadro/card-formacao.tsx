'use client';

import Link from 'next/link';
import {
  Archive,
  CheckCircle,
  Copy,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Pencil,
  QrCode,
  Share,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CORES_GRAVIDADE } from '@/lib/alertas';
import { progressoChecklist } from '@/lib/checklist-formacao';
import { cn } from '@/lib/utils';
import { formadoresCurto, periodoCurto, tituloDaFormacao, type ContextoCard } from './quadro-modelo';

const BORDA_POR_GRAVIDADE = {
  atrasado: 'border-l-destructive',
  atencao: 'border-l-amber-500',
  incompleto: 'border-l-muted-foreground/40',
} as const;

/**
 * Card de uma formação no quadro.
 *
 * Linha 1: o que exige atenção (alerta em texto, não só cor).
 * Linha 2: título — é um <button>, e é ele que abre pelo teclado.
 * Linha 3: código · período · formadores.
 * Linha 4: progresso do checklist.
 * Rodapé: a única ação que a coluna pede (Concluir em "Encerrada", Arquivar em "Concluída").
 *
 * O card inteiro abre o detalhe no clique do mouse, mas NÃO escuta teclado: um
 * onKeyDown aqui receberia o Enter dado dentro do menu ⋯ (eventos React sobem pelo
 * portal do Radix) e abriria o detalhe junto com a ação. Por isso o teclado entra
 * pelo título, e cada botão interno para a propagação do clique.
 */
export function CardFormacao({
  contexto,
  ocupado,
  onAbrir,
  onEditar,
  onConcluir,
  onArquivar,
  onExcluir,
  onCopiarLink,
  onQRCode,
}: {
  contexto: ContextoCard;
  ocupado: boolean;
  onAbrir: () => void;
  onEditar: () => void;
  onConcluir: () => void;
  onArquivar: () => void;
  onExcluir: () => void;
  onCopiarLink: () => void;
  onQRCode: () => void;
}) {
  const { formacao: f, fase, alertas } = contexto;
  const titulo = tituloDaFormacao(f);
  const periodo = periodoCurto(f);
  const formadores = formadoresCurto(f);
  const checklist = progressoChecklist(f);
  const pct = checklist.total ? Math.round((checklist.feitos / checklist.total) * 100) : 0;

  // A borda acompanha o alerta mais grave; sem alerta, card neutro.
  const pior = alertas.find((a) => a.gravidade === 'atrasado') ?? alertas.find((a) => a.gravidade === 'atencao');
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      onClick={onAbrir}
      className={cn(
        'group cursor-pointer rounded-lg border border-l-4 bg-card shadow-sm transition-shadow hover:shadow-md',
        pior ? BORDA_POR_GRAVIDADE[pior.gravidade] : 'border-l-border'
      )}
    >
      <div className="flex items-start gap-1 p-3 pb-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          {alertas.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {alertas.map((a) => (
                <span
                  key={a.motivo}
                  className={cn(
                    'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-tight',
                    CORES_GRAVIDADE[a.gravidade]
                  )}
                >
                  {a.texto}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAbrir();
            }}
            className="line-clamp-2 rounded-sm text-left text-sm font-semibold leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {titulo}
          </button>

          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className="font-mono text-[11px]">{f.codigo}</span>
            {periodo && (
              <>
                <span aria-hidden>·</span>
                <span>{periodo}</span>
              </>
            )}
            {formadores && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{formadores}</span>
              </>
            )}
          </p>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground" title="Itens do checklist marcados">
            <span>Checklist</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular-nums">
              {checklist.feitos}/{checklist.total}
            </span>
          </div>
        </div>

        <div className="-mr-1 -mt-1 flex shrink-0 items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 lg:h-8 lg:w-8"
                aria-label="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditar();
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={parar}>
              <Button variant="ghost" size="icon" className="h-10 w-10 lg:h-8 lg:w-8" aria-label="Mais ações">
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            {/* O conteúdo vai para um portal, mas o clique ainda sobe pela árvore React até o card. */}
            <DropdownMenuContent align="end" onClick={parar} className="w-60">
              <DropdownMenuItem asChild>
                <Link href={`/ficha/${f.id}`} target="_blank" rel="noopener">
                  <Megaphone className="mr-2 h-4 w-4" />
                  Gerar ficha de divulgação
                </Link>
              </DropdownMenuItem>
              {f.avaliacoesAbertas ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Share className="mr-2 h-4 w-4" />
                    Compartilhar avaliação
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent onClick={parar}>
                      <DropdownMenuItem onClick={onCopiarLink}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar link do formulário
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onQRCode}>
                        <QrCode className="mr-2 h-4 w-4" />
                        Gerar QR Code
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              ) : (
                // Fechada, o formulário recusa quem chega pelo link — não adianta entregá-lo.
                <DropdownMenuItem disabled className="flex-col items-start gap-0">
                  <span className="flex items-center">
                    <Share className="mr-2 h-4 w-4" />
                    Compartilhar avaliação
                  </span>
                  <span className="pl-6 text-[11px]">Avaliação fechada: abra no detalhe, aba Avaliações</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={onExcluir}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(fase === 'encerrada' || fase === 'concluida') && (
        <div className="px-3 pb-3">
          {fase === 'encerrada' ? (
            <Button
              size="sm"
              className="h-10 w-full lg:h-9"
              disabled={ocupado}
              onClick={(e) => {
                e.stopPropagation();
                onConcluir();
              }}
            >
              {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Concluir
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="h-10 w-full lg:h-9"
              disabled={ocupado}
              onClick={(e) => {
                e.stopPropagation();
                onArquivar();
              }}
            >
              {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Arquivar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

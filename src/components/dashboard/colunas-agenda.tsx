'use client';

import { useState } from 'react';
import type { AgendaAgrupada, ItemAgenda } from '@/lib/dashboard/agenda';
import { cn } from '@/lib/utils';
import { ItemDaAgenda, type AcoesDoItem } from './item-agenda';

type Coluna = 'atrasado' | 'hoje' | 'proximos';

const COLUNAS: { id: Coluna; titulo: string; curto: string; vazio: string; estilo: string }[] = [
  { id: 'atrasado', titulo: 'Atrasado', curto: 'Atrasado', vazio: 'Nada atrasado.', estilo: 'border-destructive/40 text-destructive' },
  { id: 'hoje', titulo: 'Hoje', curto: 'Hoje', vazio: 'Nada para hoje.', estilo: 'border-amber-500/50 text-amber-700 dark:text-amber-500' },
  { id: 'proximos', titulo: 'Próximos 7 dias', curto: '7 dias', vazio: 'Nada nos próximos 7 dias.', estilo: 'border-primary/30 text-primary' },
];

/** Até 5 por coluna; o resto atrás de "Ver mais" — sem rolagem dentro da coluna. */
const TETO = 5;

/**
 * Atrasado | Hoje | Próximos 7 dias, lado a lado: o "Hoje" fica sempre no topo, não
 * importa quantos atrasados existam (pedido feito no protótipo, 25/11/2026 — na lista
 * única, quatro atrasados empurravam o "Hoje" para baixo da dobra).
 *
 * Tela média: Atrasado e Hoje lado a lado, Próximos embaixo. Celular: uma coluna por
 * vez, escolhida por abas com a contagem à vista — como o /quadro no celular.
 */
export function ColunasAgenda({ grupos, filtrando, acoes }: { grupos: AgendaAgrupada; filtrando: boolean; acoes: AcoesDoItem }) {
  const [mais, setMais] = useState<Partial<Record<Coluna, boolean>>>({});
  const [abaEscolhida, setAbaEscolhida] = useState<Coluna | null>(null);

  // Com uma fila filtrando, "Próximos" mostra também o que vem depois dos 7 dias.
  const adiante = filtrando ? grupos.adiante : [];
  const total = (c: Coluna) => grupos[c].length + (c === 'proximos' ? adiante.length : 0);

  // Celular: abre na coluna que pede ação; com filtro, pula para uma que tenha itens.
  const padrao: Coluna = total('atrasado') > 0 ? 'atrasado' : total('hoje') > 0 ? 'hoje' : 'proximos';
  let aba = abaEscolhida ?? padrao;
  if (filtrando && total(aba) === 0) aba = COLUNAS.find((c) => total(c.id) > 0)?.id ?? aba;

  const lista = (itens: ItemAgenda[]) => (
    <ul>
      {itens.map((i) => (
        <ItemDaAgenda key={i.chave} item={i} acoes={acoes} />
      ))}
    </ul>
  );

  return (
    <>
      <div role="tablist" aria-label="Colunas" className="mb-1 flex gap-1 rounded-lg bg-muted p-1 md:hidden">
        {COLUNAS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={aba === c.id}
            onClick={() => setAbaEscolhida(c.id)}
            className={cn(
              'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-muted-foreground transition-colors',
              aba === c.id && 'bg-background text-foreground shadow-sm'
            )}
          >
            {c.curto}
            <span className={cn('tabular-nums', c.id === 'atrasado' && total(c.id) > 0 && 'text-destructive')}>{total(c.id)}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {COLUNAS.map((c) => {
          const itens = grupos[c.id];
          const tudo = mais[c.id] || itens.length <= TETO;
          const vazia = itens.length === 0 && (c.id !== 'proximos' || adiante.length === 0);
          return (
            <section
              key={c.id}
              aria-label={c.titulo}
              className={cn('min-w-0', aba !== c.id && 'hidden md:block', c.id === 'proximos' && 'md:col-span-2 xl:col-span-1')}
            >
              <h3
                className={cn(
                  'hidden items-center gap-2 border-b-2 px-0.5 pb-1.5 pt-1 text-xs font-bold uppercase tracking-wider md:flex',
                  c.estilo
                )}
              >
                {c.titulo}
                <span className="rounded-full bg-muted px-2 text-[11px] tabular-nums tracking-normal text-foreground">{total(c.id)}</span>
              </h3>

              {vazia ? <p className="px-0.5 py-4 text-sm text-muted-foreground">{c.vazio}</p> : lista(tudo ? itens : itens.slice(0, TETO))}

              {!tudo && (
                <button
                  type="button"
                  onClick={() => setMais((m) => ({ ...m, [c.id]: true }))}
                  className="px-0.5 py-2 text-sm font-semibold text-primary hover:underline"
                >
                  Ver mais {itens.length - TETO}
                </button>
              )}

              {c.id === 'proximos' && adiante.length > 0 && (
                <>
                  <p className="px-0.5 pb-0.5 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Depois de 7 dias</p>
                  {lista(adiante)}
                </>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

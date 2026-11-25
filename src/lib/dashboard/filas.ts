/**
 * Filas do Dashboard: os contadores clicáveis do topo, no padrão do /quadro.
 *
 * - As de FORMAÇÃO são as mesmas do /quadro (mesma regra, mesmo número) e o clique
 *   abre o Acompanhamento já filtrado (`/quadro?fila=...`). Contar de outro jeito
 *   faria o Dashboard dizer 3 e o quadro mostrar 5.
 * - As de DEMANDA filtram a própria tela: o Diário de Bordo está fora do menu
 *   (decisão de 25/11/2026), então o Dashboard é onde elas aparecem.
 *
 * Contagem inclusiva: o número da fila é o que aparece ao clicar nela.
 */

import { FILAS, type ContextoCard, type Fila, type FilaId } from '@/components/quadro/quadro-modelo';
import { alertasDaFormacao } from '@/lib/alertas';
import { faseDaFormacao } from '@/lib/fase-formacao';
import type { Formacao } from '@/lib/types';
import type { ItemAgenda } from './agenda';

export const IDS_FILAS_DE_FORMACAO: FilaId[] = ['atrasadas', 'em-breve', 'sem-formador'];

export const FILAS_DE_FORMACAO: Fila[] = IDS_FILAS_DE_FORMACAO.map((id) => FILAS.find((f) => f.id === id)!);

/** Mesmo cálculo do /quadro (src/app/(app)/quadro/page.tsx): fase + alertas, sem arquivadas. */
export function contarFilasDeFormacao(formacoes: Formacao[], hoje: Date): Record<FilaId, number> {
  const contextos: ContextoCard[] = formacoes
    .map((f) => ({ formacao: f, fase: faseDaFormacao(f, hoje), alertas: alertasDaFormacao(f, hoje) }))
    .filter((c) => c.fase !== 'arquivada');
  const r = {} as Record<FilaId, number>;
  for (const fila of FILAS) r[fila.id] = contextos.filter(fila.combina).length;
  return r;
}

export type FilaDeDemandaId = 'dem-vencidas' | 'dem-sem-prazo';

export interface FilaDeDemanda {
  id: FilaDeDemandaId;
  rotulo: string;
  dica: string;
  tom: string;
  combina: (i: ItemAgenda) => boolean;
}

export const FILAS_DE_DEMANDA: FilaDeDemanda[] = [
  {
    id: 'dem-vencidas',
    rotulo: 'Demandas vencidas',
    dica: 'O prazo passou e a demanda não foi concluída — de qualquer data, não só de ontem.',
    tom: 'text-destructive',
    combina: (i) => i.tipo === 'demanda' && i.grupo === 'atrasado',
  },
  {
    id: 'dem-sem-prazo',
    rotulo: 'Demandas sem prazo',
    dica: 'Demandas abertas sem data. Ficam na faixa "Sem prazo", abaixo das colunas.',
    tom: 'text-foreground',
    combina: (i) => i.tipo === 'demanda' && i.grupo === 'sem-prazo',
  },
];

export function contarFilasDeDemanda(itens: ItemAgenda[]): Record<FilaDeDemandaId, number> {
  return {
    'dem-vencidas': itens.filter(FILAS_DE_DEMANDA[0].combina).length,
    'dem-sem-prazo': itens.filter(FILAS_DE_DEMANDA[1].combina).length,
  };
}

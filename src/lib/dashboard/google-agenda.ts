import { addDays } from 'date-fns';
import type { ItemAgenda } from './agenda';

/**
 * Convidados sugeridos no "Adicionar ao Google Agenda" — a mesma lista que o
 * Dashboard usava desde antes do redesenho (25/11/2026). Quem clica ainda pode
 * tirar convidados antes de salvar o evento no Google.
 */
const CONVIDADOS = [
  'alessandra@editoralt.com.br',
  'amaranta@editoralt.com.br',
  'assessoria@editoralt.com.br',
  'irene@editoralt.com.br',
];

const aaaammdd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** Link de evento de dia inteiro (o Google pede o fim no dia seguinte). `null` sem data. */
export function linkGoogleAgenda(item: Pick<ItemAgenda, 'titulo' | 'data' | 'local' | 'detalhe'>): string | null {
  if (!item.data) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.titulo,
    dates: `${aaaammdd(item.data)}/${aaaammdd(addDays(item.data, 1))}`,
    details: [item.local, item.detalhe].filter(Boolean).join(' · '),
    add: CONVIDADOS.join(','),
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

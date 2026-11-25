'use client';

import { useEffect, useState } from 'react';
import { addDays, startOfToday } from 'date-fns';

/**
 * O dia de hoje (00:00), que vira sozinho à meia-noite.
 *
 * Por que não `startOfToday()` direto num useMemo: ele congela no primeiro render.
 * Uma aba deixada aberta de um dia para o outro continuaria chamando de "Hoje" o que
 * já é ontem — e o "Atrasado" não acenderia.
 */
export function useHoje(): Date {
  const [hoje, setHoje] = useState(startOfToday);

  useEffect(() => {
    const ateAmanha = addDays(hoje, 1).getTime() - Date.now();
    const t = setTimeout(() => setHoje(startOfToday()), Math.max(ateAmanha + 1000, 1000));
    return () => clearTimeout(t);
  }, [hoje]);

  return hoje;
}

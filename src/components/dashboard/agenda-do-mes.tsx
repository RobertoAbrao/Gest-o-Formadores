'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { itensDoDia, type ItemAgenda } from '@/lib/dashboard/agenda';

/**
 * O mês num atalho: o calendário grande saiu da página no redesenho (25/11/2026), mas
 * continua a um clique. Dia com sublinhado âmbar tem algo marcado.
 */
export function AgendaDoMes({ itens, hoje }: { itens: ItemAgenda[]; hoje: Date }) {
  const [dia, setDia] = useState<Date | undefined>(hoje);
  const diasComEvento = useMemo(() => itens.flatMap((i) => i.dias), [itens]);
  const doDia = useMemo(() => (dia ? itensDoDia(itens, dia) : []), [itens, dia]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10" aria-label="Ver o mês">
          <CalendarDays className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Mês</span>
          <ChevronDown className="ml-1 hidden h-3.5 w-3.5 opacity-60 sm:inline" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <Calendar
          mode="single"
          selected={dia}
          onSelect={setDia}
          locale={ptBR}
          modifiers={{ comEvento: diasComEvento }}
          modifiersClassNames={{ comEvento: 'font-bold underline decoration-amber-500 decoration-2 underline-offset-4' }}
        />
        <div className="mt-2 w-[276px] border-t pt-2 text-sm">
          {dia && <p className="mb-1 font-semibold first-letter:uppercase">{format(dia, 'EEEE, dd/MM', { locale: ptBR })}</p>}
          {doDia.length === 0 ? (
            <p className="text-muted-foreground">Nada neste dia.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {doDia.map((i) => (
                <li key={i.chave} className="leading-snug">
                  <span className="font-medium">{i.titulo}</span>
                  {i.local && <span className="text-muted-foreground"> · {i.local}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

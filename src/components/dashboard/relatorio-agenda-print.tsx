
'use client';

import type { CalendarEvent } from '@/app/(app)/agenda-relatorio/[year]/[month]/page';
import { Timestamp } from 'firebase/firestore';
import AppLogo from '../AppLogo';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { KanbanSquare, Milestone, Bell, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RelatorioProps {
  events: CalendarEvent[];
  year: number;
  month: number;
}

const formatDate = (timestamp: Timestamp | null | undefined, options?: Intl.DateTimeFormatOptions) => {
    if (!timestamp) return 'N/A';
    const defaultOptions: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    };
    return timestamp.toDate().toLocaleDateString('pt-BR', options || defaultOptions);
}

const formatMonthYear = (year: number, month: number) => {
    const date = new Date(year, month - 1);
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
}

const eventTypeConfig = {
    'formacao': { icon: KanbanSquare, label: 'Formação', color: 'text-primary' },
    'projeto-marco': { icon: Milestone, label: 'Projeto (Marco)', color: 'text-accent-foreground' },
    'projeto-acompanhamento': { icon: Milestone, label: 'Projeto (Acomp.)', color: 'text-chart-4' },
    'lembrete': { icon: Bell, label: 'Lembrete', color: 'text-chart-3' },
};


export function RelatorioAgendaPrint({ events, year, month }: RelatorioProps) {
  const dataEmissao = new Date().toLocaleDateString('pt-BR');

  const groupedEvents = events.reduce((acc, event) => {
    const day = event.date.toDate().getDate();
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(event);
    return acc;
  }, {} as Record<number, CalendarEvent[]>);

  const sortedDays = Object.keys(groupedEvents).map(Number).sort((a, b) => a - b);


  return (
    <div className="bg-white text-black font-sans p-8 rounded-lg shadow-lg border">
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
        <AppLogo textClassName='text-3xl' iconClassName='h-10 w-10' />
        <div className='text-right'>
            <h2 className="text-2xl font-bold capitalize">{formatMonthYear(year, month)}</h2>
            <p className="text-sm text-gray-500">Data de Emissão: {dataEmissao}</p>
        </div>
      </header>

      <main className="mt-8 space-y-6">
        {sortedDays.length > 0 ? (
            sortedDays.map(day => {
                const dayEvents = groupedEvents[day];
                const firstEventDate = dayEvents[0].date;
                return (
                    <div key={day} className="break-inside-avoid">
                        <h3 className="text-lg font-semibold mb-2 pb-2 border-b flex items-center gap-2">
                           <Calendar className="h-5 w-5 text-primary"/> 
                           {formatDate(firstEventDate, { weekday: 'long', day: '2-digit', month: 'long' })}
                        </h3>
                        <div className="space-y-3">
                            {dayEvents.map((event, index) => {
                                const config = eventTypeConfig[event.type];
                                const Icon = config.icon;
                                return (
                                    <div key={index} className="flex items-start gap-3 p-2 rounded-md bg-gray-50">
                                        <div className={cn("mt-1", config.color)}><Icon className="h-4 w-4"/></div>
                                        <div>
                                            <p className="font-medium">{event.title}</p>
                                            <p className="text-xs text-gray-600">{event.details}</p>
                                        </div>
                                         <Badge variant="outline" className="ml-auto shrink-0">{config.label}</Badge>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })
        ) : (
             <p className="text-sm text-gray-500 italic text-center py-10">Nenhum evento agendado para este mês.</p>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 pt-8 mt-8 border-t">
        Gestão Formadores - Portal de Apoio Pedagógico
      </footer>
    </div>
  );
}

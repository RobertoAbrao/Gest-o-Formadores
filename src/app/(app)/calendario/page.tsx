
'use client';

import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type EventType = 'planejamento' | 'feriado' | 'recesso' | 'conselho' | 'avaliacao' | 'inicio-termino' | 'simulado' | 'devolutiva';

const eventTypes: { value: EventType, label: string, className: string }[] = [
    { value: 'planejamento', label: 'Estudo e Planejamento', className: 'bg-blue-200' },
    { value: 'feriado', label: 'Feriado', className: 'bg-red-200' },
    { value: 'recesso', label: 'Recesso escolar', className: 'bg-indigo-200' },
    { value: 'conselho', label: 'Conselho de Classe', className: 'bg-yellow-200' },
    { value: 'avaliacao', label: 'Avaliação Trimestral', className: 'border-2 border-orange-300' },
    { value: 'inicio-termino', label: 'Início/Término', className: 'underline font-bold' },
    { value: 'simulado', label: 'Simulado', className: 'bg-green-200' },
    { value: 'devolutiva', label: 'Devolutiva', className: 'bg-purple-200' },
];

interface CalendarEvent {
    type: EventType | '';
    tooltip: string;
}

export default function CalendarioPage() {
  const year = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => i);
  
  const [events, setEvents] = useState<Record<string, CalendarEvent>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [currentEventType, setCurrentEventType] = useState<EventType | ''>('');
  const [currentTooltip, setCurrentTooltip] = useState('');

  const handleDayClick = (day: Date) => {
    const dateString = day.toISOString().split('T')[0];
    const existingEvent = events[dateString];

    setEditingDate(day);
    setCurrentEventType(existingEvent?.type || '');
    setCurrentTooltip(existingEvent?.tooltip || '');
    setIsModalOpen(true);
  };

  const handleSaveEvent = () => {
    if (!editingDate) return;
    const dateString = editingDate.toISOString().split('T')[0];

    setEvents(prevEvents => {
      const newEvents = { ...prevEvents };
      if (currentEventType === '' && currentTooltip === '') {
        delete newEvents[dateString];
      } else {
        newEvents[dateString] = { type: currentEventType, tooltip: currentTooltip };
      }
      return newEvents;
    });

    setIsModalOpen(false);
  };

  const modifiers = useMemo(() => {
    const mods: Record<string, Date[]> = {};
    for (const dateString in events) {
      const event = events[dateString];
      if (event.type) {
        if (!mods[event.type]) {
          mods[event.type] = [];
        }
        mods[event.type].push(new Date(dateString + 'T12:00:00'));
      }
    }
    return mods;
  }, [events]);

  const modifierStyles = {
    planejamento: { backgroundColor: '#bfdbfe' },
    feriado: { backgroundColor: '#fecaca' },
    recesso: { backgroundColor: '#c7d2fe' },
    conselho: { backgroundColor: '#fef08a' },
    avaliacao: { border: '2px solid #fb923c' },
    'inicio-termino': { textDecoration: 'underline', fontWeight: 'bold' },
    simulado: { backgroundColor: '#bbf7d0' },
    devolutiva: { backgroundColor: '#e9d5ff' },
  };

  const DayContent = (props: { date: Date }) => {
      const dateString = props.date.toISOString().split('T')[0];
      const event = events[dateString];

      if (event?.tooltip) {
          return (
              <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <div>{props.date.getDate()}</div>
                      </TooltipTrigger>
                      <TooltipContent>
                          <p>{event.tooltip}</p>
                      </TooltipContent>
                  </Tooltip>
              </TooltipProvider>
          );
      }
      return <div>{props.date.getDate()}</div>;
  };

  return (
    <div className="flex flex-col gap-4 py-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Calendário Anual {year}</h1>
          <p className="text-muted-foreground">
            Visão completa de todos os meses do ano. Clique em um dia para editá-lo.
          </p>
        </div>
      </div>
      
      <Card className='p-4'>
            <CardHeader className='p-2'>
                <CardTitle className='text-lg'>Legenda</CardTitle>
            </CardHeader>
            <CardContent className='p-2'>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-200"></div>Estudo e Planejamento</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-200"></div>Feriado</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-indigo-200"></div>Recesso escolar</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-yellow-200"></div>Conselho de Classe</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-orange-200 border-2 border-orange-300"></div>Avaliação Trimestral</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-200"></div>Simulado</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-purple-200"></div>Devolutiva</div>
                    <div className="flex items-center gap-2"><span className="font-bold underline">__</span>Início/Término</div>
                </div>
            </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {months.map(month => {
          const monthDate = new Date(year, month);
          const monthName = monthDate.toLocaleString('pt-BR', { month: 'long' });

          return (
            <Card key={month}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-center capitalize">{monthName}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  month={monthDate}
                  className="p-0"
                  classNames={{
                    day: "h-8 w-8 rounded-full",
                    head_cell: "w-8",
                  }}
                  locale={ptBR}
                  onDayClick={handleDayClick}
                  modifiers={modifiers}
                  modifiersStyles={modifierStyles}
                  components={{ DayContent: DayContent }}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Dia: {editingDate?.toLocaleDateString('pt-BR')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="event-type">Tipo de Evento</Label>
                        <Select value={currentEventType} onValueChange={(value) => setCurrentEventType(value as EventType | '')}>
                            <SelectTrigger id="event-type">
                                <SelectValue placeholder="Nenhum (Dia Normal)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Nenhum (Dia Normal)</SelectItem>
                                {eventTypes.map(et => (
                                    <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="event-tooltip">Descrição (Tooltip)</Label>
                        <Input 
                            id="event-tooltip" 
                            placeholder="Ex: Feriado de Ano Novo"
                            value={currentTooltip}
                            onChange={(e) => setCurrentTooltip(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSaveEvent}>Salvar</Button>
                </DialogFooter>
            </DialogContent>
       </Dialog>

    </div>
  );
}

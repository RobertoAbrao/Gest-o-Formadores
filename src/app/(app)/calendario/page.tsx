
'use client';

import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import { Printer } from 'lucide-react';

type EventType = 
    | 'continuidade-ferias' 
    | 'feriado'
    | 'inicio-termino-aulas' 
    | 'recesso'
    | 'inicio-termino-trimestre' 
    | 'conselho'
    | 'estudo-planejamento' 
    | 'inicio-ferias-2026'
    | 'simulado'
    | 'devolutiva'
    | 'avaliacao';

const eventTypes: { value: EventType, label: string }[] = [
    { value: 'continuidade-ferias', label: 'Continuidade das férias ano letivo 2025' },
    { value: 'inicio-termino-aulas', label: 'Início e término das aulas' },
    { value: 'inicio-termino-trimestre', label: 'Início e término de trimestre' },
    { value: 'estudo-planejamento', label: 'Estudo e Planejamento' },
    { value: 'feriado', label: 'Feriado' },
    { value: 'recesso', label: 'Recesso escolar' },
    { value: 'conselho', label: 'Conselho de Classe Extraordinário e Fechamento do ano letivo' },
    { value: 'inicio-ferias-2026', label: 'Início das férias ano letivo 2026' },
    { value: 'simulado', label: 'Simulado' },
    { value: 'devolutiva', label: 'Devolutiva' },
    { value: 'avaliacao', label: 'Avaliação Trimestral' },
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
  const [editingRange, setEditingRange] = useState<DateRange | undefined>();
  const [currentEventType, setCurrentEventType] = useState<EventType | ''>('');
  const [currentTooltip, setCurrentTooltip] = useState('');
  
  useEffect(() => {
    if (isModalOpen) {
        if (currentEventType) {
            const eventLabel = eventTypes.find(et => et.value === currentEventType)?.label;
            setCurrentTooltip(eventLabel || '');
        } else {
            setCurrentTooltip('');
        }
    }
  }, [currentEventType, isModalOpen]);

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      setEditingRange(range);

      const fromString = range.from.toISOString().split('T')[0];
      const existingEvent = events[fromString];
      
      setCurrentEventType(existingEvent?.type || '');
      setCurrentTooltip(existingEvent?.tooltip || '');

      if(range.to) {
        setIsModalOpen(true);
      }
    }
  };

  const handleSaveEvent = () => {
    if (!editingRange?.from) return;
    
    const newEvents = { ...events };
    const startDate = editingRange.from;
    const endDate = editingRange.to || editingRange.from;

    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
        const dateString = date.toISOString().split('T')[0];
        if (currentEventType === '' && currentTooltip === '') {
            delete newEvents[dateString];
        } else {
            newEvents[dateString] = { type: currentEventType, tooltip: currentTooltip };
        }
    }
    
    setEvents(newEvents);
    setIsModalOpen(false);
    setEditingRange(undefined);
  };
  
  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
        setEditingRange(undefined); // Reset range when modal is closed
    }
  }

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
    'continuidade-ferias': { backgroundColor: '#a3c0e8' },
    'inicio-termino-aulas': { backgroundColor: '#ffff00' },
    'inicio-termino-trimestre': { backgroundColor: '#3b82f6' },
    'estudo-planejamento': { backgroundColor: '#90ee90' },
    'feriado': { backgroundColor: '#ff0000', color: '#fff' },
    'recesso': { backgroundColor: '#ffc107' },
    'conselho': { backgroundColor: '#808080', color: '#fff' },
    'inicio-ferias-2026': { backgroundColor: '#ffc0cb' },
    'simulado': { backgroundColor: '#bbf7d0' }, // light green
    'devolutiva': { backgroundColor: '#e9d5ff' }, // light purple
    'avaliacao': { border: '2px solid #fdba74' }, // orange-300
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

  const getModalTitle = () => {
    if (!editingRange?.from) return 'Editar Dia';
    const start = format(editingRange.from, 'dd/MM/yyyy');
    if (!editingRange.to || editingRange.from.getTime() === editingRange.to.getTime()) {
      return `Editar Dia: ${start}`;
    }
    const end = format(editingRange.to, 'dd/MM/yyyy');
    return `Editar Período: ${start} a ${end}`;
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background-color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            padding: 1rem;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="flex flex-col gap-4 py-6 h-full printable-area">
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Calendário Anual {year}</h1>
            <p className="text-muted-foreground">
              Clique em um dia para começar a selecionar ou em um intervalo para editar.
            </p>
          </div>
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>
        
        <Card className='p-4'>
              <CardHeader className='p-2'>
                  <CardTitle className='text-lg'>Legenda</CardTitle>
              </CardHeader>
              <CardContent className='p-2'>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-3 text-sm">
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles['continuidade-ferias']}></div>Continuidade das férias 2025</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles['inicio-termino-aulas']}></div>Início e término das aulas</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles['inicio-termino-trimestre']}></div>Início e término de trimestre</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles['estudo-planejamento']}></div>Estudo e Planejamento</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.feriado}></div>Feriado</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.recesso}></div>Recesso escolar</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.conselho}></div>Conselho de Classe/Fechamento</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles['inicio-ferias-2026']}></div>Início das férias 2026</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.avaliacao}></div>Avaliação Trimestral</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.simulado}></div>Simulado</div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.devolutiva}></div>Devolutiva</div>
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
                    mode="range"
                    selected={editingRange}
                    onSelect={handleDateSelect}
                    className="p-0"
                    classNames={{
                      day: "h-8 w-8 rounded-full",
                      head_cell: "w-8",
                    }}
                    locale={ptBR}
                    modifiers={modifiers}
                    modifiersStyles={modifierStyles}
                    components={{ DayContent: DayContent }}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange} modal={false}>
              <DialogContent className='no-print'>
                  <DialogHeader>
                      <DialogTitle>{getModalTitle()}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                      <div className="space-y-2">
                          <Label htmlFor="event-type">Tipo de Evento</Label>
                          <Select 
                              value={currentEventType} 
                              onValueChange={(value) => setCurrentEventType(value === 'none' ? '' : value as EventType)}
                          >
                              <SelectTrigger id="event-type">
                                  <SelectValue placeholder="Nenhum (Dia Normal)" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="none">Nenhum (Dia Normal)</SelectItem>
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
                      <Button variant="outline" onClick={() => handleModalOpenChange(false)}>Cancelar</Button>
                      <Button onClick={handleSaveEvent}>Salvar</Button>
                  </DialogFooter>
              </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

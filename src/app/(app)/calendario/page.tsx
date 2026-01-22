
'use client';

import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DateRange } from 'react-day-picker';
import { addDays, format, isWithinInterval, startOfDay } from 'date-fns';
import { Loader2, Printer, Copy, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLogo from '@/components/AppLogo';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, Timestamp, getDoc } from 'firebase/firestore';
import type { ProjetoImplatancao, AlinhamentoTecnico } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

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
    | 'avaliacao'
    | 'implantacao'
    | 'migracao'
    | 'avaliacao-diagnostica';

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
    { value: 'avaliacao-diagnostica', label: 'Avaliação Diagnóstica' },
    { value: 'implantacao', label: 'Implantação' },
    { value: 'migracao', label: 'Migração de Dados' },
];

interface CalendarEvent {
    id: string;
    projectId: string;
    projectName?: string;
    type: EventType | '';
    tooltip: string;
    startDate: Timestamp;
    endDate: Timestamp;
}

interface CronogramaItem {
    evento: string;
    dataSugerida: string;
}

export default function CalendarioPage() {
  const currentYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => i);
  
  const [loading, setLoading] = useState(true);
  const [projetos, setProjetos] = useState<ProjetoImplatancao[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('geral');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [alinhamento, setAlinhamento] = useState<AlinhamentoTecnico | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingRange, setEditingRange] = useState<DateRange | undefined>();
  const [currentEventType, setCurrentEventType] = useState<EventType | ''>('');
  const [currentTooltip, setCurrentTooltip] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    const fetchProjetos = async () => {
        setLoading(true);
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31);
        const q = query(
            collection(db, "projetos"),
            where("dataCriacao", ">=", startOfYear),
            where("dataCriacao", "<=", endOfYear)
        );
        const querySnapshot = await getDocs(q);
        const projetosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjetoImplatancao));
        setProjetos(projetosData);
        setLoading(false);
    };
    fetchProjetos();
  }, [currentYear]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let q;
    if (selectedProjectId === 'todos') {
        q = query(collection(db, "calendario_eventos"));
    } else {
        q = query(collection(db, "calendario_eventos"), where("projectId", "==", selectedProjectId));
    }
    
    const [querySnapshot, alinhamentoSnap] = await Promise.all([
      getDocs(q),
      selectedProjectId !== 'todos' && selectedProjectId !== 'geral'
        ? getDoc(doc(db, 'alinhamentos', selectedProjectId))
        : Promise.resolve(null),
    ]);

    const eventsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
    setEvents(eventsData);

    if (alinhamentoSnap && alinhamentoSnap.exists()) {
        setAlinhamento(alinhamentoSnap.data() as AlinhamentoTecnico);
    } else {
        setAlinhamento(null);
    }
    
    setLoading(false);
  }, [selectedProjectId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);
  
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
    if (!range?.from) return;
    setEditingRange(range);

    const clickedDate = startOfDay(range.from);
    const existingEvent = events.find(e => 
      isWithinInterval(clickedDate, { 
        start: e.startDate.toDate(), 
        end: e.endDate.toDate() 
      }) && (selectedProjectId === 'todos' || e.projectId === selectedProjectId)
    );
    
    if (existingEvent) {
        setEditingEventId(existingEvent.id);
        setCurrentEventType(existingEvent.type);
        setCurrentTooltip(existingEvent.tooltip);
        setEditingRange({ from: existingEvent.startDate.toDate(), to: existingEvent.endDate.toDate() });
    } else {
        setEditingEventId(null);
        setCurrentEventType('');
        setCurrentTooltip('');
    }

    if (range.to) {
        setIsModalOpen(true);
    }
  };

  const handleSaveEvent = async () => {
    if (!editingRange?.from || selectedProjectId === 'todos') return;
    
    const startDate = Timestamp.fromDate(editingRange.from);
    const endDate = Timestamp.fromDate(editingRange.to || editingRange.from);

    const eventData = {
        projectId: selectedProjectId,
        projectName: projetos.find(p => p.id === selectedProjectId)?.municipio || 'Geral',
        type: currentEventType,
        tooltip: currentTooltip,
        startDate,
        endDate,
    };

    setLoading(true);
    if (editingEventId) {
        // Update or Delete
        if (currentEventType === '' && currentTooltip === '') {
            await deleteDoc(doc(db, 'calendario_eventos', editingEventId));
        } else {
            await updateDoc(doc(db, 'calendario_eventos', editingEventId), eventData);
        }
    } else {
        // Create
        if (currentEventType !== '' || currentTooltip !== '') {
            await addDoc(collection(db, 'calendario_eventos'), eventData);
        }
    }
    
    await fetchEvents();
    setIsModalOpen(false);
    setEditingRange(undefined);
  };

  const handleSyncDates = async () => {
    if (!alinhamento?.cronograma || !selectedProjectId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum dado de alinhamento para sincronizar.' });
      return;
    }

    setLoading(true);
    try {
      const projetoRef = doc(db, 'projetos', selectedProjectId);
      const updateData: { [key: string]: any } = {};

      for (const item of alinhamento.cronograma) {
        if (item.status !== 'Aprovado' || !item.novaData) continue;

        const dates = item.novaData.split(' a ').map(dateStr => {
          const [day, month, year] = dateStr.trim().split('/');
          return Timestamp.fromDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
        });

        const startDate = dates[0];
        const endDate = dates.length > 1 ? dates[1] : startDate;

        if (item.evento.includes('Migração de Dados')) {
          updateData.dataMigracao = startDate;
        } else if (item.evento.includes('Implantação')) {
          updateData.dataImplantacao = startDate;
        } else if (item.evento.includes('Avaliação Diagnóstica')) {
          updateData['diagnostica.data'] = startDate;
        } else if (item.evento.includes('Simulado')) {
          const match = item.evento.match(/Simulado (\d)/);
          if (match) {
            const num = match[1];
            updateData[`simulados.s${num}.dataInicio`] = startDate;
            updateData[`simulados.s${num}.dataFim`] = endDate;
          }
        } else if (item.evento.includes('Devolutiva')) {
          const match = item.evento.match(/Devolutiva (\d)/);
          if (match) {
            const num = match[1];
            if (num === '4') { // Devolutiva 4 has only one date field
              updateData[`devolutivas.d4.data`] = startDate;
            } else {
              updateData[`devolutivas.d${num}.dataInicio`] = startDate;
              updateData[`devolutivas.d${num}.dataFim`] = endDate;
            }
          }
        }
      }
      
      if(Object.keys(updateData).length > 0) {
        await updateDoc(projetoRef, updateData);
        toast({ title: 'Sucesso!', description: 'As datas do projeto foram sincronizadas com sucesso.' });
        fetchProjetos(); // Re-fetch all project data to be up-to-date
      } else {
         toast({ title: 'Nenhuma Ação', description: 'Não há datas aprovadas para sincronizar.' });
      }

    } catch (error) {
      console.error("Date sync error:", error);
      toast({ variant: 'destructive', title: 'Erro de Sincronização', description: 'Não foi possível atualizar as datas do projeto.' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
        setEditingRange(undefined);
        setEditingEventId(null);
    }
  }

  const handleCopyAlinhamentoLink = () => {
    if (selectedProjectId === 'geral' || selectedProjectId === 'todos') return;
    const url = `${window.location.origin}/alinhamento/${selectedProjectId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copiado!',
      description: 'O link do formulário de alinhamento foi copiado para a área de transferência.',
    });
  };

  const eventsByDateString = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(event => {
        for (let date = event.startDate.toDate(); date <= event.endDate.toDate(); date = addDays(date, 1)) {
            const dateString = date.toISOString().split('T')[0];
            if (!map[dateString]) {
                map[dateString] = [];
            }
            map[dateString].push(event);
        }
    });
    return map;
  }, [events]);

  const modifiers = useMemo(() => {
    const mods: Record<string, Date[]> = {};
    for (const dateString in eventsByDateString) {
        const dayEvents = eventsByDateString[dateString];
        if (dayEvents.length > 0) {
            const type = dayEvents[0].type; // For simple coloring, use the first event's type
            if (type) {
                if (!mods[type]) {
                  mods[type] = [];
                }
                mods[type].push(new Date(dateString + 'T12:00:00'));
            }
        }
    }
    return mods;
  }, [eventsByDateString]);

  const modifierStyles = {
    'continuidade-ferias': { backgroundColor: '#a3c0e8' },
    'inicio-termino-aulas': { backgroundColor: '#ffff00' },
    'inicio-termino-trimestre': { backgroundColor: '#3b82f6' },
    'estudo-planejamento': { backgroundColor: '#90ee90' },
    'feriado': { backgroundColor: '#ff0000', color: '#fff' },
    'recesso': { backgroundColor: '#ffc107' },
    'conselho': { backgroundColor: '#808080', color: '#fff' },
    'inicio-ferias-2026': { backgroundColor: '#ffc0cb' },
    'simulado': { backgroundColor: '#bbf7d0' },
    'devolutiva': { backgroundColor: '#e9d5ff' },
    'avaliacao': { border: '2px solid #fdba74' },
    'implantacao': { backgroundColor: '#a78bfa' },
    'migracao': { backgroundColor: '#5eead4' },
    'avaliacao-diagnostica': { backgroundColor: '#f472b6' }
  };
  
    const cronogramaData = useMemo<CronogramaItem[]>(() => {
    if (selectedProjectId === 'todos' || selectedProjectId === 'geral') {
      const data: CronogramaItem[] = [];
      events.forEach(event => {
        let dataSugerida: string;
        const startDate = event.startDate.toDate();
        const endDate = event.endDate.toDate();
        if (startDate.getTime() === endDate.getTime()) {
          dataSugerida = format(startDate, 'dd/MM/yyyy');
        } else {
          dataSugerida = `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;
        }
        const eventoTitle = selectedProjectId === 'todos' && event.projectName ? `[${event.projectName}] ${event.tooltip}` : event.tooltip;
        data.push({ evento: eventoTitle, dataSugerida: dataSugerida });
      });

      return data.sort((a,b) => {
        const aDateMatch = a.dataSugerida.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const bDateMatch = b.dataSugerida.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (!aDateMatch) return 1;
        if (!bDateMatch) return -1;
        const aDate = new Date(`${aDateMatch[3]}-${aDateMatch[2]}-${aDateMatch[1]}`);
        const bDate = new Date(`${bDateMatch[3]}-${bDateMatch[2]}-${bDateMatch[1]}`);
        return aDate.getTime() - bDate.getTime();
      });
    }

    const relevantEventNames = ['Migração de Dados', 'Implantação', 'Simulado 1', 'Devolutiva 1', 'Simulado 2', 'Devolutiva 2', 'Simulado 3', 'Devolutiva 3', 'Simulado 4', 'Devolutiva 4'];
    const data: CronogramaItem[] = [];

    events.forEach(event => {
      let dataSugerida: string;
      const startDate = event.startDate.toDate();
      const endDate = event.endDate.toDate();
      if (startDate.getTime() === endDate.getTime()) {
        dataSugerida = format(startDate, 'dd/MM/yyyy');
      } else {
        dataSugerida = `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;
      }
      data.push({ evento: event.tooltip, dataSugerida: dataSugerida });
    });

    relevantEventNames.forEach(eventName => {
      if (!data.some(item => item.evento.includes(eventName.split(' ')[0]))) {
        if (
            (eventName.includes('Simulado') && !data.some(d => d.evento.includes('Simulado'))) ||
            (eventName.includes('Devolutiva') && !data.some(d => d.evento.includes('Devolutiva'))) ||
            (!eventName.includes('Simulado') && !eventName.includes('Devolutiva'))
        ) {
        }
      }
    });

    return data.sort((a,b) => {
        const aDateMatch = a.dataSugerida.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const bDateMatch = b.dataSugerida.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (!aDateMatch) return 1;
        if (!bDateMatch) return -1;
        const aDate = new Date(`${aDateMatch[3]}-${aDateMatch[2]}-${aDateMatch[1]}`);
        const bDate = new Date(`${bDateMatch[3]}-${bDateMatch[2]}-${bDateMatch[1]}`);
        return aDate.getTime() - bDate.getTime();
    });
  }, [events, selectedProjectId]);

  const DayContent = ({ date }: { date: Date }) => {
    const dateString = date.toISOString().split('T')[0];
    const dayEvents = eventsByDateString[dateString] || [];
  
    if (dayEvents.length > 0) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative h-full w-full flex items-center justify-center">
                {date.getDate()}
                {dayEvents.length > 1 && selectedProjectId === 'todos' && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {dayEvents.length}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {dayEvents.map((event, index) => (
                  <div key={index} className='text-xs'>
                     {selectedProjectId === 'todos' && <span className='font-semibold'>{event.projectName}: </span>}
                     {event.tooltip}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return <div>{date.getDate()}</div>;
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

  const isViewOnly = selectedProjectId === 'todos' || loading;

  const printTitle = useMemo(() => {
    if (selectedProjectId === 'todos') {
        return "Visão Geral - Todos os Projetos";
    }
    if (selectedProjectId === 'geral') {
        return "Cronograma de Ações - Planejamento Geral";
    }
    const projeto = projetos.find(p => p.id === selectedProjectId);
    if (projeto) {
        return `Cronograma de Ações - Proposta de Datas - ${projeto.municipio}`;
    }
    return 'Cronograma de Ações - Proposta de Datas';
  }, [selectedProjectId, projetos]);

  return (
    <>
      <style jsx global>{`
        @media print {
          body { visibility: hidden; background-color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; height: auto; padding: 2rem; margin: 0; }
          .no-print { display: none !important; }
          .print-table th, .print-table td { border: 1px solid #ddd; padding: 8px; font-size: 10px; }
          .print-table { border-collapse: collapse; width: 100%; }
        }
      `}</style>
      <div className="flex flex-col gap-4 py-6 h-full">
        <div className="no-print">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Calendário de Planejamento {currentYear}</h1>
                <p className="text-muted-foreground">
                  Selecione um projeto para planejar ou a visão geral para consolidar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={loading}>
                    <SelectTrigger className='w-[280px]'>
                        <SelectValue placeholder="Selecione um projeto..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Modos de Visualização</SelectLabel>
                            <SelectItem value="geral">Planejamento Geral</SelectItem>
                            <SelectItem value="todos">Visão Geral (Todos os Projetos)</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>Projetos (${currentYear})</SelectLabel>
                            {projetos.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.municipio} - {p.uf}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                 <Button 
                    onClick={handleCopyAlinhamentoLink} 
                    variant="outline" 
                    disabled={loading || selectedProjectId === 'geral' || selectedProjectId === 'todos'}
                >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Link
                </Button>
                {alinhamento && (
                   <Button onClick={handleSyncDates} variant="outline" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sincronizar Datas
                    </Button>
                )}
                <Button onClick={() => window.print()} variant="outline" disabled={loading || cronogramaData.length === 0}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                </Button>
              </div>
            </div>
            
            <Card className='p-4 mt-4'>
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
                          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles['avaliacao-diagnostica']}></div>Avaliação Diagnóstica</div>
                          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.simulado}></div>Simulado</div>
                          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.devolutiva}></div>Devolutiva</div>
                          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.implantacao}></div>Implantação</div>
                          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={modifierStyles.migracao}></div>Migração de Dados</div>
                      </div>
                  </CardContent>
            </Card>

            {cronogramaData.length > 0 && (
                 <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>{printTitle}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Este cronograma é gerado automaticamente com base nos eventos marcados no calendário acima.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loader2 className='mx-auto animate-spin' /> :
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[300px]">Evento</TableHead>
                                        <TableHead>Data Sugerida (Editora)</TableHead>
                                        <TableHead>Nova Data (Município)</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cronogramaData.map((item, index) => {
                                        const alinhamentoItem = alinhamento?.cronograma?.find(c => c.evento === item.evento);
                                        return (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">{item.evento}</TableCell>
                                                <TableCell>{item.dataSugerida}</TableCell>
                                                <TableCell>{alinhamentoItem?.novaData || '-'}</TableCell>
                                                <TableCell>{alinhamentoItem?.status || '-'}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        }
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
              {loading ? (
                Array.from({ length: 12 }).map((_, i) => <Card key={i} className="h-80 flex items-center justify-center"><Loader2 className="animate-spin" /></Card>)
              ) : months.map(month => {
                const monthDate = new Date(currentYear, month);
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
                        onSelect={isViewOnly ? undefined : handleDateSelect}
                        className="p-0"
                        classNames={{
                          day: cn("h-8 w-8 rounded-full", isViewOnly && "cursor-not-allowed"),
                          head_cell: "w-8",
                          day_today: "",
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
        </div>

        <div className="printable-area">
          <div className="space-y-12">
            <header className="flex justify-between items-center pb-4 border-b-2">
                <AppLogo />
                <h2 className="text-xl font-bold">{printTitle}</h2>
            </header>
            <Table className="print-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px] font-bold">Evento</TableHead>
                  <TableHead className="font-bold">Data Sugerida (Editora)</TableHead>
                  <TableHead className="font-bold">Nova Data (Município)</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cronogramaData.map((item, index) => {
                     const alinhamentoItem = alinhamento?.cronograma?.find(c => c.evento === item.evento);
                     return (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{item.evento}</TableCell>
                            <TableCell>{item.dataSugerida}</TableCell>
                            <TableCell>{alinhamentoItem?.novaData || ''}</TableCell>
                            <TableCell>{alinhamentoItem?.status || ''}</TableCell>
                        </TableRow>
                    )
                })}
              </TableBody>
            </Table>
            <footer className="pt-24">
                <div className="grid grid-cols-2 gap-16">
                    <div className="text-center"><div className="border-b-2 border-black w-3/4 mx-auto"></div><p className="mt-2 text-sm font-semibold">Editora LT</p></div>
                    <div className="text-center"><div className="border-b-2 border-black w-3/4 mx-auto"></div><p className="mt-2 text-sm font-semibold">Secretaria Municipal de Educação</p></div>
                </div>
            </footer>
          </div>
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
                      <Button onClick={handleSaveEvent} disabled={loading}>{loading ? <Loader2 className="animate-spin"/> : "Salvar"}</Button>
                  </DialogFooter>
              </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

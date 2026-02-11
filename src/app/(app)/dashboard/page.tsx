
'use client';

import { useEffect, useState, useMemo } from 'react';
import { BookOpenCheck, BookCopy, Loader2, Calendar as CalendarIcon, Hash, KanbanSquare, Milestone, Flag, Bell, PlusCircle, CheckCircle2, BellRing, Printer, AlertTriangle, Archive, Check, Eye, History, Mail, ClipboardList, CalendarPlus } from 'lucide-react';
import { collection, getCountFromServer, getDocs, query, where, Timestamp, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ptBR } from 'date-fns/locale';
import { format, isSameDay, addDays, isToday, isTomorrow, isWithinInterval, startOfDay, isYesterday } from 'date-fns';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import type { Formacao, ProjetoImplatancao, Lembrete, FormadorStatus, Demanda } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import useDynamicFavicon from '@/hooks/use-dynamic-favicon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DetalhesFormacao } from '@/components/formacoes/detalhes-formacao';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormDemanda } from '@/components/diario/form-diario';
import { ScrollArea } from '@/components/ui/scroll-area';
import { changeFormacaoStatus } from '@/lib/formacao-actions';


const lembreteSchema = z.object({
  titulo: z.string().min(3, 'O título é obrigatório.'),
  data: z.date({ required_error: 'A data é obrigatória.'}),
});
type LembreteFormValues = z.infer<typeof lembreteSchema>;

type CalendarEvent = {
    date: Date;
    type: 'formacao' | 'projeto-marco' | 'projeto-acompanhamento' | 'lembrete' | 'demanda';
    title: string;
    details: string;
    relatedId: string;
    concluido?: boolean;
    prioridade?: 'Normal' | 'Urgente';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState([
    { title: 'Demandas Pendentes', value: '0', icon: BookOpenCheck, color: 'text-yellow-500', borderColor: 'border-yellow-500' },
    { title: 'Materiais Disponíveis', value: '0', icon: BookCopy, color: 'text-green-500', borderColor: 'border-green-500' },
    { title: 'Formações Ativas', value: '0', icon: KanbanSquare, color: 'text-orange-500', borderColor: 'border-orange-500' },
  ]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [yesterdayEvents, setYesterdayEvents] = useState<CalendarEvent[]>([]);
  const [activeFormations, setActiveFormations] = useState<Formacao[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isLembreteDialogOpen, setIsLembreteDialogOpen] = useState(false);
  const { setNotificationFavicon, clearNotificationFavicon } = useDynamicFavicon();
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedFormacao, setSelectedFormacao] = useState<Formacao | null>(null);
  const [isDemandaDialogOpen, setIsDemandaDialogOpen] = useState(false);
  const [selectedDemanda, setSelectedDemanda] = useState<Demanda | null>(null);


  const form = useForm<LembreteFormValues>({
    resolver: zodResolver(lembreteSchema),
    defaultValues: {
      titulo: '',
      data: undefined,
    }
  });

  const fetchData = async () => {
    if (user?.perfil !== 'administrador') return;
    setLoading(true);
    try {
      const materiaisCol = collection(db, 'materiais');
      const formacoesCol = collection(db, 'formacoes');
      const projetosCol = collection(db, 'projetos');
      const lembretesCol = collection(db, 'lembretes');
      const demandasCol = collection(db, 'demandas');

      const activeFormacoesQuery = query(formacoesCol, where('status', '!=', 'arquivado'));
      
      const [materiaisSnapshot, activeFormacoesSnapshot, projetosSnapshot, lembretesSnapshot, demandasSnapshot] = await Promise.all([
        getCountFromServer(materiaisCol),
        getDocs(activeFormacoesQuery),
        getDocs(projetosCol),
        getDocs(query(lembretesCol, where('concluido', '==', false))),
        getDocs(query(demandasCol, where('status', '!=', 'Concluída'))),
      ]);
      
      setStats([
        { title: 'Demandas Pendentes', value: demandasSnapshot.size.toString(), icon: BookOpenCheck, color: 'text-yellow-500', borderColor: 'border-yellow-500' },
        { title: 'Materiais Disponíveis', value: materiaisSnapshot.data().count.toString(), icon: BookCopy, color: 'text-green-500', borderColor: 'border-green-500' },
        { title: 'Formações Ativas', value: activeFormacoesSnapshot.size.toString(), icon: KanbanSquare, color: 'text-orange-500', borderColor: 'border-orange-500' },
      ]);
        
      const allEvents: CalendarEvent[] = [];
      const formacoesData = activeFormacoesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formacao));
      setActiveFormations(formacoesData);

      formacoesData.forEach(formacao => {
        if (formacao.titulo.toLowerCase().includes('devolutiva')) {
            return;
        }

        if (formacao.dataInicio) allEvents.push({ date: formacao.dataInicio.toDate(), type: 'formacao', title: formacao.titulo, details: `Início - ${formacao.municipio}`, relatedId: formacao.id });
        if (formacao.dataFim) allEvents.push({ date: formacao.dataFim.toDate(), type: 'formacao', title: formacao.titulo, details: `Fim - ${formacao.municipio}`, relatedId: formacao.id });
      
        if(formacao.logistica) {
          formacao.logistica.forEach(item => {
            if(item.alertaLembrete && item.diasLembrete && item.checkin) {
               const alertDate = addDays(item.checkin.toDate(), -item.diasLembrete);
               allEvents.push({
                 date: alertDate,
                 type: 'lembrete',
                 title: item.alertaLembrete,
                 details: `Lembrete para ${item.formadorNome} na formação ${formacao.titulo}`,
                 relatedId: formacao.id
               })
            }
          })
        }
      });

      const projetosData = projetosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjetoImplatancao));
      projetosData.forEach(projeto => {
        if (projeto.dataMigracao) allEvents.push({ date: projeto.dataMigracao.toDate(), type: 'projeto-marco', title: `Migração de Dados: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
        if (projeto.dataImplantacao) allEvents.push({ date: projeto.dataImplantacao.toDate(), type: 'projeto-marco', title: `Implantação: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
        
        if (projeto.simulados) {
            Object.keys(projeto.simulados).forEach(key => {
                const simuladoKey = key as keyof typeof projeto.simulados;
                const simulado = projeto.simulados![simuladoKey];
                const numero = simuladoKey.replace('s', '');
                if (simulado && simulado.dataInicio) allEvents.push({ date: simulado.dataInicio.toDate(), type: 'projeto-acompanhamento', title: `Início Simulado ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
                if (simulado && simulado.dataFim) allEvents.push({ date: simulado.dataFim.toDate(), type: 'projeto-acompanhamento', title: `Fim Simulado ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
            });
        }
        if (projeto.devolutivas) {
            Object.keys(projeto.devolutivas).forEach(key => {
                const devolutivaKey = key as keyof typeof projeto.devolutivas;
                const devolutiva = projeto.devolutivas![devolutivaKey];
                const numero = devolutivaKey.replace('d', '');

                if (devolutiva && (devolutiva as any).data) { // For d4
                    allEvents.push({ date: (devolutiva as any).data.toDate(), type: 'projeto-acompanhamento', title: `Devolutiva ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
                } else if (devolutiva) { // For d1, d2, d3
                    if (devolutiva.dataInicio) allEvents.push({ date: devolutiva.dataInicio.toDate(), type: 'projeto-acompanhamento', title: `Início Devolutiva ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
                    if (devolutiva.dataFim) allEvents.push({ date: devolutiva.dataFim.toDate(), type: 'projeto-acompanhamento', title: `Fim Devolutiva ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
                }
            });
        }
      });
      
      const lembretesData = lembretesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data()} as Lembrete));
      lembretesData.forEach(lembrete => {
          allEvents.push({
            date: lembrete.data.toDate(),
            type: 'lembrete',
            title: lembrete.titulo,
            details: 'Lembrete pessoal',
            relatedId: lembrete.id,
            concluido: lembrete.concluido
          });
      })

      const demandasData = demandasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Demanda));
      setDemandas(demandasData);
      demandasData.forEach(demanda => {
        if (demanda.prazo) {
          allEvents.push({
            date: demanda.prazo.toDate(),
            type: 'demanda',
            title: `Prazo: ${demanda.demanda}`,
            details: `Diário de Bordo - ${demanda.municipio} • Resp: ${demanda.responsavelNome}`,
            relatedId: demanda.id,
            concluido: false,
            prioridade: demanda.prioridade,
          });
        }
      });


      setEvents(allEvents);
      
      const today = startOfDay(new Date());
      const sevenDaysFromNow = addDays(today, 7);
      
      const upcoming = allEvents
        .filter(event => isWithinInterval(event.date, { start: today, end: sevenDaysFromNow }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      
      setUpcomingEvents(upcoming);
      
      const yesterday = allEvents
        .filter(event => isYesterday(event.date))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      setYesterdayEvents(yesterday);


    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(user?.perfil === 'administrador'){
        fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const followUpActions = useMemo(() => {
    return activeFormations.filter(formacao => formacao.status === 'pos-formacao' || formacao.status === 'concluido');
  }, [activeFormations]);

  useEffect(() => {
    const hasPendingActions = upcomingEvents.length > 0 || followUpActions.length > 0 || yesterdayEvents.length > 0;
    if (hasPendingActions) {
      setNotificationFavicon();
    } else {
      clearNotificationFavicon();
    }
  }, [upcomingEvents, followUpActions, yesterdayEvents, setNotificationFavicon, clearNotificationFavicon]);


  const onLembreteSubmit = async (values: LembreteFormValues) => {
    try {
      await addDoc(collection(db, 'lembretes'), {
        titulo: values.titulo,
        data: Timestamp.fromDate(values.data),
        concluido: false,
        dataCriacao: serverTimestamp()
      });
      toast({ title: 'Sucesso', description: 'Lembrete criado com sucesso!' });
      setIsLembreteDialogOpen(false);
      form.reset();
      fetchData(); // Refresh data
    } catch (error) {
        console.error("Error creating lembrete:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar o lembrete.' });
    }
  }
  
  const handleToggleLembrete = async (eventId: string, currentStatus: boolean) => {
      try {
        const lembreteRef = doc(db, 'lembretes', eventId);
        await updateDoc(lembreteRef, { concluido: !currentStatus });
        toast({ title: "Sucesso", description: `Lembrete marcado como ${!currentStatus ? 'concluído' : 'ativo'}.` });
        fetchData();
      } catch (error) {
        console.error("Error updating lembrete: ", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar o lembrete." });
      }
  }

  const handleUpdateStatus = async (formacao: Formacao, newStatus: FormadorStatus) => {
    setLoadingAction(formacao.id);
    try {
      await changeFormacaoStatus(formacao, newStatus, user);
      toast({ title: "Sucesso", description: `Status alterado e ações automáticas criadas no Diário.` });
      fetchData();
    } catch (error: any) {
      console.error("Erro ao alterar status:", error);
      toast({ variant: "destructive", title: "Erro", description: error.message || "Não foi possível alterar o status." });
    } finally {
      setLoadingAction(null);
    }
  };


  const eventDaysByType = useMemo(() => {
    return events.reduce((acc, event) => {
        const eventType = event.type;
        if (!acc[eventType]) {
            acc[eventType] = [];
        }
        acc[eventType].push(startOfDay(event.date));
        return acc;
    }, {} as Record<CalendarEvent['type'], Date[]>);
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    if (!date) return [];
    return events
        .filter(event => isSameDay(event.date, date))
        .sort((a,b) => a.date.getTime() - b.date.getTime());
  }, [date, events]);
  
  const handleOpenDetails = (formacao: Formacao) => {
    setSelectedFormacao(formacao);
    setIsDetailDialogOpen(true);
  };

  const handleDetailDialogChange = (open: boolean) => {
    setIsDetailDialogOpen(open);
    if (!open) {
      setSelectedFormacao(null);
      fetchData(); // Re-fetch on close to ensure data is fresh
    }
  }

  const handleDemandaSuccess = () => {
    fetchData();
    setIsDemandaDialogOpen(false);
    setSelectedDemanda(null);
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'demanda') {
      const demanda = demandas.find(d => d.id === event.relatedId);
      if (demanda) {
        setSelectedDemanda(demanda);
        setIsDemandaDialogOpen(true);
      }
    } else if (event.type === 'formacao') {
      const formacao = activeFormations.find(f => f.id === event.relatedId);
      if (formacao) {
        handleOpenDetails(formacao);
      }
    }
  };


  const generateEmailBody = (upcoming: CalendarEvent[], yesterday: CalendarEvent[], followUps: Formacao[]): string => {
    let body = "Olá equipe,\n\nSegue o resumo de eventos e acompanhamentos do portal:\n\n";
  
    const generateSection = (title: string, data: any[], formatter: (item: any) => string) => {
        if (data.length === 0) return "";
        let section = `--- ${title.toUpperCase()} ---\n`;
        data.forEach(item => {
            section += `${formatter(item)}\n`;
        });
        return section + "\n";
    };
  
    body += generateSection(
        "Próximos Eventos (7 dias)",
        upcoming,
        (event: CalendarEvent) => `- ${format(event.date, 'dd/MM/yyyy')}: ${event.title} (${event.details})`
    );
  
    body += generateSection(
        "Resumo de Ontem",
        yesterday,
        (event: CalendarEvent) => `- ${event.title} (${event.details})`
    );
  
    body += generateSection(
        "Ações de Acompanhamento",
        followUps,
        (formacao: Formacao) => `- ${formacao.status === 'pos-formacao' ? 'Finalizada' : 'Concluída'}: ${formacao.titulo}`
    );
  
    body += "Atenciosamente,\nPortal de Gestão Pedagógica";
    return body;
  };
  
  const emailHref = useMemo(() => {
    const subject = "Resumo de Eventos e Acompanhamento";
    const body = generateEmailBody(upcomingEvents, yesterdayEvents, followUpActions);
    const recipients = [
        "alessandra@editoralt.com.br",
        "amaranta@editoralt.com.br",
        "assessoria@editoralt.com.br",
        "irene@editoralt.com.br",
        "kellem@editoralt.com.br"
    ];
    
    const params = new URLSearchParams({
        to: recipients.join(','),
        su: subject,
        body: body,
    });

    return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
  }, [upcomingEvents, yesterdayEvents, followUpActions]);


  const modifiers = {
    formacao: eventDaysByType['formacao'] || [],
    'projeto-marco': eventDaysByType['projeto-marco'] || [],
    'projeto-acompanhamento': eventDaysByType['projeto-acompanhamento'] || [],
    lembrete: eventDaysByType['lembrete'] || [],
    demanda: eventDaysByType['demanda'] || [],
  };

  const modifiersStyles = {
    formacao: { backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' },
    'projeto-marco': { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))', opacity: 0.8 },
    'projeto-acompanhamento': { backgroundColor: 'hsl(var(--chart-4) / 0.2)', color: 'hsl(var(--chart-4))' },
    lembrete: { backgroundColor: 'hsl(var(--chart-3) / 0.2)', color: 'hsl(var(--chart-3))' },
    demanda: { backgroundColor: 'hsl(var(--warning) / 0.2)', color: 'hsl(var(--warning))' },
  };
  
  const formatEventDate = (eventDate: Date) => {
    if (isToday(eventDate)) return 'Hoje';
    if (isTomorrow(eventDate)) return 'Amanhã';
    if (isYesterday(eventDate)) return 'Ontem';
    return format(eventDate, 'dd/MM');
  }

  const generateGoogleCalendarLink = (event: CalendarEvent) => {
    const startDate = event.date;
    // For all-day events, Google Calendar API expects the end date to be the next day.
    const endDate = addDays(startDate, 1);

    // Format for all-day events is YYYYMMDD
    const formatAllDayDate = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}${month}${day}`;
    };

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${formatAllDayDate(startDate)}/${formatAllDayDate(endDate)}`,
        details: event.details,
    });

    return `https://www.google.com/calendar/render?${params.toString()}`;
  }

  if (!user || user.perfil !== 'administrador' || loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const reportYear = date ? date.getFullYear() : new Date().getFullYear();
  const reportMonth = date ? date.getMonth() + 1 : new Date().getMonth() + 1;

  const EventList = ({ events, onEventClick }: { events: CalendarEvent[], onEventClick: (event: CalendarEvent) => void }) => {
    const today = startOfDay(new Date());
    return (
        <div className="space-y-4">
        {events.map((event) => {
            const isUrgent = event.type === 'demanda' && event.prioridade === 'Urgente';
            const isOverdue = event.date < today;
            return (
            <div
                key={event.relatedId + event.title + event.details}
                className={cn(
                    "flex items-start gap-4 p-2 -m-2 rounded-lg hover:bg-muted/50 cursor-pointer",
                    isUrgent && "bg-orange-100 dark:bg-orange-900/30",
                    isUrgent && isOverdue && "bg-red-100 dark:bg-red-900/40"
                )}
                onClick={() => onEventClick(event)}
            >
                <div className={cn(
                "flex-shrink-0 text-center text-sm font-semibold p-2 bg-muted rounded-md w-16",
                isToday(event.date) && "bg-yellow-100 dark:bg-yellow-900/30",
                isUrgent && isOverdue && "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200",
                isUrgent && !isOverdue && "bg-orange-200 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200"
                )}>
                <div className={cn(
                    "font-bold",
                    isToday(event.date) && "text-yellow-800 dark:text-yellow-300"
                )}>
                    {formatEventDate(event.date)}
                </div>
                <div className="text-xs text-muted-foreground">{format(event.date, 'EEEE', {locale: ptBR})}</div>
                </div>
                <div className="flex-grow">
                    <p className="font-semibold flex items-center gap-2">
                        {isUrgent && <AlertTriangle className={cn("h-4 w-4", isOverdue ? "text-red-600" : "text-orange-500")} />}
                        {event.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{event.details}</p>
                </div>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className='h-8 w-8 self-center shrink-0'
                    title="Adicionar ao Google Agenda"
                    onClick={(e) => {
                        e.stopPropagation();
                        window.open(generateGoogleCalendarLink(event), '_blank');
                    }}
                >
                    <CalendarPlus className='h-4 w-4 text-blue-500 hover:text-blue-600' />
                </Button>
            </div>
            )
        })}
        </div>
    );
  };


  return (
    <div className="flex flex-col gap-8 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard do Administrador</h1>
        <p className="text-muted-foreground">Resumo geral do Portal de Apoio Pedagógico.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className={cn("shadow-sm border-l-4", stat.borderColor)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={cn("h-6 w-6", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">Total registrado no sistema</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BellRing className="h-5 w-5" />
                        Central de Ações
                    </CardTitle>
                    <CardDescription>
                        Eventos importantes e pendências que requerem sua atenção.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Tabs defaultValue="proximos" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="proximos">Próximos 7 dias</TabsTrigger>
                            <TabsTrigger value="ontem">Resumo de Ontem</TabsTrigger>
                            <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
                        </TabsList>
                        <TabsContent value="proximos" className="pt-4">
                            {upcomingEvents.length > 0 ? <EventList events={upcomingEvents} onEventClick={handleEventClick} /> : <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento para os próximos 7 dias.</p>}
                        </TabsContent>
                        <TabsContent value="ontem" className="pt-4">
                           {yesterdayEvents.length > 0 ? <EventList events={yesterdayEvents} onEventClick={handleEventClick} /> : <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento registrado ontem.</p>}
                        </TabsContent>
                        <TabsContent value="acompanhamento" className="pt-4">
                             {followUpActions.length > 0 ? (
                                 <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Formação</TableHead>
                                            <TableHead>Relatório</TableHead>
                                            <TableHead className="text-right">Próxima Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {followUpActions.map((formacao) => (
                                            <TableRow key={formacao.id}>
                                                <TableCell>
                                                    {formacao.status === 'pos-formacao' ? (
                                                        <Badge variant="outline" className='text-xs bg-green-200 text-green-900 border-green-300'>Finalizada</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className='text-xs bg-purple-200 text-purple-900 border-purple-300'>Concluída</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-medium truncate">
                                                    <span className="cursor-pointer hover:underline" onClick={() => handleOpenDetails(formacao)}>
                                                        {formacao.titulo}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                                                        <Link href={`/relatorio/${formacao.id}`} target="_blank">Ver Relatório</Link>
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formacao.status === 'pos-formacao' ? (
                                                        <Button size="sm" onClick={() => handleUpdateStatus(formacao, 'concluido')} disabled={loadingAction === formacao.id}>
                                                            {loadingAction === formacao.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Concluir
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(formacao, 'arquivado')} disabled={loadingAction === formacao.id}>
                                                            {loadingAction === formacao.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />} Arquivar
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação de acompanhamento pendente.</p>
                             )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-1 space-y-8">
            <Card>
                <CardHeader>
                    <div className='flex justify-between items-center gap-2 flex-wrap'>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5" />
                            Agenda de Eventos
                        </CardTitle>
                        <Dialog open={isLembreteDialogOpen} onOpenChange={setIsLembreteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <PlusCircle className='mr-2 h-4 w-4' /> Novo Lembrete
                                </Button>
                            </DialogTrigger>
                            <DialogContent className='sm:max-w-md'>
                                <DialogHeader>
                                    <DialogTitle>Criar Novo Lembrete</DialogTitle>
                                    <DialogDescription>Adicione um lembrete pessoal à sua agenda.</DialogDescription>
                                </DialogHeader>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onLembreteSubmit)} className="space-y-4">
                                        <FormField control={form.control} name="titulo" render={({ field }) => (
                                            <FormItem><FormLabel>Título</FormLabel><FormControl><Input placeholder="Ex: Ligar para..." {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="data" render={({ field }) => (
                                            <FormItem className="flex flex-col"><FormLabel>Data</FormLabel>
                                                <Popover><PopoverTrigger asChild><FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                                </PopoverContent></Popover><FormMessage />
                                            </FormItem>
                                        )}/>
                                        <Button type='submit' disabled={form.formState.isSubmitting}>
                                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            Salvar Lembrete
                                        </Button>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className="rounded-md border"
                        locale={ptBR}
                        modifiers={modifiers}
                        modifiersStyles={modifiersStyles}
                    />
                    <div className="w-full space-y-2 text-sm p-2 mt-4">
                        <h4 className="font-semibold mb-2">Eventos do dia: {date ? format(date, "PPP", { locale: ptBR }) : 'N/A'}</h4>
                         {selectedDayEvents.length > 0 ? (
                            <div className="space-y-4">
                                {selectedDayEvents.map((event, index) => (
                                    <div key={index} className="space-y-2">
                                        <div>
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className="font-semibold">{event.title}</h4>
                                                <Badge variant="outline" className={cn(
                                                    event.type === 'formacao' && 'border-primary text-primary',
                                                    event.type === 'projeto-marco' && 'border-accent text-accent-foreground bg-accent/20',
                                                    event.type === 'projeto-acompanhamento' && 'border-chart-4 text-chart-4',
                                                    event.type === 'lembrete' && 'border-chart-3 text-chart-3',
                                                    event.type === 'demanda' && 'border-warning text-warning'
                                                )}>
                                                    {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground flex items-center justify-between gap-1">
                                            <span className='flex items-center gap-1'>
                                                    {event.type === 'formacao' ? <KanbanSquare className="h-3 w-3" /> : event.type === 'lembrete' ? <Bell className='h-3 w-3' /> : event.type === 'demanda' ? <ClipboardList className="h-3 w-3" /> : <Milestone className='h-3 w-3'/>}
                                                    {event.details}
                                            </span>
                                            <span className="flex items-center">
                                                {event.type === 'lembrete' && event.details === 'Lembrete pessoal' && (
                                                    <Button variant="ghost" size="icon" className='h-6 w-6' onClick={() => handleToggleLembrete(event.relatedId, event.concluido ?? false)}>
                                                        <CheckCircle2 className='h-4 w-4 text-green-500 hover:text-green-600' />
                                                    </Button>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className='h-6 w-6'
                                                    title="Adicionar ao Google Agenda"
                                                    onClick={() => window.open(generateGoogleCalendarLink(event), '_blank')}
                                                >
                                                    <CalendarPlus className='h-4 w-4 text-blue-500 hover:text-blue-600' />
                                                </Button>
                                            </span>
                                            </div>
                                        </div>
                                        {index < selectedDayEvents.length - 1 && <Separator />}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                Nenhum evento para o dia selecionado.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
       
      <Dialog open={isDetailDialogOpen} onOpenChange={handleDetailDialogChange}>
            <DialogContent className="sm:max-w-2xl">
                {selectedFormacao && (
                  <>
                    <DialogHeader>
                        <DialogTitle className="text-2xl">
                           {selectedFormacao.titulo.startsWith('Devolutiva') && !selectedFormacao.titulo.includes(':') && selectedFormacao.municipio
                              ? `${selectedFormacao.titulo}: ${selectedFormacao.municipio}`
                              : selectedFormacao.titulo}
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                <Hash className="h-4 w-4" /> {selectedFormacao.codigo}
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DetalhesFormacao 
                        formacaoId={selectedFormacao.id} 
                        onClose={() => handleDetailDialogChange(false)} 
                    />
                  </>
                )}
            </DialogContent>
        </Dialog>

        <Dialog open={isDemandaDialogOpen} onOpenChange={setIsDemandaDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{selectedDemanda ? 'Editar Demanda' : 'Nova Demanda'}</DialogTitle>
              <DialogDescription>
                  {selectedDemanda ? 'Altere os dados da demanda.' : 'Preencha os dados para registrar uma nova demanda.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className='max-h-[80vh]'>
              <div className='p-4'>
                  <FormDemanda demanda={selectedDemanda} onSuccess={handleDemandaSuccess} />
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

    </div>
  );
}

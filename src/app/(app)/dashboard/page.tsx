
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Users, BookCopy, Loader2, Calendar as CalendarIcon, Hash, KanbanSquare, Milestone, Flag, Bell, PlusCircle, CheckCircle2, BellRing, Printer, AlertCircle, Archive, Check, Eye } from 'lucide-react';
import { collection, getCountFromServer, getDocs, query, where, Timestamp, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ptBR } from 'date-fns/locale';
import { format, isSameDay, addDays, isToday, isTomorrow, isWithinInterval, startOfDay } from 'date-fns';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import type { Formacao, ProjetoImplatancao, Lembrete, FormadorStatus } from '@/lib/types';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import useDynamicFavicon from '@/hooks/use-dynamic-favicon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DetalhesFormacao } from '@/components/formacoes/detalhes-formacao';


const lembreteSchema = z.object({
  titulo: z.string().min(3, 'O título é obrigatório.'),
  data: z.date({ required_error: 'A data é obrigatória.'}),
});
type LembreteFormValues = z.infer<typeof lembreteSchema>;

type CalendarEvent = {
    date: Date;
    type: 'formacao' | 'projeto-marco' | 'projeto-acompanhamento' | 'lembrete';
    title: string;
    details: string;
    relatedId: string;
    concluido?: boolean;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState([
    { title: 'Formadores Ativos', value: '0', icon: Users, color: 'text-blue-500' },
    { title: 'Materiais Disponíveis', value: '0', icon: BookCopy, color: 'text-green-500' },
    { title: 'Formações Ativas', value: '0', icon: KanbanSquare, color: 'text-orange-500' },
  ]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [followUpActions, setFollowUpActions] = useState<Formacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isLembreteDialogOpen, setIsLembreteDialogOpen] = useState(false);
  const { setNotificationFavicon, clearNotificationFavicon } = useDynamicFavicon();
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedFormacao, setSelectedFormacao] = useState<Formacao | null>(null);


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
      const formadoresCol = collection(db, 'formadores');
      const materiaisCol = collection(db, 'materiais');
      const formacoesCol = collection(db, 'formacoes');
      const projetosCol = collection(db, 'projetos');
      const lembretesCol = collection(db, 'lembretes');

      const activeFormacoesQuery = query(formacoesCol, where('status', '!=', 'arquivado'));
      
      const [formadoresSnapshot, materiaisSnapshot, activeFormacoesSnapshot, projetosSnapshot, lembretesSnapshot] = await Promise.all([
        getCountFromServer(formadoresCol),
        getCountFromServer(materiaisCol),
        getDocs(activeFormacoesQuery),
        getDocs(projetosCol),
        getDocs(query(lembretesCol, where('concluido', '==', false)))
      ]);
      
      setStats([
        { title: 'Formadores Ativos', value: formadoresSnapshot.data().count.toString(), icon: Users, color: 'text-blue-500' },
        { title: 'Materiais Disponíveis', value: materiaisSnapshot.data().count.toString(), icon: BookCopy, color: 'text-green-500' },
        { title: 'Formações Ativas', value: activeFormacoesSnapshot.size.toString(), icon: KanbanSquare, color: 'text-orange-500' },
      ]);
        
      const allEvents: CalendarEvent[] = [];
      const followUps: Formacao[] = [];

      const formacoesData = activeFormacoesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formacao));
      formacoesData.forEach(formacao => {
        if (formacao.status === 'pos-formacao' || formacao.status === 'concluido') {
            followUps.push(formacao);
        }

        // Se a formação for uma devolutiva de projeto, não adiciona aqui para evitar duplicidade
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

      setFollowUpActions(followUps);

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

      setEvents(allEvents);
      
      const today = startOfDay(new Date());
      const sevenDaysFromNow = addDays(today, 7);
      
      const upcoming = allEvents
        .filter(event => isWithinInterval(event.date, { start: today, end: sevenDaysFromNow }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      
      setUpcomingEvents(upcoming);


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

  useEffect(() => {
    if (upcomingEvents.length > 0 || followUpActions.length > 0) {
      setNotificationFavicon();
    } else {
      clearNotificationFavicon();
    }
  }, [upcomingEvents, followUpActions, setNotificationFavicon, clearNotificationFavicon]);


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

  const handleUpdateStatus = async (formacaoId: string, newStatus: FormadorStatus) => {
    setLoadingAction(formacaoId);
    try {
      const formacaoRef = doc(db, 'formacoes', formacaoId);
      await updateDoc(formacaoRef, { status: newStatus });
      toast({ title: "Sucesso", description: `Status da formação alterado.` });
      fetchData(); // Re-fetch all data to update the UI
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível alterar o status." });
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


  const modifiers = {
    formacao: eventDaysByType['formacao'] || [],
    'projeto-marco': eventDaysByType['projeto-marco'] || [],
    'projeto-acompanhamento': eventDaysByType['projeto-acompanhamento'] || [],
    lembrete: eventDaysByType['lembrete'] || [],
  };

  const modifiersStyles = {
    formacao: {
      backgroundColor: 'hsl(var(--primary) / 0.1)',
      color: 'hsl(var(--primary))',
    },
    'projeto-marco': {
      backgroundColor: 'hsl(var(--accent) / 0.1)',
      color: 'hsl(var(--accent-foreground))',
    },
    'projeto-acompanhamento': {
      backgroundColor: 'hsl(var(--chart-4) / 0.1)',
       color: 'hsl(var(--chart-4))',
    },
     lembrete: {
      backgroundColor: 'hsl(var(--chart-3) / 0.1)',
      color: 'hsl(var(--chart-3))',
    },
  };
  
  const formatEventDate = (eventDate: Date) => {
    if (isToday(eventDate)) return 'Hoje';
    if (isTomorrow(eventDate)) return 'Amanhã';
    return format(eventDate, 'dd/MM');
  }

  const { simulados, outrosEventos } = useMemo(() => {
    const simulados = upcomingEvents.filter(e => e.title.toLowerCase().includes('simulado'));
    const outrosEventos = upcomingEvents.filter(e => !e.title.toLowerCase().includes('simulado'));
    return { simulados, outrosEventos };
  }, [upcomingEvents]);


  if (!user || user.perfil !== 'administrador' || loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const reportYear = date ? date.getFullYear() : new Date().getFullYear();
  const reportMonth = date ? date.getMonth() + 1 : new Date().getMonth() + 1;

  return (
    <div className="flex flex-col gap-8 py-6">
       <div className='space-y-4'>
            {upcomingEvents.length > 0 && (
                <Alert className='bg-amber-100/60 border-amber-200/80 text-amber-900 dark:bg-amber-900/20 dark:border-amber-500/30 dark:text-amber-200 [&>svg]:text-amber-500'>
                    <BellRing className="h-4 w-4" />
                    <AlertTitle>Eventos da Semana</AlertTitle>
                    <AlertDescription>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mt-2">
                            {/* Coluna de Simulados */}
                            <div>
                                <h4 className="font-semibold mb-2">Simulados</h4>
                                {simulados.length > 0 ? (
                                    <ul className='space-y-2'>
                                        {simulados.map((event, index) => (
                                        <li key={`sim-${index}`} className='flex items-center justify-between gap-2 text-sm'>
                                            <div className='flex items-center gap-2 truncate'>
                                                <Badge variant="outline" className='text-xs'>{formatEventDate(event.date)}</Badge>
                                                <span className='truncate' title={event.title}>{event.title}</span>
                                            </div>
                                        </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">Nenhum simulado na próxima semana.</p>
                                )}
                            </div>
                            
                            {/* Coluna de Formações e Outros */}
                            <div>
                                <h4 className="font-semibold mb-2">Formações e Lembretes</h4>
                                {outrosEventos.length > 0 ? (
                                    <ul className='space-y-2'>
                                        {outrosEventos.map((event, index) => (
                                        <li key={`otr-${index}`} className='flex items-center justify-between gap-2 text-sm'>
                                            <div className='flex items-center gap-2 truncate'>
                                                <Badge variant="outline" className='text-xs'>{formatEventDate(event.date)}</Badge>
                                                <span className='truncate' title={event.title}>{event.title}</span>
                                            </div>
                                            {event.details === 'Lembrete pessoal' && (
                                                <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className='h-6 w-6 flex-shrink-0' 
                                                onClick={() => handleToggleLembrete(event.relatedId, event.concluido ?? false)}
                                                title="Marcar como concluído"
                                                >
                                                    <CheckCircle2 className='h-4 w-4 text-green-600 hover:text-green-700' />
                                                </Button>
                                            )}
                                        </li>
                                        ))}
                                    </ul>
                                ) : (
                                     <p className="text-xs text-muted-foreground italic">Nenhuma formação ou lembrete na próxima semana.</p>
                                )}
                            </div>
                        </div>
                        <p className='mt-4 text-xs text-muted-foreground'>Selecione um dia no calendário para ver mais detalhes.</p>
                    </AlertDescription>
                </Alert>
            )}
        </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard do Administrador</h1>
        <p className="text-muted-foreground">Resumo geral do Portal de Apoio Pedagógico.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">Total registrado no sistema</p>
            </CardContent>
          </Card>
        ))}
      </div>
       
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
            <CardHeader>
                <div className='flex justify-between items-center gap-2 flex-wrap'>
                     <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5" />
                        Agenda de Eventos
                    </CardTitle>
                    <div className='flex items-center gap-2'>
                        <Button size="sm" variant="outline" asChild>
                            <Link href={`/agenda-relatorio/${reportYear}/${reportMonth}`} target='_blank'>
                                <Printer className='mr-2 h-4 w-4' /> Imprimir Mês
                            </Link>
                        </Button>
                        <Dialog open={isLembreteDialogOpen} onOpenChange={setIsLembreteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
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
                </div>
                <CardDescription>
                    Eventos do dia: {date ? format(date, "PPP", { locale: ptBR }) : 'Nenhum dia selecionado'}
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                                            event.type === 'lembrete' && 'border-chart-3 text-chart-3'
                                        )}>
                                            {event.type === 'formacao' ? 'Formação' : event.type === 'lembrete' ? 'Lembrete' : 'Projeto'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground flex items-center justify-between gap-1">
                                       <span className='flex items-center gap-1'>
                                            {event.type === 'formacao' ? <KanbanSquare className="h-3 w-3" /> : event.type === 'lembrete' ? <Bell className='h-3 w-3' /> : <Milestone className='h-3 w-3'/>}
                                            {event.details}
                                       </span>
                                       {event.details === 'Lembrete pessoal' && (
                                            <Button variant="ghost" size="icon" className='h-6 w-6' onClick={() => handleToggleLembrete(event.relatedId, event.concluido ?? false)}>
                                                <CheckCircle2 className='h-4 w-4 text-green-500 hover:text-green-600' />
                                            </Button>
                                       )}
                                    </p>
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
            </CardContent>
        </Card>
        <Card className="flex flex-col justify-center items-center p-4 gap-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border"
            locale={ptBR}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
          />
           <div className="w-full space-y-2 text-sm p-2">
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: modifiersStyles.formacao.backgroundColor, border: `1px solid ${modifiersStyles.formacao.color}` }} />
                    <span className="text-muted-foreground">Formações</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: modifiersStyles['projeto-marco'].backgroundColor, border: `1px solid ${modifiersStyles['projeto-marco'].color}` }}/>
                    <span className="text-muted-foreground">Marcos de Projeto</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: modifiersStyles['projeto-acompanhamento'].backgroundColor, border: `1px solid ${modifiersStyles['projeto-acompanhamento'].color}` }}/>
                    <span className="text-muted-foreground">Acompanhamentos</span>
                </div>
                 <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: modifiersStyles.lembrete.backgroundColor, border: `1px solid ${modifiersStyles.lembrete.color}` }}/>
                    <span className="text-muted-foreground">Lembretes</span>
                </div>
            </div>
        </Card>
      </div>

       {followUpActions.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                            <AlertCircle className="h-5 w-5" /> Ações de Acompanhamento
                        </CardTitle>
                        <CardDescription>
                            Formações que precisam da sua atenção para a próxima etapa.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
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
                                                <Button size="sm" onClick={() => handleUpdateStatus(formacao.id, 'concluido')} disabled={loadingAction === formacao.id}>
                                                    {loadingAction === formacao.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Concluir
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(formacao.id, 'arquivado')} disabled={loadingAction === formacao.id}>
                                                    {loadingAction === formacao.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />} Arquivar
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

       <Dialog open={isDetailDialogOpen} onOpenChange={handleDetailDialogChange}>
            <DialogContent className="sm:max-w-2xl">
                {selectedFormacao && (
                  <>
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{selectedFormacao.titulo}</DialogTitle>
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

    </div>
  );
}

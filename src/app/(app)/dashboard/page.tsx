
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Users, BookCopy, Loader2, Calendar as CalendarIcon, Hash, KanbanSquare, Milestone, Flag, Bell, PlusCircle, CheckCircle2, BellRing } from 'lucide-react';
import { collection, getCountFromServer, getDocs, query, where, Timestamp, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ptBR } from 'date-fns/locale';
import { format, isSameDay, startOfDay, subDays } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import type { Formacao, ProjetoImplatancao, Lembrete } from '@/lib/types';
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
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isLembreteDialogOpen, setIsLembreteDialogOpen] = useState(false);

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

      const formacoesData = activeFormacoesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formacao));
      formacoesData.forEach(formacao => {
        if (formacao.dataInicio) allEvents.push({ date: formacao.dataInicio.toDate(), type: 'formacao', title: formacao.titulo, details: `Início - ${formacao.municipio}`, relatedId: formacao.id });
        if (formacao.dataFim) allEvents.push({ date: formacao.dataFim.toDate(), type: 'formacao', title: formacao.titulo, details: `Fim - ${formacao.municipio}`, relatedId: formacao.id });
      
        if(formacao.logistica) {
          formacao.logistica.forEach(item => {
            if(item.alertaLembrete && item.diasLembrete && item.checkin) {
               const alertDate = subDays(item.checkin.toDate(), item.diasLembrete);
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
        
        Object.values(projeto.simulados).forEach((simulado, i) => {
          if (simulado.dataInicio) allEvents.push({ date: simulado.dataInicio.toDate(), type: 'projeto-acompanhamento', title: `Início Simulado ${i+1}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
          if (simulado.dataFim) allEvents.push({ date: simulado.dataFim.toDate(), type: 'projeto-acompanhamento', title: `Fim Simulado ${i+1}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
        });
        Object.values(projeto.devolutivas).forEach((devolutiva, i) => {
          if ((devolutiva as any).data) allEvents.push({ date: (devolutiva as any).data.toDate(), type: 'projeto-acompanhamento', title: `Devolutiva ${i+1}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
          if (devolutiva.dataInicio) allEvents.push({ date: devolutiva.dataInicio.toDate(), type: 'projeto-acompanhamento', title: `Início Devolutiva ${i+1}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
          if (devolutiva.dataFim) allEvents.push({ date: devolutiva.dataFim.toDate(), type: 'projeto-acompanhamento', title: `Fim Devolutiva ${i+1}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}`, relatedId: projeto.id });
        });
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
      
      const today = new Date();
      const todaysEvents = allEvents.filter(event => isSameDay(event.date, today));
      setTodayEvents(todaysEvents);


    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

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
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível atualizar o lembrete." });
      }
  }

  const eventDaysByType = useMemo(() => {
    return events.reduce((acc, event) => {
        if (!acc[event.type]) {
            acc[event.type] = [];
        }
        acc[event.type].push(startOfDay(event.date));
        return acc;
    }, {} as Record<CalendarEvent['type'], Date[]>);
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    if (!date) return [];
    return events
        .filter(event => isSameDay(event.date, date))
        .sort((a,b) => a.date.getTime() - b.date.getTime());
  }, [date, events]);

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


  if (!user || user.perfil !== 'administrador' || loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard do Administrador</h1>
        <p className="text-muted-foreground">Resumo geral do Portal de Apoio Pedagógico.</p>
      </div>

       {todayEvents.length > 0 && (
            <Alert className="border-accent bg-accent/10 text-accent-foreground [&>svg]:text-accent-foreground">
                <BellRing className="h-4 w-4 animate-pulse" />
                <AlertTitle>Você tem {todayEvents.length} {todayEvents.length === 1 ? 'evento' : 'eventos'} hoje!</AlertTitle>
                <AlertDescription>
                    <ul className='list-disc list-inside mt-2'>
                        {todayEvents.slice(0, 3).map((event, index) => <li key={index} className='truncate'>{event.title}</li>)}
                    </ul>
                    {todayEvents.length > 3 && <p className='mt-1'>E mais {todayEvents.length - 3}...</p>}
                    <p className='mt-2'>Clique no dia de hoje no calendário para ver todos os detalhes.</p>
                </AlertDescription>
            </Alert>
        )}

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
                <div className='flex justify-between items-center'>
                     <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5" />
                        Agenda de Eventos
                    </CardTitle>
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
                                       {event.type === 'lembrete' && (
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
    </div>
  );
}

    
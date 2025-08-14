
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Users, BookCopy, Loader2, Calendar as CalendarIcon, Hash, KanbanSquare, Milestone, Flag } from 'lucide-react';
import { collection, getCountFromServer, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { ptBR } from 'date-fns/locale';
import { format, isSameDay, startOfDay } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import type { Formacao, ProjetoImplatancao } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const statusColors: Record<Formacao['status'], string> = {
    preparacao: 'bg-yellow-100 text-yellow-800',
    'em-formacao': 'bg-blue-100 text-blue-800',
    'pos-formacao': 'bg-purple-100 text-purple-800',
    concluido: 'bg-green-100 text-green-800',
    arquivado: 'bg-gray-100 text-gray-800',
};

type CalendarEvent = {
    date: Date;
    type: 'formacao' | 'projeto-marco' | 'projeto-acompanhamento';
    title: string;
    details: string;
    relatedId: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState([
    { title: 'Formadores Ativos', value: '0', icon: Users, color: 'text-blue-500' },
    { title: 'Materiais Disponíveis', value: '0', icon: BookCopy, color: 'text-green-500' },
    { title: 'Formações Ativas', value: '0', icon: KanbanSquare, color: 'text-orange-500' },
  ]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (user?.perfil === 'administrador') {
      const fetchData = async () => {
        setLoading(true);
        try {
          const formadoresCol = collection(db, 'formadores');
          const materiaisCol = collection(db, 'materiais');
          const formacoesCol = collection(db, 'formacoes');
          const projetosCol = collection(db, 'projetos');

          const activeFormacoesQuery = query(formacoesCol, where('status', '!=', 'arquivado'));
          
          const [formadoresSnapshot, materiaisSnapshot, activeFormacoesSnapshot, projetosSnapshot] = await Promise.all([
            getCountFromServer(formadoresCol),
            getCountFromServer(materiaisCol),
            getDocs(activeFormacoesQuery),
            getDocs(projetosCol)
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

          setEvents(allEvents);

        } catch (error) {
          console.error("Error fetching data:", error);
          // Handle error, e.g., show a toast message
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [user]);

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
  };

  const modifiersStyles = {
    formacao: {
      borderColor: 'hsl(var(--primary))',
    },
    'projeto-marco': {
      borderColor: 'hsl(var(--accent))',
    },
    'projeto-acompanhamento': {
      borderColor: 'hsl(var(--chart-4))',
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
                <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Agenda de Eventos
                </CardTitle>
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
                                            event.type === 'projeto-acompanhamento' && 'border-chart-4 text-chart-4'
                                        )}>
                                            {event.type === 'formacao' ? 'Formação' : 'Projeto'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                       {event.type === 'formacao' ? <KanbanSquare className="h-3 w-3" /> : <Milestone className='h-3 w-3'/>}
                                       {event.details}
                                    </p>
                                </div>
                                <Separator />
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
        <Card className="flex justify-center items-center p-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border"
            locale={ptBR}
            modifiers={modifiers}
            modifiersStyles={{
              ...modifiersStyles,
              day: {
                borderWidth: '2px',
                borderRadius: 'var(--radius)',
              }
            }}
          />
        </Card>
      </div>
    </div>
  );
}


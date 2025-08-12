
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Users, BookCopy, Loader2, Calendar as CalendarIcon, Hash, KanbanSquare } from 'lucide-react';
import { collection, getCountFromServer, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { ptBR } from 'date-fns/locale';
import { format, isSameDay } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import type { Formacao } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const statusColors: Record<Formacao['status'], string> = {
    preparacao: 'bg-yellow-100 text-yellow-800',
    'em-formacao': 'bg-blue-100 text-blue-800',
    'pos-formacao': 'bg-purple-100 text-purple-800',
    concluido: 'bg-green-100 text-green-800',
    arquivado: 'bg-gray-100 text-gray-800',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState([
    { title: 'Formadores Ativos', value: '0', icon: Users, color: 'text-blue-500' },
    { title: 'Materiais Disponíveis', value: '0', icon: BookCopy, color: 'text-green-500' },
    { title: 'Formações Ativas', value: '0', icon: KanbanSquare, color: 'text-orange-500' },
  ]);
  const [formacoes, setFormacoes] = useState<Formacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (user?.perfil === 'administrador') {
      const fetchData = async () => {
        setLoading(true);
        try {
          const formadoresCol = collection(db, 'formadores');
          const materiaisCol = collection(db, 'materiais');
          const allFormacoesCol = collection(db, 'formacoes');
          const activeFormacoesQuery = query(allFormacoesCol, where('status', '!=', 'arquivado'));
          
          const [formadoresSnapshot, materiaisSnapshot, activeFormacoesSnapshot] = await Promise.all([
            getCountFromServer(formadoresCol),
            getCountFromServer(materiaisCol),
            getDocs(activeFormacoesQuery),
          ]);
          
          setStats([
            { title: 'Formadores Ativos', value: formadoresSnapshot.data().count.toString(), icon: Users, color: 'text-blue-500' },
            { title: 'Materiais Disponíveis', value: materiaisSnapshot.data().count.toString(), icon: BookCopy, color: 'text-green-500' },
            { title: 'Formações Ativas', value: activeFormacoesSnapshot.size.toString(), icon: KanbanSquare, color: 'text-orange-500' },
          ]);

          const formacoesData = activeFormacoesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formacao));
          setFormacoes(formacoesData);

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

  const eventDays = useMemo(() => {
    return formacoes.reduce((acc, formacao) => {
        if (formacao.dataInicio) acc.push(formacao.dataInicio.toDate());
        if (formacao.dataFim) acc.push(formacao.dataFim.toDate());
        return acc;
    }, [] as Date[]);
  }, [formacoes]);

  const selectedDayEvents = useMemo(() => {
    if (!date) return [];
    return formacoes.filter(f => 
        (f.dataInicio && isSameDay(f.dataInicio.toDate(), date)) || 
        (f.dataFim && isSameDay(f.dataFim.toDate(), date))
    ).sort((a,b) => a.dataInicio!.toMillis() - b.dataInicio!.toMillis());
  }, [date, formacoes]);

  const modifiers = {
    event: eventDays,
  };

  const modifiersStyles = {
    event: {
      border: '2px solid hsl(var(--primary))',
      borderRadius: 'var(--radius)',
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
                    Agenda de Formações
                </CardTitle>
                <CardDescription>
                    Eventos do dia: {date ? format(date, "PPP", { locale: ptBR }) : 'Nenhum dia selecionado'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {selectedDayEvents.length > 0 ? (
                    <div className="space-y-4">
                        {selectedDayEvents.map(formacao => (
                            <div key={formacao.id} className="space-y-2">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold">{formacao.titulo}</h4>
                                        <Badge variant="outline" className={statusColors[formacao.status]}>
                                            {formacao.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Hash className="h-3 w-3" /> {formacao.codigo} - {formacao.municipio}
                                    </p>
                                </div>
                                <Separator />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma formação para o dia selecionado.
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
            modifiersStyles={modifiersStyles}
          />
        </Card>
      </div>
    </div>
  );
}

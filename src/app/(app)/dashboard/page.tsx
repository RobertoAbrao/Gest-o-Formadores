'use client';

import { useEffect, useState } from 'react';
import { Users, BookCopy, MapPin, Loader2 } from 'lucide-react';
import { collection, getCountFromServer } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState([
    { title: 'Formadores Ativos', value: '0', icon: Users, color: 'text-blue-500' },
    { title: 'Materiais Disponíveis', value: '0', icon: BookCopy, color: 'text-green-500' },
    { title: 'Municípios Cobertos', value: '0', icon: MapPin, color: 'text-orange-500' },
  ]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (user?.perfil === 'administrador') {
      const fetchStats = async () => {
        setLoading(true);
        try {
          const formadoresCol = collection(db, 'formadores');
          const materiaisCol = collection(db, 'materiais');
          
          const [formadoresSnapshot, materiaisSnapshot] = await Promise.all([
            getCountFromServer(formadoresCol),
            getCountFromServer(materiaisCol),
          ]);
          
          setStats([
            { title: 'Formadores Ativos', value: formadoresSnapshot.data().count.toString(), icon: Users, color: 'text-blue-500' },
            { title: 'Materiais Disponíveis', value: materiaisSnapshot.data().count.toString(), icon: BookCopy, color: 'text-green-500' },
            { title: 'Municípios Cobertos', value: '15', icon: MapPin, color: 'text-orange-500' }, // Mocked for now
          ]);
        } catch (error) {
          console.error("Error fetching stats:", error);
          // Handle error, e.g., show a toast message
        } finally {
          setLoading(false);
        }
      };
      fetchStats();
    }
  }, [user]);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
            <CardHeader>
                <CardTitle>Atividade Recente</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Em breve: um feed com as últimas atividades.</p>
            </CardContent>
        </Card>
        <Card className="flex justify-center items-center p-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border"
          />
        </Card>
      </div>
    </div>
  );
}

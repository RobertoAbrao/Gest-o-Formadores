'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, BookCopy, MapPin, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect trainers to their material list
  useEffect(() => {
    if (user && user.perfil === 'formador') {
      router.replace('/materiais');
    }
  }, [user, router]);

  if (!user || user.perfil !== 'administrador') {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    { title: 'Formadores Ativos', value: '42', icon: Users, color: 'text-blue-500' },
    { title: 'Materiais Disponíveis', value: '128', icon: BookCopy, color: 'text-green-500' },
    { title: 'Municípios Cobertos', value: '15', icon: MapPin, color: 'text-orange-500' },
  ];

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
      <div>
        {/* Placeholder for future charts or activity feeds */}
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>Atividade Recente</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Em breve: um feed com as últimas atividades.</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

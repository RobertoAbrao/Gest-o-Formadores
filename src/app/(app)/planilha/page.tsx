
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Sheet } from 'lucide-react';
import type { ProjetoImplatancao } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface Activity {
  date: Date;
  endDate?: Date;
  municipio: string;
  uf: string;
  atividade: string;
  observacoes: string;
}

const formatDate = (date: Date): string => {
    return format(date, "dd/MM");
}

const formatPeriod = (start: Date, end: Date): string => {
    const startFormat = format(start, "dd/MM");
    const endFormat = format(end, "dd/MM");
    return `${startFormat} a ${endFormat}`;
}

export default function PlanilhaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<ProjetoImplatancao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjetos = useCallback(async () => {
    setLoading(true);
    try {
      const projetosSnapshot = await getDocs(query(collection(db, 'projetos'), orderBy('dataCriacao', 'desc')));
      const projetosData = projetosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjetoImplatancao));
      setProjetos(projetosData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os projetos.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user && user.perfil !== 'administrador') {
      router.replace('/materiais');
    } else if (user?.perfil === 'administrador') {
        fetchProjetos();
    }
  }, [user, router, fetchProjetos]);

  const activitiesByMonth = useMemo(() => {
    const allActivities: Activity[] = [];
    projetos.forEach(p => {
        if (p.dataImplantacao) {
            allActivities.push({
                date: p.dataImplantacao.toDate(),
                municipio: p.municipio,
                uf: p.uf,
                atividade: "Implantação",
                observacoes: p.diagnostica?.detalhes || ''
            });
        }
        if (p.dataMigracao) {
             allActivities.push({
                date: p.dataMigracao.toDate(),
                municipio: p.municipio,
                uf: p.uf,
                atividade: "Migração de Dados",
                observacoes: ''
            });
        }
        if (p.simulados) {
            Object.entries(p.simulados).forEach(([key, simulado]) => {
                if (simulado.dataInicio) {
                     allActivities.push({
                        date: (simulado.dataInicio as Timestamp).toDate(),
                        endDate: simulado.dataFim ? (simulado.dataFim as Timestamp).toDate() : undefined,
                        municipio: p.municipio,
                        uf: p.uf,
                        atividade: `Simulado ${key.replace('s','')}`,
                        observacoes: simulado.detalhes || ''
                    });
                }
            })
        }
        if (p.devolutivas) {
            Object.entries(p.devolutivas).forEach(([key, devolutiva]) => {
                if ('data' in devolutiva && devolutiva.data) {
                     allActivities.push({
                        date: (devolutiva.data as Timestamp).toDate(),
                        municipio: p.municipio,
                        uf: p.uf,
                        atividade: `Devolutiva ${key.replace('d','')}`,
                        observacoes: devolutiva.detalhes || (devolutiva.formador ? `Formador: ${devolutiva.formador}` : '')
                    });
                } else if ('dataInicio' in devolutiva && devolutiva.dataInicio) {
                    allActivities.push({
                        date: (devolutiva.dataInicio as Timestamp).toDate(),
                        endDate: devolutiva.dataFim ? (devolutiva.dataFim as Timestamp).toDate() : undefined,
                        municipio: p.municipio,
                        uf: p.uf,
                        atividade: `Devolutiva ${key.replace('d','')}`,
                        observacoes: devolutiva.detalhes || (devolutiva.formador ? `Formador: ${devolutiva.formador}` : '')
                    });
                }
            })
        }
    });

    allActivities.sort((a,b) => a.date.getTime() - b.date.getTime());

    return allActivities.reduce((acc, activity) => {
        const monthYear = format(activity.date, "MMMM yyyy", { locale: ptBR });
        if (!acc[monthYear]) {
            acc[monthYear] = [];
        }
        acc[monthYear].push(activity);
        return acc;
    }, {} as Record<string, Activity[]>);

  }, [projetos]);

  const handleExport = (activities: Activity[], monthYear: string) => {
    const dataToExport = activities.map(activity => ({
      'Data/Período': activity.endDate ? formatPeriod(activity.date, activity.endDate) : formatDate(activity.date),
      'Município (UF)': `${activity.municipio} (${activity.uf})`,
      'Atividade': activity.atividade,
      'Observações': activity.observacoes
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Atividades");
    
    // Auto-size columns
    const cols = Object.keys(dataToExport[0]);
    const colWidths = cols.map(col => ({
        wch: Math.max(
            col.length,
            ...dataToExport.map(row => row[col as keyof typeof row]?.toString().length ?? 0)
        )
    }));
    worksheet["!cols"] = colWidths;
    
    XLSX.writeFile(workbook, `Planilha Atividades - ${monthYear}.xlsx`);
  };
  
  if (loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-6 h-full">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Planilha de Atividades</h1>
            <p className="text-muted-foreground">Visualize todas as atividades dos projetos em um único lugar.</p>
        </div>
      </div>
      
      {Object.keys(activitiesByMonth).length === 0 ? (
         <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <Sheet className="w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma atividade encontrada</h3>
            <p className="text-sm text-muted-foreground">Não há atividades de projeto para exibir na planilha.</p>
        </div>
      ) : (
        <div className="space-y-8">
            {Object.entries(activitiesByMonth).map(([monthYear, activities]) => (
                <Card key={monthYear} className="shadow-md">
                    <CardHeader>
                        <CardTitle className="capitalize">{monthYear}</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Data/Período</TableHead>
                                        <TableHead>Município (UF)</TableHead>
                                        <TableHead>Atividade</TableHead>
                                        <TableHead>Observações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activities.map((activity, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">
                                                {activity.endDate ? formatPeriod(activity.date, activity.endDate) : formatDate(activity.date)}
                                            </TableCell>
                                            <TableCell>{activity.municipio} ({activity.uf})</TableCell>
                                            <TableCell>{activity.atividade}</TableCell>
                                            <TableCell className="text-muted-foreground">{activity.observacoes}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" onClick={() => handleExport(activities, monthYear)}>
                            <Sheet className="mr-2 h-4 w-4" />
                            Exportar para as Planilhas
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
}

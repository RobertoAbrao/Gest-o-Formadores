
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
import { Loader2, Sheet, GanttChartSquare } from 'lucide-react';
import type { ProjetoImplatancao } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { format, differenceInDays, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Activity {
  startDate: Date;
  endDate: Date;
  municipio: string;
  uf: string;
  atividade: string;
  observacoes: string;
  tipo: 'implantacao' | 'migracao' | 'simulado' | 'devolutiva' | 'diagnostica';
  isMilestone: boolean;
}

const activityColors: Record<Activity['tipo'], string> = {
    implantacao: 'bg-red-500',
    migracao: 'bg-red-700',
    diagnostica: 'bg-yellow-500',
    simulado: 'bg-blue-500',
    devolutiva: 'bg-green-500',
};


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

  const { activitiesByProject, timelineStart, timelineEnd, totalDays, months } = useMemo(() => {
    const allActivities: Activity[] = [];
    projetos.forEach(p => {
        if (p.dataImplantacao) {
            allActivities.push({
                startDate: p.dataImplantacao.toDate(),
                endDate: p.dataImplantacao.toDate(),
                municipio: p.municipio, uf: p.uf,
                atividade: "Implantação", observacoes: p.diagnostica?.detalhes || '',
                tipo: 'implantacao', isMilestone: true,
            });
        }
        if (p.dataMigracao) {
             allActivities.push({
                startDate: p.dataMigracao.toDate(),
                endDate: p.dataMigracao.toDate(),
                municipio: p.municipio, uf: p.uf,
                atividade: "Migração de Dados", observacoes: '',
                tipo: 'migracao', isMilestone: true,
            });
        }
        if (p.diagnostica?.data) {
             allActivities.push({
                startDate: p.diagnostica.data.toDate(),
                endDate: p.diagnostica.data.toDate(),
                municipio: p.municipio, uf: p.uf,
                atividade: "Avaliação Diagnóstica", observacoes: p.diagnostica.detalhes || '',
                tipo: 'diagnostica', isMilestone: true,
            });
        }
        if (p.simulados) {
            Object.entries(p.simulados).forEach(([key, simulado]) => {
                if (simulado.dataInicio && simulado.dataFim) {
                     allActivities.push({
                        startDate: (simulado.dataInicio as Timestamp).toDate(),
                        endDate: (simulado.dataFim as Timestamp).toDate(),
                        municipio: p.municipio, uf: p.uf,
                        atividade: `Simulado ${key.replace('s','')}`, observacoes: simulado.detalhes || '',
                        tipo: 'simulado', isMilestone: false,
                    });
                }
            })
        }
        if (p.devolutivas) {
            Object.entries(p.devolutivas).forEach(([key, devolutiva]) => {
                const isSingleDate = 'data' in devolutiva && devolutiva.data;
                const hasPeriod = 'dataInicio' in devolutiva && devolutiva.dataInicio && 'dataFim' in devolutiva && devolutiva.dataFim;

                if (isSingleDate || hasPeriod) {
                    allActivities.push({
                        startDate: (isSingleDate ? (devolutiva.data as Timestamp) : (devolutiva.dataInicio as Timestamp)).toDate(),
                        endDate: (isSingleDate ? (devolutiva.data as Timestamp) : (devolutiva.dataFim as Timestamp)).toDate(),
                        municipio: p.municipio, uf: p.uf,
                        atividade: `Devolutiva ${key.replace('d','')}`,
                        observacoes: devolutiva.detalhes || (devolutiva.formador ? `Formador: ${devolutiva.formador}` : ''),
                        tipo: 'devolutiva', isMilestone: isSingleDate,
                    });
                }
            })
        }
    });

    if (allActivities.length === 0) {
        return { activitiesByProject: {}, timelineStart: new Date(), timelineEnd: new Date(), totalDays: 0, months: [] };
    }

    const timelineStart = startOfMonth(allActivities.reduce((min, a) => a.startDate < min ? a.startDate : min, allActivities[0].startDate));
    const timelineEnd = endOfMonth(allActivities.reduce((max, a) => a.endDate > max ? a.endDate : max, allActivities[0].endDate));
    const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
    
    const activitiesByProject = allActivities.reduce((acc, activity) => {
        const key = `${activity.municipio} (${activity.uf})`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(activity);
        return acc;
    }, {} as Record<string, Activity[]>);

    const months = [];
    let currentMonth = timelineStart;
    while(currentMonth <= timelineEnd) {
        const monthEnd = endOfMonth(currentMonth);
        const daysInMonth = differenceInDays(monthEnd, currentMonth) + 1;
        const widthPercentage = (daysInMonth / totalDays) * 100;
        months.push({
            name: format(currentMonth, 'MMMM yyyy', { locale: ptBR }),
            width: `${widthPercentage}%`
        });
        currentMonth = addMonths(currentMonth, 1);
    }
    
    return { activitiesByProject, timelineStart, timelineEnd, totalDays, months };

  }, [projetos]);

  const handleExport = () => {
     const allActivities = Object.values(activitiesByProject).flat();
     if (allActivities.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhum dado para exportar.' });
        return;
     }
    const dataToExport = allActivities.map(activity => ({
      'Data/Período': activity.isMilestone ? format(activity.startDate, "dd/MM/yyyy") : `${format(activity.startDate, "dd/MM/yyyy")} a ${format(activity.endDate, "dd/MM/yyyy")}`,
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
    
    XLSX.writeFile(workbook, `Planilha Atividades - Geral.xlsx`);
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
            <h1 className="text-3xl font-bold tracking-tight font-headline">Timeline de Projetos</h1>
            <p className="text-muted-foreground">Visualize o cronograma de todas as atividades dos projetos.</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={Object.keys(activitiesByProject).length === 0}>
            <Sheet className="mr-2 h-4 w-4" />
            Exportar para Planilhas
        </Button>
      </div>
      
      {Object.keys(activitiesByProject).length === 0 ? (
         <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <GanttChartSquare className="w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma atividade encontrada</h3>
            <p className="text-sm text-muted-foreground">Não há atividades de projeto para exibir na linha do tempo.</p>
        </div>
      ) : (
        <Card className="shadow-md">
            <CardContent className="p-4 overflow-x-auto">
                <TooltipProvider>
                    <div className="min-w-[1200px]">
                        {/* Header com meses */}
                        <div className="flex bg-muted/50 rounded-t-lg">
                             <div className="w-64 shrink-0 p-2 font-semibold border-r">Projetos</div>
                             <div className="flex-grow flex">
                                {months.map(month => (
                                    <div key={month.name} style={{ width: month.width }} className="p-2 text-center font-semibold border-r text-sm capitalize">
                                        {month.name}
                                    </div>
                                ))}
                             </div>
                        </div>

                        {/* Linhas de Projeto */}
                        <div className="divide-y">
                            {Object.entries(activitiesByProject).map(([projectName, activities]) => (
                                <div key={projectName} className="flex">
                                    <div className="w-64 shrink-0 p-3 font-medium border-r truncate">{projectName}</div>
                                    <div className="flex-grow relative h-14">
                                        {activities.map((activity, index) => {
                                            const left = (differenceInDays(activity.startDate, timelineStart) / totalDays) * 100;
                                            const width = ((differenceInDays(activity.endDate, activity.startDate) + 1) / totalDays) * 100;
                                            return (
                                                <Tooltip key={index}>
                                                    <TooltipTrigger asChild>
                                                         <div
                                                            className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-md flex items-center px-2 text-white text-xs whitespace-nowrap overflow-hidden ${activityColors[activity.tipo]}`}
                                                            style={{ left: `${left}%`, width: `${width}%` }}
                                                        >
                                                            <span className="truncate">{activity.atividade}</span>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="font-bold">{activity.atividade}</p>
                                                        <p>Período: {format(activity.startDate, 'dd/MM/yy')} - {format(activity.endDate, 'dd/MM/yy')}</p>
                                                        {activity.observacoes && <p className="text-muted-foreground">Obs: {activity.observacoes}</p>}
                                                    </TooltipContent>
                                                </Tooltip>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </TooltipProvider>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

    
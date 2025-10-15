
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
import { Loader2, Sheet, GanttChartSquare, Search, CheckCircle2, XCircle, User } from 'lucide-react';
import type { ProjetoImplatancao, Formador } from '@/lib/types';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';


interface Activity {
  projetoId: string;
  municipio: string;
  uf: string;
  atividade: string;
  startDate: Date | null;
  endDate: Date | null;
  formadores: string[];
  ok: boolean;
}

export default function PlanilhaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<ProjetoImplatancao[]>([]);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState<string>('all');
  const [selectedFormador, setSelectedFormador] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'pending'>('all');


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projetosSnapshot, formadoresSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'projetos'), orderBy('dataCriacao', 'desc'))),
        getDocs(collection(db, 'formadores')),
      ]);

      const projetosData = projetosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjetoImplatancao));
      setProjetos(projetosData);
      
      const formadoresData = formadoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
      setFormadores(formadoresData);

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
        fetchData();
    }
  }, [user, router, fetchData]);

  const allActivities = useMemo(() => {
    const activities: Activity[] = [];
    const formadorMap = new Map(formadores.map(f => [f.id, f.nomeCompleto]));

    projetos.forEach(p => {
        const getFormadorNomes = (ids?: string[]): string[] => {
            if (!ids) return [];
            return ids.map(id => formadorMap.get(id) || 'Desconhecido').filter(nome => nome !== 'Desconhecido');
        }

        if (p.dataImplantacao) {
            activities.push({
                projetoId: p.id, municipio: p.municipio, uf: p.uf, atividade: "Implantação",
                startDate: p.dataImplantacao.toDate(), endDate: p.dataImplantacao.toDate(),
                formadores: getFormadorNomes(p.formadoresIds), ok: true,
            });
        }
        if (p.diagnostica?.data) {
             activities.push({
                projetoId: p.id, municipio: p.municipio, uf: p.uf, atividade: "Avaliação Diagnóstica",
                startDate: p.diagnostica.data.toDate(), endDate: p.diagnostica.data.toDate(),
                formadores: getFormadorNomes(p.formadoresIds), ok: !!p.diagnostica.ok,
            });
        }
        if (p.simulados) {
            Object.entries(p.simulados).forEach(([key, simulado]) => {
                if (simulado.dataInicio && simulado.dataFim) {
                     activities.push({
                        projetoId: p.id, municipio: p.municipio, uf: p.uf, atividade: `Simulado ${key.replace('s','')}`,
                        startDate: (simulado.dataInicio as Timestamp).toDate(), endDate: (simulado.dataFim as Timestamp).toDate(),
                        formadores: getFormadorNomes(p.formadoresIds), ok: !!simulado.ok
                    });
                }
            })
        }
        if (p.devolutivas) {
            Object.entries(p.devolutivas).forEach(([key, devolutiva]) => {
                const hasPeriod = 'dataInicio' in devolutiva && devolutiva.dataInicio && 'dataFim' in devolutiva && devolutiva.dataFim;
                if (hasPeriod) {
                    activities.push({
                        projetoId: p.id, municipio: p.municipio, uf: p.uf, atividade: `Devolutiva ${key.replace('d','')}`,
                        startDate: (devolutiva.dataInicio as Timestamp).toDate(), endDate: (devolutiva.dataFim as Timestamp).toDate(),
                        formadores: devolutiva.formadores || getFormadorNomes(p.formadoresIds), ok: !!devolutiva.ok,
                    });
                }
            })
        }
    });
    return activities.sort((a,b) => (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0));
  }, [projetos, formadores]);
  
  const filteredActivities = useMemo(() => {
    return allActivities.filter(activity => {
        const searchMatch = searchTerm.trim() === '' || activity.municipio.toLowerCase().includes(searchTerm.toLowerCase());
        const ufMatch = selectedUf === 'all' || activity.uf === selectedUf;
        const formadorMatch = selectedFormador === 'all' || activity.formadores.some(nome => nome === selectedFormador);
        const statusMatch = statusFilter === 'all' || (statusFilter === 'ok' && activity.ok) || (statusFilter === 'pending' && !activity.ok);
        return searchMatch && ufMatch && formadorMatch && statusMatch;
    });
  }, [allActivities, searchTerm, selectedUf, selectedFormador, statusFilter]);
  
  const ufs = useMemo(() => [...new Set(projetos.map(p => p.uf))].sort(), [projetos]);
  
  const handleExport = () => {
     if (filteredActivities.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhum dado para exportar.' });
        return;
     }
    const dataToExport = filteredActivities.map(activity => ({
      'Município': activity.municipio,
      'UF': activity.uf,
      'Atividade': activity.atividade,
      'Data Início': activity.startDate ? format(activity.startDate, "dd/MM/yyyy") : 'N/A',
      'Data Fim': activity.endDate ? format(activity.endDate, "dd/MM/yyyy") : 'N/A',
      'Formadores': activity.formadores.join(', '),
      'Status': activity.ok ? 'Concluído' : 'Pendente',
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
    
    XLSX.writeFile(workbook, `Planilha Atividades.xlsx`);
  };
  
  if (loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6 h-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Planilha de Atividades</h1>
            <p className="text-muted-foreground">Filtre e visualize todas as atividades dos projetos.</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filteredActivities.length === 0}>
            <Sheet className="mr-2 h-4 w-4" />
            Exportar para Planilhas
        </Button>
      </div>

       <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
                <div className="relative flex-grow min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por município..." 
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={selectedUf} onValueChange={setSelectedUf}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por UF" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Estados</SelectItem>
                        {ufs.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Select value={selectedFormador} onValueChange={setSelectedFormador}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                        <SelectValue placeholder="Filtrar por Formador" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Formadores</SelectItem>
                        {formadores.map(f => <SelectItem key={f.id} value={f.nomeCompleto}>{f.nomeCompleto}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <ToggleGroup 
                    type="single" 
                    value={statusFilter} 
                    onValueChange={(value: 'all' | 'ok' | 'pending') => value && setStatusFilter(value)}
                    className="border rounded-md"
                >
                    <ToggleGroupItem value="all">Todos</ToggleGroupItem>
                    <ToggleGroupItem value="pending">Pendentes</ToggleGroupItem>
                    <ToggleGroupItem value="ok">Concluídos</ToggleGroupItem>
                </ToggleGroup>
            </CardContent>
        </Card>
      
      {allActivities.length === 0 ? (
         <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <GanttChartSquare className="w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma atividade encontrada</h3>
            <p className="text-sm text-muted-foreground">Não há atividades de projeto para exibir na planilha.</p>
        </div>
      ) : (
        <Card className="shadow-md">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Projeto</TableHead>
                                <TableHead>Atividade</TableHead>
                                <TableHead>Período</TableHead>
                                <TableHead>Formadores</TableHead>
                                <TableHead className='text-center'>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredActivities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        Nenhuma atividade encontrada para os filtros selecionados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredActivities.map((activity, index) => (
                                    <TableRow key={`${activity.projetoId}-${index}`}>
                                        <TableCell className="font-medium">
                                            {activity.municipio} <span className="text-muted-foreground">({activity.uf})</span>
                                        </TableCell>
                                        <TableCell>{activity.atividade}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {activity.startDate ? format(activity.startDate, 'dd/MM/yy') : 'N/A'} - {activity.endDate ? format(activity.endDate, 'dd/MM/yy') : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {activity.formadores.map(nome => <Badge key={nome} variant="secondary">{nome.split(' ')[0]}</Badge>)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {activity.ok ? 
                                                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> : 
                                                <XCircle className="h-5 w-5 text-destructive mx-auto" />
                                            }
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

    
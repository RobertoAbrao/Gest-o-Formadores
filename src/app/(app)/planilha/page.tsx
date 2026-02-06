
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
import { Loader2, Sheet, GanttChartSquare, Search, CheckCircle2, XCircle, User, PlusCircle, BookOpenCheck } from 'lucide-react';
import type { ProjetoImplatancao, Formador, Demanda } from '@/lib/types';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormProjeto } from '@/components/projetos/form-projeto';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


interface Activity {
  nome: string;
  startDate: Date | null;
  endDate: Date | null;
  ok: boolean;
}

interface ProjetoComAtividades extends ProjetoImplatancao {
    atividades: Activity[];
    demandaCount: number;
}

type GroupedProjetos = {
    [year: string]: ProjetoComAtividades[];
}


export default function PlanilhaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<ProjetoImplatancao[]>([]);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState<string>('all');
  const [selectedFormador, setSelectedFormador] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'pending'>('all');

  // Edit Modal State
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<ProjetoImplatancao | null>(null);


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projetosSnapshot, formadoresSnapshot, demandasSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'projetos'), orderBy('dataCriacao', 'desc'))),
        getDocs(collection(db, 'formadores')),
        getDocs(collection(db, 'demandas')),
      ]);

      const projetosData = projetosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjetoImplatancao));
      setProjetos(projetosData);
      
      const formadoresData = formadoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
      setFormadores(formadoresData);

      const demandasData = demandasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Demanda));
      setDemandas(demandasData);

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

  const projetosComAtividades = useMemo<ProjetoComAtividades[]>(() => {
    const demandasPorProjeto = demandas.reduce((acc, demanda) => {
        if (demanda.projetoOrigemId) {
            if (!acc[demanda.projetoOrigemId]) {
                acc[demanda.projetoOrigemId] = 0;
            }
            acc[demanda.projetoOrigemId]++;
        }
        return acc;
    }, {} as Record<string, number>);

    return projetos.map(p => {
        const atividades: Activity[] = [];
        
        if (p.dataImplantacao) {
            atividades.push({ nome: "Implantação", startDate: p.dataImplantacao.toDate(), endDate: p.dataImplantacao.toDate(), ok: true });
        }
        if (p.diagnostica?.data) {
            atividades.push({ nome: "Avaliação Diagnóstica", startDate: p.diagnostica.data.toDate(), endDate: p.diagnostica.data.toDate(), ok: !!p.diagnostica.ok });
        }
        if (p.simulados) {
            Object.entries(p.simulados).forEach(([key, simulado]) => {
                if (simulado.dataInicio) {
                     atividades.push({ nome: `Simulado ${key.replace('s','')}`, startDate: (simulado.dataInicio as Timestamp).toDate(), endDate: (simulado.dataFim as Timestamp | undefined)?.toDate() ?? null, ok: !!simulado.ok });
                }
            })
        }
        if (p.devolutivas) {
            Object.entries(p.devolutivas).forEach(([key, devolutiva]) => {
                 if (devolutiva.dataInicio) {
                    atividades.push({ nome: `Devolutiva ${key.replace('d','')}`, startDate: (devolutiva.dataInicio as Timestamp).toDate(), endDate: (devolutiva.dataFim as Timestamp | undefined)?.toDate() ?? null, ok: !!devolutiva.ok });
                }
            })
        }
        
        atividades.sort((a,b) => (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0));
        
        return { 
            ...p, 
            atividades,
            demandaCount: demandasPorProjeto[p.id] || 0
        };
    })
  }, [projetos, demandas]);
  
  const formadoresMap = useMemo(() => new Map(formadores.map(f => [f.id, f.nomeCompleto])), [formadores]);

  const filteredProjetos = useMemo(() => {
    return projetosComAtividades.filter(p => {
        const searchMatch = searchTerm.trim() === '' || p.municipio.toLowerCase().includes(searchTerm.toLowerCase());
        const ufMatch = selectedUf === 'all' || p.uf === selectedUf;
        
        const formadorMatch = selectedFormador === 'all' || 
            p.formadoresIds?.includes(selectedFormador) ||
            Object.values(p.devolutivas || {}).some(d => d.formadores?.some(nome => formadores.find(f => f.nomeCompleto === nome)?.id === selectedFormador));

        const statusMatch = statusFilter === 'all' || p.atividades.some(a => (statusFilter === 'ok' && a.ok) || (statusFilter === 'pending' && !a.ok));

        return searchMatch && ufMatch && formadorMatch && statusMatch;
    });
  }, [projetosComAtividades, searchTerm, selectedUf, selectedFormador, statusFilter, formadores]);
  
  const ufs = useMemo(() => [...new Set(projetos.map(p => p.uf))].sort(), [projetos]);

  const groupedProjetos = useMemo(() => {
    return filteredProjetos.reduce((acc, projeto) => {
        const year = projeto.dataCriacao ? projeto.dataCriacao.toDate().getFullYear().toString() : 'Sem Data';
        if (!acc[year]) {
            acc[year] = [];
        }
        acc[year].push(projeto);
        return acc;
    }, {} as GroupedProjetos);
  }, [filteredProjetos]);

  const sortedYears = useMemo(() => Object.keys(groupedProjetos).sort((a,b) => Number(b) - Number(a)), [groupedProjetos]);
  
  const handleExport = () => {
    if (filteredProjetos.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhum dado para exportar.' });
        return;
    }

    const dataToExport = filteredProjetos.flatMap(p => 
        p.atividades.map(a => ({
            'Município': p.municipio,
            'UF': p.uf,
            'Atividade': a.nome,
            'Data Início': a.startDate ? format(a.startDate, "dd/MM/yyyy") : 'N/A',
            'Data Fim': a.endDate ? format(a.endDate, "dd/MM/yyyy") : 'N/A',
            'Status': a.ok ? 'Concluído' : 'Pendente',
        }))
    );

    if (dataToExport.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhuma atividade para exportar nos projetos filtrados.' });
        return;
    }

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

  const handleEditClick = (projeto: ProjetoImplatancao) => {
    setSelectedProjeto(projeto);
    setIsFormDialogOpen(true);
  };

  const handleFormSuccess = () => {
    fetchData(); // Re-fetch data to reflect changes
    setIsFormDialogOpen(false);
    setSelectedProjeto(null);
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
        <Button variant="outline" onClick={handleExport} disabled={filteredProjetos.length === 0}>
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
                        {formadores.map(f => <SelectItem key={f.id} value={f.id}>{f.nomeCompleto}</SelectItem>)}
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
      
      {projetos.length === 0 ? (
         <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <GanttChartSquare className="w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum projeto encontrado</h3>
            <p className="text-sm text-muted-foreground">Comece criando um novo projeto para visualizar suas atividades aqui.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[sortedYears[0]]} className="w-full space-y-4">
             {sortedYears.map(year => (
                <AccordionItem value={year} key={year} className="border rounded-lg px-4 bg-card shadow-sm">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-semibold">{year}</h3>
                            <Badge variant="outline">{groupedProjetos[year].length} {groupedProjetos[year].length === 1 ? 'projeto' : 'projetos'}</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                           {groupedProjetos[year].map((projeto) => (
                                <Card 
                                    key={projeto.id} 
                                    className="flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
                                    onClick={() => handleEditClick(projeto)}
                                >
                                    <CardHeader>
                                        <CardTitle>{projeto.municipio}</CardTitle>
                                        <CardDescription>{projeto.uf}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow space-y-2">
                                        {projeto.atividades.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade agendada.</p>
                                        ) : (
                                            projeto.atividades.map((atividade, index) => (
                                                <div key={index} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50">
                                                    <span className="font-medium">{atividade.nome}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-muted-foreground">
                                                            {atividade.startDate ? format(atividade.startDate, 'dd/MM/yy') : 'N/A'}
                                                        </span>
                                                        {atividade.ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </CardContent>
                                    <CardFooter className="flex justify-between items-center">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {projeto.formadoresIds?.length || 0} formador(es)
                                        </p>
                                        {projeto.demandaCount > 0 && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <BookOpenCheck className="h-3 w-3" />
                                                {projeto.demandaCount} demanda(s)
                                            </p>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
             ))}
             {filteredProjetos.length === 0 && (
                 <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
                    <Search className="w-12 h-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">Nenhum projeto encontrado</h3>
                    <p className="text-sm text-muted-foreground">Tente ajustar seus filtros de busca.</p>
                </div>
            )}
        </Accordion>
      )}

        <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
          setIsFormDialogOpen(open);
          if (!open) setSelectedProjeto(null);
        }}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedProjeto ? 'Editar Projeto' : 'Novo Projeto de Implantação'}</DialogTitle>
              <DialogDescription>
                {selectedProjeto ? 'Altere os dados do projeto.' : 'Preencha os dados para cadastrar um novo projeto.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className='max-h-[80vh]'>
                <div className='p-4'>
                    <FormProjeto projeto={selectedProjeto} onSuccess={handleFormSuccess} />
                </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

    </div>
  );
}

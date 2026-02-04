

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2, Loader2, BookOpenCheck, Hourglass, ListTodo, CheckCircle, BadgeCheck, AlertTriangle, Mail, User } from 'lucide-react';
import type { Demanda, StatusDemanda } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc, query, orderBy, where, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormDemanda } from '@/components/diario/form-diario';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, isBefore, startOfToday, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";


const statusOptions: StatusDemanda[] = ['Pendente', 'Em andamento', 'Aguardando retorno', 'Concluída'];
const priorityOptions: Demanda['prioridade'][] = ['Normal', 'Urgente'];

const statusConfig: Record<StatusDemanda, { color: string, label: string }> = {
  'Pendente': { color: 'border-yellow-500', label: 'Pendente' },
  'Em andamento': { color: 'border-blue-500', label: 'Em Andamento' },
  'Concluída': { color: 'border-green-500', label: 'Concluída' },
  'Aguardando retorno': { color: 'border-orange-500', label: 'Aguardando Retorno' },
};

const getCardClass = (demanda: Demanda): string => {
    if (demanda.validado) {
        return 'bg-teal-50 dark:bg-teal-900/40 opacity-80 hover:opacity-100';
    }
    if (demanda.status === 'Concluída') {
      return 'bg-muted/50 text-muted-foreground opacity-70 hover:opacity-100';
    }
    
    const hoje = startOfToday();
    const prazoDate = demanda.prazo?.toDate();
    
    if (demanda.prioridade === 'Urgente') {
      if (prazoDate && isBefore(prazoDate, hoje)) {
        return 'bg-red-100 border-red-200 dark:bg-red-900/40 dark:border-red-800 hover:bg-red-100/80 dark:hover:bg-red-900/50';
      }
      return 'bg-orange-100 border-orange-200 dark:bg-orange-900/40 dark:border-orange-800 hover:bg-orange-100/80 dark:hover:bg-orange-900/50';
    }

    if (!prazoDate) {
      return '';
    }
    
    const limiteAmarelo = addDays(hoje, 3);

    if (isBefore(prazoDate, hoje)) {
      return 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/50 hover:bg-red-50/80 dark:hover:bg-red-900/30';
    }
    
    if (isBefore(prazoDate, limiteAmarelo)) {
      return 'bg-yellow-50 border-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-800/50 hover:bg-yellow-50/80 dark:hover:bg-yellow-900/30';
    }
    
    return '';
};

const validatorEmails = ['beto-a-p@hotmail.com', 'irene@editoralt.com.br'];


export default function DiarioPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDemanda, setSelectedDemanda] = useState<Demanda | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [responsavelFilter, setResponsavelFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'Normal' | 'Urgente'>('all');
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');

  const [admins, setAdmins] = useState<{ id: string, nome: string }[]>([]);
  const [loadingValidation, setLoadingValidation] = useState<string | null>(null);

  const canValidate = useMemo(() => user?.email && validatorEmails.includes(user.email), [user]);

  const fetchDemandas = useCallback(async () => {
    setLoading(true);
    try {
      const demandasQuery = query(collection(db, 'demandas'), orderBy('dataCriacao', 'desc'));
      const adminsQuery = query(collection(db, 'usuarios'), where('perfil', '==', 'administrador'));
      
      const [demandasSnapshot, adminsSnapshot] = await Promise.all([
          getDocs(demandasQuery),
          getDocs(adminsQuery)
      ]);

      const demandasData = demandasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Demanda));
      setDemandas(demandasData);
      
      const adminsData = adminsSnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
      setAdmins(adminsData);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados do diário.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDemandas();
  }, [fetchDemandas]);

  const handleSuccess = () => {
    fetchDemandas();
    setIsDialogOpen(false);
    setSelectedDemanda(null);
  };

  const handleValidate = async (demandaId: string) => {
    if (!canValidate) {
        toast({ variant: 'destructive', title: 'Acesso negado.' });
        return;
    }
    setLoadingValidation(demandaId);
    try {
        const demandaRef = doc(db, 'demandas', demandaId);
        await updateDoc(demandaRef, { validado: true });
        toast({ title: 'Sucesso!', description: 'Demanda validada com sucesso.' });
        fetchDemandas();
    } catch (error) {
        console.error("Error validating demanda: ", error);
        toast({ variant: 'destructive', title: 'Erro ao validar', description: 'Não foi possível validar a demanda.' });
    } finally {
        setLoadingValidation(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedDemanda) return;
    try {
      await deleteDoc(doc(db, "demandas", selectedDemanda.id));
      toast({ title: 'Sucesso!', description: 'Demanda excluída com sucesso.' });
      fetchDemandas();
    } catch (error) {
      console.error("Error deleting demanda: ", error);
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'Não foi possível excluir a demanda.' });
    } finally {
      setIsDeleteDialogOpen(false);
      setSelectedDemanda(null);
    }
  };

  const openEditDialog = (demanda: Demanda) => {
    setSelectedDemanda(demanda);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (demanda: Demanda) => {
    setSelectedDemanda(demanda);
    setIsDeleteDialogOpen(true);
  };

  const filteredDemandas = useMemo(() => {
    return demandas.filter(d => {
      const searchMatch = searchTerm === '' ||
        d.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.demanda.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.responsavelNome.toLowerCase().includes(searchTerm.toLowerCase());
      
      const responsavelMatch = responsavelFilter === 'all' || d.responsavelId === responsavelFilter;
      const priorityMatch = priorityFilter === 'all' || d.prioridade === priorityFilter;
      const viewMatch = viewMode === 'all' || d.responsavelId === user?.uid;

      return searchMatch && responsavelMatch && priorityMatch && viewMatch;
    });
  }, [demandas, searchTerm, responsavelFilter, priorityFilter, viewMode, user]);

 const groupedDemandas = useMemo(() => {
    const grouped = statusOptions.reduce((acc, status) => {
      acc[status] = [];
      return acc;
    }, {} as Record<StatusDemanda, Demanda[]>);

    filteredDemandas.forEach(demanda => {
      if (grouped[demanda.status]) {
        grouped[demanda.status].push(demanda);
      }
    });

    for (const status in grouped) {
        grouped[status as StatusDemanda].sort((a, b) => {
            const aIsUrgente = a.prioridade === 'Urgente';
            const bIsUrgente = b.prioridade === 'Urgente';
            if (aIsUrgente !== bIsUrgente) return aIsUrgente ? -1 : 1;

            const aPrazo = a.prazo?.toMillis();
            const bPrazo = b.prazo?.toMillis();
            if (aPrazo && bPrazo) return aPrazo - bPrazo;
            if (aPrazo) return -1;
            if (bPrazo) return 1;

            return (b.dataCriacao?.toMillis() ?? 0) - (a.dataCriacao?.toMillis() ?? 0);
        });
    }

    return grouped;
  }, [filteredDemandas]);
  

  const summaryStats = useMemo(() => {
    return demandas.reduce((acc, d) => {
      if (d.status === 'Pendente') acc.pendente++;
      if (d.status === 'Em andamento') acc.emAndamento++;
      if (d.status === 'Aguardando retorno') acc.aguardando++;
      return acc;
    }, { pendente: 0, emAndamento: 0, aguardando: 0 });
  }, [demandas]);
  
  const generateDemandsEmailBody = (demandas: Demanda[]): string => {
    let body = "Olá equipe,\n\nSegue a lista de demandas do Diário de Bordo, filtrada pela visão atual:\n\n";

    if (demandas.length === 0) {
        body += "Nenhuma demanda encontrada com os filtros atuais.\n";
    } else {
        demandas.forEach(d => {
            const prazo = d.prazo ? d.prazo.toDate().toLocaleDateString('pt-BR') : 'N/A';
            body += `Município: ${d.municipio} - ${d.uf}\n`;
            body += `Demanda: ${d.demanda}\n`;
            body += `Status: ${d.status}\n`;
            body += `Prioridade: ${d.prioridade || 'Normal'}\n`;
            body += `Responsável: ${d.responsavelNome}\n`;
            body += `Prazo: ${prazo}\n`;
            body += `--------------------------------------------------\n\n`;
        });
    }

    body += "\nAtenciosamente,\nPortal de Gestão Pedagógica";
    return body;
  };

  const emailHref = useMemo(() => {
    const subject = "Relatório de Demandas - Diário de Bordo";
    const demandasParaEmail = filteredDemandas.filter(d => d.status !== 'Concluída' && !d.validado);
    const body = generateDemandsEmailBody(demandasParaEmail);
    const recipients = [
        "alessandra@editoralt.com.br",
        "amaranta@editoralt.com.br",
        "assessoria@editoralt.com.br",
        "irene@editoralt.com.br",
        "kellem@editoralt.com.br"
    ];
    
    const params = new URLSearchParams({
        to: recipients.join(','),
        su: subject,
        body: body,
    });

    return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
  }, [filteredDemandas]);
  
  const formatPrazo = (prazo: Timestamp | undefined | null) => {
    if (!prazo) return null;
    const prazoDate = prazo.toDate();
    const hoje = startOfToday();
    if (isBefore(prazoDate, hoje)) {
      return <span className="text-red-600 font-semibold">{prazoDate.toLocaleDateString('pt-BR')} (Atrasado)</span>
    }
    return <span>{prazoDate.toLocaleDateString('pt-BR')} ({formatDistanceToNow(prazoDate, { addSuffix: true, locale: ptBR })})</span>;
  };

  if (loading && demandas.length === 0) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Diário de Bordo</h1>
          <p className="text-muted-foreground">Registre e acompanhe as demandas dos municípios.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <a href={emailHref} target="_blank" rel="noopener noreferrer">
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar por Email
              </a>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setSelectedDemanda(null);
            }}>
            <DialogTrigger asChild>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova Demanda
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                <DialogTitle>{selectedDemanda ? 'Editar Demanda' : 'Nova Demanda'}</DialogTitle>
                <DialogDescription>
                    {selectedDemanda ? 'Altere os dados da demanda.' : 'Preencha os dados para registrar uma nova demanda.'}
                </DialogDescription>
                </DialogHeader>
                <ScrollArea className='max-h-[80vh]'>
                <div className='p-4'>
                    <FormDemanda demanda={selectedDemanda} onSuccess={handleSuccess} />
                </div>
                </ScrollArea>
            </DialogContent>
            </Dialog>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demandas Pendentes</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summaryStats.pendente}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Hourglass className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summaryStats.emAndamento}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Retorno</CardTitle>
            <Hourglass className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summaryStats.aguardando}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row flex-wrap items-center gap-4">
          <ToggleGroup type="single" value={viewMode} onValueChange={(value: 'all' | 'mine') => value && setViewMode(value)} className="border rounded-md">
            <ToggleGroupItem value="all">Todas as Demandas</ToggleGroupItem>
            <ToggleGroupItem value="mine">Minhas Demandas</ToggleGroupItem>
          </ToggleGroup>
          <div className="relative flex-grow w-full md:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por município, demanda ou responsável..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Responsáveis</SelectItem>
              {admins.map(admin => <SelectItem key={admin.id} value={admin.id}>{admin.nome}</SelectItem>)}
            </SelectContent>
          </Select>
           <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as any)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Prioridades</SelectItem>
              {priorityOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 -mx-4 px-4">
        {statusOptions.map(status => {
          const demandasDaColuna = groupedDemandas[status] || [];
          return (
            <div key={status} className="flex flex-col w-full min-w-[320px] md:w-1/4">
                <div className="flex items-center justify-between p-2 mb-4">
                    <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", statusConfig[status].color.replace('border-', 'bg-'))} />
                        <h2 className="font-semibold text-lg">{statusConfig[status].label}</h2>
                    </div>
                    <Badge variant="secondary">{demandasDaColuna.length}</Badge>
                </div>
                <ScrollArea className="flex-1 -m-2">
                    <div className="space-y-4 p-2">
                        {loading ? (
                            <Loader2 className="mx-auto h-6 w-6 animate-spin mt-8" />
                        ) : demandasDaColuna.length === 0 ? (
                            <div className="text-center text-sm text-muted-foreground p-8">Nenhuma demanda aqui.</div>
                        ) : (
                            demandasDaColuna.map(demanda => (
                                <Card 
                                    key={demanda.id} 
                                    onClick={() => openEditDialog(demanda)} 
                                    className={cn("cursor-pointer hover:shadow-md transition-shadow", getCardClass(demanda))}
                                >
                                    <CardHeader className="flex flex-row items-start justify-between p-3">
                                        <div className="space-y-1">
                                            {demanda.prioridade === 'Urgente' && (
                                                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                                    <AlertTriangle className="h-3 w-3" /> Urgente
                                                </Badge>
                                            )}
                                            {demanda.validado && (
                                                <Badge variant="outline" className="flex items-center gap-2 border-teal-500 bg-teal-100 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-700 text-teal-800">
                                                    <BadgeCheck className="h-3 w-3" /> Validada
                                                </Badge>
                                            )}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" className="h-7 w-7 p-0">
                                                <span className="sr-only">Abrir menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              {demanda.status === 'Concluída' && !demanda.validado && canValidate && (
                                                <>
                                                  <DropdownMenuItem 
                                                    onClick={(e) => { e.stopPropagation(); handleValidate(demanda.id); }}
                                                    disabled={loadingValidation === demanda.id}
                                                  >
                                                    {loadingValidation === demanda.id ? (
                                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                      <CheckCircle className="mr-2 h-4 w-4" />
                                                    )}
                                                    Validar Demanda
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator />
                                                </>
                                              )}
                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(demanda); }}>
                                                <Pencil className="mr-2 h-4 w-4" /> Editar
                                              </DropdownMenuItem>
                                              {user?.perfil === 'administrador' && (
                                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={(e) => { e.stopPropagation(); openDeleteDialog(demanda); }}>
                                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                                </DropdownMenuItem>
                                              )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0 space-y-2">
                                        <p className="font-semibold text-sm">{demanda.municipio} - {demanda.uf}</p>
                                        <p className="text-sm text-muted-foreground line-clamp-3">{demanda.demanda}</p>
                                    </CardContent>
                                    <CardFooter className="p-3 pt-0 text-xs text-muted-foreground space-y-2 flex-col items-start">
                                      <div className="flex items-center gap-2">
                                        <User className="h-3 w-3" /> {demanda.responsavelNome}
                                      </div>
                                      {demanda.prazo && (
                                        <div className="flex items-center gap-2">
                                          <Hourglass className="h-3 w-3" /> {formatPrazo(demanda.prazo)}
                                        </div>
                                      )}
                                    </CardFooter>
                                </Card>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>
          )
        })}
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Isso excluirá permanentemente a demanda.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDemanda(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setSelectedDemanda(null);
      }}>
        <DialogContent className="sm:max-w-xl">
            <DialogHeader>
            <DialogTitle>{selectedDemanda ? 'Editar Demanda' : 'Nova Demanda'}</DialogTitle>
            <DialogDescription>
                {selectedDemanda ? 'Altere os dados da demanda.' : 'Preencha os dados para registrar uma nova demanda.'}
            </DialogDescription>
            </DialogHeader>
            <ScrollArea className='max-h-[80vh]'>
            <div className='p-4'>
                <FormDemanda demanda={selectedDemanda} onSuccess={handleSuccess} />
            </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

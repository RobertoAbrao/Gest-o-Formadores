

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
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2, Loader2, BookOpenCheck, Hourglass, ListTodo, CheckCircle, BadgeCheck, AlertTriangle, Mail } from 'lucide-react';
import type { Demanda, StatusDemanda } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc, query, orderBy, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormDemanda } from '@/components/diario/form-diario';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, isBefore, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';

const statusOptions: StatusDemanda[] = ['Pendente', 'Em andamento', 'Concluída', 'Aguardando retorno'];
const priorityOptions: Demanda['prioridade'][] = ['Normal', 'Urgente'];

const statusConfig: Record<StatusDemanda, { color: string, label: string }> = {
  'Pendente': { color: 'bg-yellow-500', label: 'Pendente' },
  'Em andamento': { color: 'bg-blue-500', label: 'Em Andamento' },
  'Concluída': { color: 'bg-green-500', label: 'Concluída' },
  'Aguardando retorno': { color: 'bg-orange-500', label: 'Aguardando Retorno' },
};

const getRowClass = (demanda: Demanda): string => {
    if (demanda.validado) {
        return 'bg-teal-50 dark:bg-teal-900/40 opacity-80 hover:opacity-100';
    }
    if (demanda.status === 'Concluída') {
      return 'bg-muted/50 text-muted-foreground opacity-70 hover:opacity-100';
    }

    if (!demanda.prazo) {
      return '';
    }
    
    const hoje = startOfToday();
    const prazoDate = demanda.prazo.toDate();
    const limiteAmarelo = addDays(hoje, 3);

    if (isBefore(prazoDate, hoje)) {
      return 'bg-red-100 dark:bg-red-900/40 hover:bg-red-100/80 dark:hover:bg-red-900/50'; // Atrasada
    }
    
    if (isBefore(prazoDate, limiteAmarelo)) {
      return 'bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/50'; // Vence em breve (dentro de 3 dias)
    }
    
    return 'bg-green-100 dark:bg-green-900/40 hover:bg-green-100/80 dark:hover:bg-green-900/50'; // Com prazo (mais de 3 dias)
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
  const [statusFilter, setStatusFilter] = useState<StatusDemanda | 'all'>('all');
  const [responsavelFilter, setResponsavelFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'Normal' | 'Urgente'>('all');
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
    const filtered = demandas.filter(d => {
      const searchMatch = searchTerm === '' ||
        d.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.demanda.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.responsavelNome.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = statusFilter === 'all' || d.status === statusFilter;
      const responsavelMatch = responsavelFilter === 'all' || d.responsavelId === responsavelFilter;
      const priorityMatch = priorityFilter === 'all' || d.prioridade === priorityFilter;
      return searchMatch && statusMatch && responsavelMatch && priorityMatch;
    });

     // Sort by due date (prazo), ascending. Nulls/undefined go last.
    return filtered.sort((a, b) => {
      const aHasPrazo = a.prazo && a.prazo.toMillis();
      const bHasPrazo = b.prazo && b.prazo.toMillis();

      if (aHasPrazo && bHasPrazo) {
        return a.prazo!.toMillis() - b.prazo!.toMillis();
      }
      if (aHasPrazo) return -1; // a has date, b doesn't, so a comes first
      if (bHasPrazo) return 1; // b has date, a doesn't, so b comes first
      return 0; // neither has a date
    });

  }, [demandas, searchTerm, statusFilter, responsavelFilter, priorityFilter]);

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
        <CardContent className="p-4 flex flex-col sm:flex-row flex-wrap items-center gap-4">
          <div className="relative flex-grow w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por município, demanda ou responsável..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
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

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-24'>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Município</TableHead>
              <TableHead>Demanda</TableHead>
              <TableHead className="hidden md:table-cell">Responsável</TableHead>
              <TableHead className="hidden sm:table-cell">Prazo</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && demandas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : filteredDemandas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Nenhuma demanda encontrada.</TableCell>
              </TableRow>
            ) : (
              filteredDemandas.map((demanda) => (
                <TableRow key={demanda.id} onClick={() => openEditDialog(demanda)} className={cn("cursor-pointer", getRowClass(demanda))}>
                  <TableCell>
                    {demanda.validado ? (
                      <Badge variant="outline" className="flex items-center gap-2 border-teal-500 bg-teal-100 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-700 text-teal-800">
                        <BadgeCheck className={`h-3 w-3`} />
                        Validada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${statusConfig[demanda.status]?.color || 'bg-gray-400'}`} />
                        {demanda.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {demanda.prioridade === 'Urgente' ? (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Urgente
                      </Badge>
                    ) : (
                      <Badge variant="outline">Normal</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{demanda.municipio} <span className="text-xs text-muted-foreground">{demanda.uf}</span></TableCell>
                  <TableCell className="max-w-xs truncate" title={demanda.demanda}>{demanda.demanda}</TableCell>
                  <TableCell className="hidden md:table-cell">{demanda.responsavelNome}</TableCell>
                  <TableCell className="hidden sm:table-cell">{demanda.prazo ? demanda.prazo.toDate().toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0">
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
    </div>
  );
}

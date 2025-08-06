
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, DollarSign, Building, Utensils, Car, Book, Grip, Eye, Info } from 'lucide-react';
import type { Despesa, TipoDespesa } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, query, deleteDoc, doc, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormDespesa } from '@/components/despesas/form-despesa';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { DetalhesDespesa } from '@/components/despesas/detalhes-despesa';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const despesaTypes: TipoDespesa[] = ['Alimentação', 'Transporte', 'Hospedagem', 'Material Didático', 'Outros'];

const typeIcons: Record<TipoDespesa, React.ElementType> = {
  'Alimentação': Utensils,
  'Transporte': Car,
  'Hospedagem': Building,
  'Material Didático': Book,
  'Outros': Grip,
};

type GroupedDespesas = {
    [key in TipoDespesa]?: Despesa[];
}

export default function DespesasPage() {
  const { user } = useAuth();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAtivo, setLoadingAtivo] = useState(true);
  const [isFormadorAtivo, setIsFormadorAtivo] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<Despesa | null>(null);
  const { toast } = useToast();

  const checkFormadorAtivo = useCallback(async () => {
    if (!user) return;
    setLoadingAtivo(true);
    try {
      const q = query(
        collection(db, 'formacoes'),
        where('formadoresIds', 'array-contains', user.uid),
        where('status', '==', 'em-formacao'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      setIsFormadorAtivo(!querySnapshot.empty);
    } catch (error) {
        console.error("Error checking active formations:", error);
        setIsFormadorAtivo(false); // Assume not active on error
    } finally {
        setLoadingAtivo(false);
    }
  }, [user]);

  const fetchDespesas = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'despesas'),
        where('formadorId', '==', user.uid),
      );
      const querySnapshot = await getDocs(q);
      const despesasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Despesa));
      despesasData.sort((a, b) => b.data.toMillis() - a.data.toMillis());
      setDespesas(despesasData);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast({ variant: 'destructive', title: 'Erro ao buscar despesas', description: 'Não foi possível carregar a lista de despesas.' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchDespesas();
    checkFormadorAtivo();
  }, [fetchDespesas, checkFormadorAtivo]);

  const groupedDespesas = useMemo(() => {
    return despesas.reduce((acc, despesa) => {
        const type = despesa.tipo;
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type]!.push(despesa);
        return acc;
    }, {} as GroupedDespesas);
  }, [despesas]);

  const handleSuccess = () => {
    fetchDespesas();
    setIsFormDialogOpen(false);
    setSelectedDespesa(null);
  }

  const handleDeleteConfirm = async () => {
    if (!selectedDespesa) return;
    try {
        await deleteDoc(doc(db, "despesas", selectedDespesa.id));
        toast({ title: 'Sucesso!', description: 'Despesa excluída com sucesso.' });
        fetchDespesas();
    } catch (error) {
        console.error("Error deleting expense: ", error);
        toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'Não foi possível excluir a despesa.' });
    } finally {
        setIsDeleteDialogOpen(false);
        setSelectedDespesa(null);
    }
  }
  
  const openDeleteDialog = (despesa: Despesa) => {
    setSelectedDespesa(despesa);
    setIsDeleteDialogOpen(true);
  }

  const openEditDialog = (despesa: Despesa) => {
    setSelectedDespesa(despesa);
    setIsFormDialogOpen(true);
  }
  
  const openDetailDialog = (despesa: Despesa) => {
    setSelectedDespesa(despesa);
    setIsDetailDialogOpen(true);
  }

  const handleDialogChange = (setter: (open: boolean) => void) => (open: boolean) => {
      setter(open);
      if (!open) {
          setSelectedDespesa(null);
      }
  }


  if (loading || loadingAtivo) {
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
                <h1 className="text-3xl font-bold tracking-tight font-headline">Relatório de Despesas</h1>
                <p className="text-muted-foreground">
                    Adicione e gerencie seus gastos com as formações.
                </p>
            </div>
            <Dialog open={isFormDialogOpen} onOpenChange={handleDialogChange(setIsFormDialogOpen)}>
                <DialogTrigger asChild>
                    <Button disabled={!isFormadorAtivo}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Despesa
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{selectedDespesa ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
                        <DialogDescription>
                            Preencha os campos abaixo para adicionar ou editar uma despesa.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className='max-h-[80vh]'>
                        <div className='p-4'>
                            <FormDespesa despesa={selectedDespesa} onSuccess={handleSuccess} />
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
        
        {!isFormadorAtivo && (
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Registro de despesas desabilitado</AlertTitle>
                <AlertDescription>
                    Você só pode adicionar novas despesas quando estiver participando ativamente de uma formação.
                </AlertDescription>
            </Alert>
        )}

        {despesas.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
                <DollarSign className="w-12 h-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Nenhuma despesa registrada</h3>
                <p className="text-sm text-muted-foreground">Comece adicionando uma nova despesa quando estiver ativo em uma formação.</p>
            </div>
        ) : (
            <Accordion type="multiple" defaultValue={despesaTypes} className="w-full">
                {despesaTypes.map(type => {
                    const despesasDoTipo = groupedDespesas[type] || [];
                    if (despesasDoTipo.length === 0) return null;
                    const Icon = typeIcons[type];
                    const total = despesasDoTipo.reduce((sum, item) => sum + item.valor, 0);

                    return (
                        <AccordionItem value={type} key={type}>
                            <AccordionTrigger>
                                <div className="flex items-center gap-3">
                                    <Icon className="h-5 w-5 text-primary"/>
                                    <span className='text-lg font-semibold'>{type}</span>
                                    <Badge variant="outline">{despesasDoTipo.length} {despesasDoTipo.length === 1 ? 'registro' : 'registros'}</Badge>
                                </div>
                                <span className="text-lg font-semibold text-primary">{formatCurrency(total)}</span>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Data</TableHead>
                                                <TableHead className="hidden lg:table-cell">Descrição</TableHead>
                                                <TableHead>Valor</TableHead>
                                                <TableHead className="w-[100px] text-right">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {despesasDoTipo.map(despesa => (
                                                 <TableRow key={despesa.id} className="cursor-pointer" onClick={() => openDetailDialog(despesa)}>
                                                    <TableCell className="font-medium">{despesa.data.toDate().toLocaleDateString('pt-BR')}</TableCell>
                                                    <TableCell className="hidden lg:table-cell text-muted-foreground">{despesa.descricao}</TableCell>
                                                    <TableCell className="font-medium">{formatCurrency(despesa.valor)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetailDialog(despesa); }}>
                                                                <Eye className="mr-2 h-4 w-4" /> Detalhes
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(despesa); }}>
                                                                <Pencil className="mr-2 h-4 w-4" /> Editar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={(e) => { e.stopPropagation(); openDeleteDialog(despesa); }}>
                                                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                                            </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        )}
      
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={handleDialogChange(setIsDeleteDialogOpen)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente o registro de despesa.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
                        Sim, excluir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isDetailDialogOpen} onOpenChange={handleDialogChange(setIsDetailDialogOpen)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Detalhes da Despesa</DialogTitle>
                    <DialogDescription>
                        Visualize as informações completas da despesa.
                    </DialogDescription>
                </DialogHeader>
                {selectedDespesa && <DetalhesDespesa despesa={selectedDespesa} />}
            </DialogContent>
        </Dialog>

    </div>
  );
}

  
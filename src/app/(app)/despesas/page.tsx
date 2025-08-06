
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, DollarSign } from 'lucide-react';
import type { Despesa } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, orderBy, query, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormDespesa } from '@/components/despesas/form-despesa';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function DespesasPage() {
  const { user } = useAuth();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<Despesa | null>(null);
  const { toast } = useToast();

  const fetchDespesas = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'despesas'),
        where('formadorId', '==', user.uid),
        orderBy('data', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const despesasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Despesa));
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
  }, [fetchDespesas]);

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

  if (loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6 h-full">
        <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
            setIsFormDialogOpen(open);
            if (!open) setSelectedDespesa(null);
        }}>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Relatório de Despesas</h1>
                    <p className="text-muted-foreground">
                        Adicione e gerencie seus gastos com as formações.
                    </p>
                </div>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Despesa
                    </Button>
                </DialogTrigger>
            </div>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{selectedDespesa ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
                </DialogHeader>
                <ScrollArea className='max-h-[80vh]'>
                    <div className='p-4'>
                        <FormDespesa despesa={selectedDespesa} onSuccess={handleSuccess} />
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden lg:table-cell">Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {despesas.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Nenhuma despesa registrada.
                    </TableCell>
                </TableRow>
            ) : despesas.map((despesa) => (
                <TableRow key={despesa.id}>
                  <TableCell className="font-medium">{despesa.data.toDate().toLocaleDateString()}</TableCell>
                  <TableCell>{despesa.tipo}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{despesa.descricao}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(despesa.valor)}</TableCell>
                  <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(despesa)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => openDeleteDialog(despesa)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>

       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente o registro de despesa.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setSelectedDespesa(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
                        Sim, excluir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

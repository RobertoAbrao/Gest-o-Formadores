
'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
} from 'firebase/firestore';
import {
  MoreHorizontal,
  PlusCircle,
  Loader2,
  Trash2,
  Paperclip,
  Pencil,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Formacao, FormadorStatus } from '@/lib/types';
import { FormFormacao } from '@/components/formacoes/form-formacao';
import { DetalhesFormacao } from '@/components/formacoes/detalhes-formacao';

type Columns = {
  [key in FormadorStatus]: {
    title: string;
    formacoes: Formacao[];
  };
};

const columnTitles: { [key in FormadorStatus]: string } = {
  preparacao: 'Preparação',
  'em-formacao': 'Em Formação',
  'pos-formacao': 'Pós Formação',
  concluido: 'Concluído',
};

const initialColumns: Columns = {
  preparacao: { title: 'Preparação', formacoes: [] },
  'em-formacao': { title: 'Em Formação', formacoes: [] },
  'pos-formacao': { title: 'Pós Formação', formacoes: [] },
  concluido: { title: 'Concluído', formacoes: [] },
};

export default function QuadroPage() {
  const [columns, setColumns] = useState<Columns>(initialColumns);
  const [loading, setLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedFormacao, setSelectedFormacao] = useState<Formacao | null>(
    null
  );
  const { toast } = useToast();

  const fetchAndCategorizeFormacoes = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'formacoes'));
      const querySnapshot = await getDocs(q);
      const formacoesData = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Formacao)
      );

      const newColumns: Columns = {
        preparacao: { title: 'Preparação', formacoes: [] },
        'em-formacao': { title: 'Em Formação', formacoes: [] },
        'pos-formacao': { title: 'Pós Formação', formacoes: [] },
        concluido: { title: 'Concluído', formacoes: [] },
      };


      formacoesData.forEach((formacao) => {
        const status = formacao.status || 'preparacao';
        if (newColumns[status]) {
          newColumns[status].formacoes.push(formacao);
        } else {
          newColumns['preparacao'].formacoes.push(formacao);
        }
      });
      setColumns(newColumns);
    } catch (error) {
      console.error('Error fetching formacoes:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar formações',
        description: 'Não foi possível carregar o quadro.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAndCategorizeFormacoes();
  }, [fetchAndCategorizeFormacoes]);

  const handleSuccess = () => {
    fetchAndCategorizeFormacoes();
    setIsFormDialogOpen(false);
    setSelectedFormacao(null);
  };
  
  const openDeleteDialog = (formacao: Formacao) => {
    setSelectedFormacao(formacao);
    setIsDeleteDialogOpen(true);
  };

  const openEditDialog = (formacao: Formacao) => {
    setSelectedFormacao(formacao);
    setIsFormDialogOpen(true);
  }
  
  const openDetailDialog = (formacao: Formacao) => {
    setSelectedFormacao(formacao);
    setIsDetailDialogOpen(true);
  }

  const handleDeleteConfirm = async () => {
    if (!selectedFormacao) return;
    try {
      await deleteDoc(doc(db, 'formacoes', selectedFormacao.id));
      toast({
        title: 'Sucesso!',
        description: 'Formação excluída com sucesso.',
      });
      fetchAndCategorizeFormacoes();
    } catch (error) {
      console.error('Error deleting formacao: ', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a formação.',
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setSelectedFormacao(null);
    }
  };

  const handleDetailDialogChange = (open: boolean) => {
    setIsDetailDialogOpen(open);
    if (!open) {
      setSelectedFormacao(null);
      // Refetch data when closing the dialog to see status changes
      fetchAndCategorizeFormacoes();
    }
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
        <Dialog
          open={isFormDialogOpen}
          onOpenChange={(open) => {
            setIsFormDialogOpen(open);
            if (!open) setSelectedFormacao(null);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-headline">
                Acompanhamento de Formações
              </h1>
              <p className="text-muted-foreground">
                Crie e gerencie o progresso de cada formação.
              </p>
            </div>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar uma Formação
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedFormacao ? 'Editar Formação' : 'Nova Formação'}</DialogTitle>
              <DialogDescription>
                {selectedFormacao ? 'Altere os dados da formação.' : 'Preencha os dados para criar uma nova formação.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh]">
              <div className="p-4">
                <FormFormacao formacao={selectedFormacao} onSuccess={handleSuccess} />
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
        
        <Dialog open={isDetailDialogOpen} onOpenChange={handleDetailDialogChange}>
            <DialogContent className="sm:max-w-2xl">
                {selectedFormacao && (
                  <>
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{selectedFormacao.titulo}</DialogTitle>
                        <DialogDescription>{selectedFormacao.descricao}</DialogDescription>
                    </DialogHeader>
                    <DetalhesFormacao formacaoId={selectedFormacao.id} />
                  </>
                )}
            </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {Object.entries(columns).map(([columnId, column]) => (
            <div key={columnId}>
              <Card className="bg-muted/50">
                <CardHeader className="p-4 border-b">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{column.title}</span>
                    <span className="text-sm font-normal text-muted-foreground bg-background h-6 w-6 flex items-center justify-center rounded-full">
                      {column.formacoes.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 min-h-[100px]">
                  {column.formacoes.map((formacao) => (
                    <Card
                      key={formacao.id}
                      className="bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => openDetailDialog(formacao)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-base">
                            {formacao.titulo}
                          </h3>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                className="h-7 w-7 p-0"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {e.stopPropagation(); openEditDialog(formacao)}}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={(e) => {e.stopPropagation(); openDeleteDialog(formacao)}}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {formacao.descricao}
                        </p>
                         {formacao.materiaisIds && formacao.materiaisIds.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                                <Paperclip className="h-4 w-4" />
                                <span>{formacao.materiaisIds.length} {formacao.materiaisIds.length === 1 ? 'material' : 'materiais'}</span>
                            </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá
                permanentemente a formação dos nossos servidores.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedFormacao(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive hover:bg-destructive/90"
              >
                Sim, excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
}

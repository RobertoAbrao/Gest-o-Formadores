
'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  MoreHorizontal,
  PlusCircle,
  Loader2,
  Trash2,
  Paperclip,
  Pencil,
  Printer,
  Eye,
  Hash,
  Users,
  ClipboardCheck,
  Flag,
  Target,
  ClipboardList,
  Archive,
  CheckCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { isAfter, isBefore, isWithinInterval, startOfToday } from 'date-fns';

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
  CardDescription,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Formacao, FormadorStatus, ProjetoImplatancao } from '@/lib/types';
import { FormFormacao } from '@/components/formacoes/form-formacao';
import { DetalhesFormacao } from '@/components/formacoes/detalhes-formacao';
import { Badge } from '@/components/ui/badge';

type QuadroItem = (Formacao & { itemType: 'formacao' }) | {
    id: string;
    itemType: 'projeto';
    titulo: string;
    descricao: string;
    dataInicio: Timestamp | null;
    dataFim: Timestamp | null;
    status: FormadorStatus; 
    codigo: string;
    projetoId: string;
};


type Columns = {
  [key in FormadorStatus]: {
    title: string;
    items: QuadroItem[];
  };
};

const columnTitles: { [key in FormadorStatus]: string } = {
  preparacao: 'Preparação',
  'em-formacao': 'Em Formação',
  'pos-formacao': 'Pós Formação',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

const initialColumns: Columns = {
  preparacao: { title: 'Preparação', items: [] },
  'em-formacao': { title: 'Em Formação', items: [] },
  'pos-formacao': { title: 'Pós Formação', items: [] },
  concluido: { title: 'Concluído', items: [] },
  arquivado: { title: 'Arquivado', items: [] },
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

  const fetchAndCategorizeItems = useCallback(async () => {
    setLoading(true);
    try {
      const formacoesQuery = query(collection(db, 'formacoes'), where('status', '!=', 'arquivado'));
      const projetosQuery = query(collection(db, 'projetos'));
      
      const [formacoesSnapshot, projetosSnapshot] = await Promise.all([
        getDocs(formacoesQuery),
        getDocs(projetosQuery),
      ]);

      const formacoesData = formacoesSnapshot.docs.map(
        (doc) => ({ itemType: 'formacao', id: doc.id, ...doc.data() } as Formacao & { itemType: 'formacao' })
      );
      
      const projetosData = projetosSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as ProjetoImplatancao)
      );
      
      const projectActivities: QuadroItem[] = [];
      projetosData.forEach(proj => {
          Object.entries(proj.devolutivas || {}).forEach(([key, devolutiva]) => {
              const isD4 = key === 'd4';
              const devolutivaD4 = devolutiva as any;

              if (isD4 && devolutivaD4.data) {
                 projectActivities.push({
                      id: `${proj.id}-d-${key}`,
                      itemType: 'projeto',
                      titulo: `Devolutiva ${key.replace('d','')}: ${proj.municipio}`,
                      descricao: devolutiva.detalhes || `Devolutiva com ${devolutiva.formador || 'formador não definido'}`,
                      dataInicio: devolutivaD4.data,
                      dataFim: devolutivaD4.data,
                      status: 'preparacao',
                      codigo: proj.id.substring(0, 6),
                      projetoId: proj.id,
                  });
              } else if (!isD4 && devolutiva.dataInicio && devolutiva.dataFim) {
                  projectActivities.push({
                      id: `${proj.id}-d-${key}`,
                      itemType: 'projeto',
                      titulo: `Devolutiva ${key.replace('d','')}: ${proj.municipio}`,
                      descricao: devolutiva.detalhes || `Devolutiva com ${devolutiva.formador || 'formador não definido'}`,
                      dataInicio: devolutiva.dataInicio,
                      dataFim: devolutiva.dataFim,
                      status: 'preparacao',
                      codigo: proj.id.substring(0, 6),
                      projetoId: proj.id,
                  });
              }
          });
      });

      const allItems: QuadroItem[] = [...formacoesData, ...projectActivities];

      const newColumns: Columns = {
        preparacao: { title: 'Preparação', items: [] },
        'em-formacao': { title: 'Em Formação', items: [] },
        'pos-formacao': { title: 'Pós Formação', items: [] },
        concluido: { title: 'Concluído', items: [] },
        arquivado: { title: 'Arquivado', items: [] },
      };

      const today = startOfToday();

      allItems.forEach((item) => {
        let status: FormadorStatus = item.status;
        
        // Dynamic status for formations not manually set to 'concluido'
        if (item.itemType === 'formacao' && item.status !== 'concluido') {
             if (item.dataInicio && isAfter(item.dataInicio.toDate(), today)) {
                 status = 'preparacao';
             } else if (item.dataInicio && item.dataFim && isWithinInterval(today, { start: item.dataInicio.toDate(), end: item.dataFim.toDate() })) {
                 status = 'em-formacao';
             } else if (item.dataFim && isBefore(item.dataFim.toDate(), today)) {
                 status = 'pos-formacao';
             }
        }
        
        // Dynamic status for all project items
        if (item.itemType === 'projeto') {
             if (item.dataInicio && isAfter(item.dataInicio.toDate(), today)) {
                 status = 'preparacao';
             } else if (item.dataInicio && item.dataFim && isWithinInterval(today, { start: item.dataInicio.toDate(), end: item.dataFim.toDate() })) {
                 status = 'em-formacao';
             } else if (item.dataFim && isBefore(item.dataFim.toDate(), today)) {
                 status = 'pos-formacao';
             }
        }

        if (newColumns[status] && status !== 'arquivado') {
          newColumns[status].items.push(item);
        }
      });
      setColumns(newColumns);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar itens',
        description: 'Não foi possível carregar o quadro.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAndCategorizeItems();
  }, [fetchAndCategorizeItems]);

  const handleSuccess = () => {
    fetchAndCategorizeItems();
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
      fetchAndCategorizeItems();
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

  const handleStatusChange = async (formacaoId: string, newStatus: FormadorStatus) => {
    try {
      const formacaoRef = doc(db, 'formacoes', formacaoId);
      await updateDoc(formacaoRef, { status: newStatus });
      toast({ title: "Sucesso", description: `Status da formação alterado.` });
      fetchAndCategorizeItems();
    } catch (error) {
       console.error("Erro ao alterar status:", error);
       toast({ variant: "destructive", title: "Erro", description: "Não foi possível alterar o status." });
    }
  };

  const handleDetailDialogChange = (open: boolean) => {
    setIsDetailDialogOpen(open);
    if (!open) {
      setSelectedFormacao(null);
      fetchAndCategorizeItems();
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getIconForItemType = (item: QuadroItem) => {
      if (item.itemType === 'formacao') return <ClipboardCheck className="h-4 w-4" />;
      if (item.titulo.toLowerCase().includes('devolutiva')) return <Flag className="h-4 w-4 text-green-600" />;
      return <ClipboardList className="h-4 w-4" />;
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
                Acompanhamento de Atividades
              </h1>
              <p className="text-muted-foreground">
                Crie formações e acompanhe o progresso de projetos.
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
                        <DialogDescription asChild>
                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                <Hash className="h-4 w-4" /> {selectedFormacao.codigo}
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DetalhesFormacao 
                        formacaoId={selectedFormacao.id} 
                        onClose={() => handleDetailDialogChange(false)} 
                    />
                  </>
                )}
            </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {Object.entries(columns).filter(([columnId]) => columnId !== 'arquivado').map(([columnId, column]) => (
            <div key={columnId}>
              <Card className="bg-muted/50">
                <CardHeader className="p-4 border-b">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{column.title}</span>
                    <span className="text-sm font-normal text-muted-foreground bg-background h-6 w-6 flex items-center justify-center rounded-full">
                      {column.items.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 min-h-[100px]">
                  {column.items.map((item) => (
                    <Card
                      key={item.id}
                      className="bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => item.itemType === 'formacao' && openDetailDialog(item)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-base flex items-center gap-2">
                             {getIconForItemType(item)}
                            {item.titulo}
                          </h3>
                          {item.itemType === 'formacao' && (
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
                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); openDetailDialog(item)}}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); openEditDialog(item)}}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/relatorio/${item.id}`} onClick={(e) => e.stopPropagation()} target="_blank" className="flex items-center w-full">
                                    <Printer className="mr-2 h-4 w-4" />
                                    Ver Relatório
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/avaliacao/${item.id}`} onClick={(e) => e.stopPropagation()} target="_blank" className="flex items-center w-full">
                                    <ClipboardCheck className="mr-2 h-4 w-4" />
                                    Formulário de Avaliação
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {item.status === 'pos-formacao' && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'concluido')}}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Marcar como Concluído
                                  </DropdownMenuItem>
                                )}
                                {item.status === 'concluido' && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'arquivado')}}>
                                    <Archive className="mr-2 h-4 w-4" />
                                    Arquivar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={(e) => {e.stopPropagation(); openDeleteDialog(item)}}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.descricao}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                            <div className="flex items-center gap-4">
                               {item.itemType === 'formacao' && item.materiaisIds && item.materiaisIds.length > 0 && (
                                    <div className="flex items-center gap-1">
                                        <Paperclip className="h-4 w-4" />
                                        <span>{item.materiaisIds.length}</span>
                                    </div>
                                )}
                                {item.itemType === 'formacao' && item.participantes && item.participantes > 0 && (
                                     <div className="flex items-center gap-1">
                                        <Users className="h-4 w-4" />
                                        <span>{item.participantes}</span>
                                    </div>
                                )}
                                {item.itemType === 'projeto' && (
                                    <Link href={`/projetos#${item.projetoId}`} className='hover:underline flex items-center gap-1'>
                                        <ClipboardList className='h-4 w-4' /> Ver Projeto
                                    </Link>
                                )}
                            </div>
                            <Badge variant="outline" className="font-mono">
                                <Hash className="h-3 w-3 mr-1" />
                                {item.codigo}
                            </Badge>
                        </div>
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

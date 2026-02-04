
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
  FileSignature,
  QrCode,
  FolderOpen,
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
import type { Formacao, FormadorStatus } from '@/lib/types';
import { FormFormacao } from '@/components/formacoes/form-formacao';
import { DetalhesFormacao } from '@/components/formacoes/detalhes-formacao';
import { Badge } from '@/components/ui/badge';
import { GeradorQRCode } from '@/components/qrcode/GeradorQRCode';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { changeFormacaoStatus } from '@/lib/formacao-actions';


type Columns = {
  [key in FormadorStatus]: {
    title: string;
    items: Formacao[];
    colorClass: string;
  };
};

const columnConfig: { [key in FormadorStatus]: { title: string, colorClass: string } } = {
  preparacao: { title: 'Preparação', colorClass: 'bg-green-500 border-green-500' },
  'em-formacao': { title: 'Em Formação', colorClass: 'bg-blue-500 border-blue-500' },
  'pos-formacao': { title: 'Pós Formação', colorClass: 'bg-yellow-500 border-yellow-500' },
  concluido: { title: 'Concluído', colorClass: 'bg-purple-500 border-purple-500' },
  arquivado: { title: 'Arquivado', colorClass: 'bg-gray-500 border-gray-500' },
};


const initialColumns: Columns = {
  preparacao: { ...columnConfig.preparacao, items: [] },
  'em-formacao': { ...columnConfig['em-formacao'], items: [] },
  'pos-formacao': { ...columnConfig['pos-formacao'], items: [] },
  concluido: { ...columnConfig.concluido, items: [] },
  arquivado: { ...columnConfig.arquivado, items: [] },
};

export default function QuadroPage() {
  const [columns, setColumns] = useState<Columns>(initialColumns);
  const [loading, setLoading] = useState(true);
  const [loadingStatusChange, setLoadingStatusChange] = useState<string | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isQRCodeDialogOpen, setIsQRCodeDialogOpen] = useState(false);
  const [selectedFormacao, setSelectedFormacao] = useState<Formacao | null>(
    null
  );
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchAndCategorizeItems = useCallback(async () => {
    setLoading(true);
    try {
      const formacoesQuery = query(collection(db, 'formacoes'), where('status', '!=', 'arquivado'));
      const formacoesSnapshot = await getDocs(formacoesQuery);

      const formacoesData = formacoesSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Formacao)
      );

      const newColumns: Columns = {
        preparacao: { ...columnConfig.preparacao, items: [] },
        'em-formacao': { ...columnConfig['em-formacao'], items: [] },
        'pos-formacao': { ...columnConfig['pos-formacao'], items: [] },
        concluido: { ...columnConfig.concluido, items: [] },
        arquivado: { ...columnConfig.arquivado, items: [] },
      };

      const today = startOfToday();

      formacoesData.forEach((item) => {
        let status: FormadorStatus = item.status;
        
        if (item.status !== 'concluido' && item.status !== 'arquivado') {
             if (item.dataInicio && isAfter(item.dataInicio.toDate(), today)) {
                 status = 'preparacao';
             } else if (item.dataInicio && item.dataFim && isWithinInterval(today, { start: item.dataInicio.toDate(), end: item.dataFim.toDate() })) {
                 status = 'em-formacao';
             } else if (item.dataFim && isBefore(item.dataFim.toDate(), today)) {
                 status = 'pos-formacao';
             }
        }

        if (newColumns[status]) {
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

  const openQRCodeDialog = (formacao: Formacao) => {
    setSelectedFormacao(formacao);
    setIsQRCodeDialogOpen(true);
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

  const handleStatusChange = async (formacao: Formacao, newStatus: FormadorStatus) => {
    setLoadingStatusChange(formacao.id);
    try {
      await changeFormacaoStatus(formacao, newStatus, user);
      toast({ title: "Sucesso", description: `Status alterado e ações automáticas criadas.` });
      fetchAndCategorizeItems();
    } catch (error: any) {
       console.error("Erro ao alterar status:", error);
       toast({ variant: "destructive", title: "Erro", description: error.message || "Não foi possível alterar o status." });
    } finally {
      setLoadingStatusChange(null);
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

  const getIconForItem = (item: Formacao) => {
      if (item.titulo.toLowerCase().includes('devolutiva')) return <Flag className="h-4 w-4 text-green-600" />;
      return <ClipboardCheck className="h-4 w-4" />;
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
                Crie e gerencie formações e devolutivas.
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
                        <DialogTitle className="text-2xl">
                          {selectedFormacao.titulo.startsWith('Devolutiva') && !selectedFormacao.titulo.includes(':') && selectedFormacao.municipio
                              ? `${selectedFormacao.titulo}: ${selectedFormacao.municipio}`
                              : selectedFormacao.titulo}
                        </DialogTitle>
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
        
        <Dialog open={isQRCodeDialogOpen} onOpenChange={(open) => {
          setIsQRCodeDialogOpen(open);
          if (!open) setSelectedFormacao(null);
        }}>
          <DialogContent>
             <DialogHeader>
              <DialogTitle>QR Code para Avaliação</DialogTitle>
              <DialogDescription>
                Use este QR Code para que os participantes acessem o formulário de avaliação.
              </DialogDescription>
            </DialogHeader>
            {selectedFormacao && (
              <GeradorQRCode
                url={`${window.location.origin}/avaliacao/${selectedFormacao.id}`}
                title={selectedFormacao.titulo}
              />
            )}
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {Object.entries(columns).filter(([columnId]) => columnId !== 'arquivado').map(([columnId, column]) => (
            <div key={columnId} className="bg-muted/40 rounded-lg h-full">
              <div className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{column.title}</h2>
                      <span className={cn('h-5 w-5 rounded-full text-xs text-white flex items-center justify-center font-bold', column.colorClass)}>
                        {column.items.length}
                      </span>
                  </div>
                <div className="space-y-4">
                  {column.items.length > 0 ? (
                    column.items.map((item) => (
                      <Card
                        key={item.id}
                        className={cn('bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4', column.colorClass.replace('bg-', 'border-'))}
                        onClick={() => openDetailDialog(item)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                              {getIconForItem(item)}
                              {item.titulo.startsWith('Devolutiva') && !item.titulo.includes(':') && item.municipio ? `${item.titulo}: ${item.municipio}` : item.titulo}
                            </h3>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    className="h-7 w-7 p-0 -mr-2 -mt-1"
                                >
                                    {loadingStatusChange === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
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
                                    <Link href={`/ficha/${item.id}`} onClick={(e) => e.stopPropagation()} target="_blank" className="flex items-center w-full">
                                        <FileSignature className="mr-2 h-4 w-4" />
                                        Gerar Ficha
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href={`/avaliacao/${item.id}`} onClick={(e) => e.stopPropagation()} target="_blank" className="flex items-center w-full">
                                    <ClipboardCheck className="mr-2 h-4 w-4" />
                                    Formulário de Avaliação
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openQRCodeDialog(item); }}>
                                  <QrCode className="mr-2 h-4 w-4" />
                                  Gerar QR Code
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {item.status === 'pos-formacao' && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(item, 'concluido')}}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Marcar como Concluído
                                  </DropdownMenuItem>
                                )}
                                {item.status === 'concluido' && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(item, 'arquivado')}}>
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
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.descricao}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                              <div className="flex items-center gap-3">
                                 {item.materiaisIds && item.materiaisIds.length > 0 && (
                                      <div className="flex items-center gap-1">
                                          <Paperclip className="h-3 w-3" />
                                          <span>{item.materiaisIds.length}</span>
                                      </div>
                                  )}
                                  {item.participantes && item.participantes > 0 && (
                                       <div className="flex items-center gap-1">
                                          <Users className="h-3 w-3" />
                                          <span>{item.participantes}</span>
                                      </div>
                                  )}
                              </div>
                              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0.5">
                                  <Hash className="h-2.5 w-2.5 mr-0.5" />
                                  {item.codigo}
                              </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                      <FolderOpen className="h-10 w-10 mb-2" />
                      <p className="text-sm">Nenhuma atividade aqui</p>
                    </div>
                  )}
                </div>
              </div>
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

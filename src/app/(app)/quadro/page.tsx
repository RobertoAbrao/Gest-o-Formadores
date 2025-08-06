
'use client';

import { useEffect, useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { PlusCircle, User, Tag, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Formacao } from '@/lib/types';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { FormFormacao } from '@/components/formacoes/form-formacao';
import { ScrollArea } from '@/components/ui/scroll-area';

type ColumnData = {
  title: string;
  items: Formacao[]; // Changed from Formador to Formacao
};

type Columns = {
  [key: string]: ColumnData;
};

// The board will now manage Formacao objects, and starts empty.
const initialColumns: Columns = {
  'preparacao': {
    title: 'Preparação',
    items: [],
  },
  'em-formacao': {
    title: 'Em Formação',
    items: [],
  },
  'pos-formacao': {
    title: 'Pós Formação',
    items: [],
  },
  'concluido': {
    title: 'Concluído',
    items: [],
  },
};


export default function QuadroPage() {
  const [columns, setColumns] = useState<Columns>(initialColumns);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false); // Kept for future async operations
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // No longer fetching data on load. The board starts empty.
  useEffect(() => {
    // This ensures the component is only rendered on the client, preventing hydration errors with dnd.
    setIsClient(true);
    setLoading(false); // Set loading to false as we are not fetching data anymore.
  }, []);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;
    
    if (sourceColumnId === destColumnId && source.index === destination.index) {
        return;
    }
    
    // This logic now needs to be adapted for Formacao objects when they are added.
    // For now, it will work with any items moved between columns.
    const sourceColumn = columns[sourceColumnId];
    const destColumn = columns[destColumnId];
    const sourceItems = [...sourceColumn.items];
    const destItems = (sourceColumnId === destColumnId) ? sourceItems : [...destColumn.items];
    const [movedItem] = sourceItems.splice(source.index, 1);
    destItems.splice(destination.index, 0, movedItem);

    const newColumnsState = {
        ...columns,
        [sourceColumnId]: {
            ...sourceColumn,
            items: sourceItems,
        },
        [destColumnId]: {
            ...destColumn,
            items: destItems,
        },
    };
    setColumns(newColumnsState);

    // TODO: Persist change to Firestore for the Formacao object
    try {
      // const formacaoRef = doc(db, 'formacoes', draggableId);
      // await updateDoc(formacaoRef, { status: destColumnId });
      toast({ title: 'Status Atualizado (Localmente)', description: `O status de "${movedItem.titulo}" foi atualizado.`});
    } catch (error) {
      console.error("Error updating status:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar a alteração.'});
      // Revert UI change on error
      // In a real scenario, you'd fetch the original state again.
    }
  };

  const handleSuccess = () => {
    setIsDialogOpen(false);
    // TODO: Re-fetch formations or update state as needed.
    // For now, we just close the dialog.
    toast({ title: "Formulário Fechado", description: "A lógica para adicionar a nova formação ao quadro será implementada."})
  }
  
  if (loading || !isClient) {
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
                <h1 className="text-3xl font-bold tracking-tight font-headline">Acompanhamento de Formações</h1>
                <p className="text-muted-foreground">Crie e gerencie o progresso de cada formação.</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Criar uma Formação
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Formação</DialogTitle>
                  <DialogDescription>
                    Preencha os dados para criar uma nova formação.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className='max-h-[80vh]'>
                    <div className='p-4'>
                        <FormFormacao onSuccess={handleSuccess} />
                    </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
        </div>
        
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                {Object.entries(columns).map(([columnId, column]) => (
                    <Droppable key={columnId} droppableId={columnId}>
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex flex-col gap-4 p-4 rounded-lg h-full bg-muted/50 ${snapshot.isDraggingOver ? 'bg-primary/10' : ''}`}
                            >
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-semibold font-headline">{column.title} <span className='text-sm font-light text-muted-foreground'>({column.items.length})</span></h2>
                                </div>
                                <div className="flex flex-col gap-4 min-h-[200px]">
                                    {column.items.map((formacao, index) => (
                                        <Draggable key={formacao.id} draggableId={formacao.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`shadow-md hover:shadow-lg transition-shadow rounded-lg ${snapshot.isDragging ? 'ring-2 ring-primary' : ''}`}
                                                >
                                                    <Card>
                                                        <CardContent className="p-4 space-y-3">
                                                            <p className="text-sm font-semibold flex items-center gap-2">
                                                                {/* This will be the Formacao title */}
                                                                {formacao.titulo}
                                                            </p>
                                                             <p className="text-xs text-muted-foreground">
                                                                {/* This will be the Formacao description */}
                                                                {formacao.descricao}
                                                            </p>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                    {column.items.length === 0 && provided.placeholder && (
                                        <div className="text-center text-sm text-muted-foreground py-4">
                                            Arraste itens para esta coluna.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </Droppable>
                ))}
            </div>
        </DragDropContext>
    </div>
  );
}

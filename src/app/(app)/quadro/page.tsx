
'use client';

import { useEffect, useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { User, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Formador } from '@/lib/types';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

type ColumnData = {
  title: string;
  items: Formador[];
};

type Columns = {
  [key: string]: ColumnData;
};

const initialColumns: Columns = {
  'nao-iniciado': {
    title: 'Não Iniciado',
    items: [],
  },
  'em-formacao': {
    title: 'Em Formação',
    items: [],
  },
  'ativo': {
    title: 'Ativo',
    items: [],
  },
  'inativo': {
    title: 'Inativo',
    items: [],
  },
};


export default function QuadroPage() {
  const [columns, setColumns] = useState<Columns>(initialColumns);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  const fetchAndCategorizeFormadores = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'formadores'));
      const formadoresData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
      
      const newColumns = JSON.parse(JSON.stringify(initialColumns));

      formadoresData.forEach(formador => {
        const status = formador.status || 'ativo'; // Default to 'ativo' if status is not set
        if (newColumns[status]) {
          newColumns[status].items.push(formador);
        } else {
            // If formador has an unknown status, add them to a default column
            newColumns['ativo'].items.push(formador);
        }
      });

      setColumns(newColumns);

    } catch (error) {
      console.error("Error fetching formadores:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os formadores.'});
    }
  }, [toast]);

  useEffect(() => {
    fetchAndCategorizeFormadores();
    setIsClient(true);
  }, [fetchAndCategorizeFormadores]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;
    
    // Optimistic UI Update
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

    // Update Firestore
    try {
      const formadorRef = doc(db, 'formadores', draggableId);
      await updateDoc(formadorRef, { status: destColumnId });
      toast({ title: 'Sucesso!', description: `Status de ${movedItem.nomeCompleto} atualizado para "${columns[destColumnId].title}".`});
    } catch (error) {
      console.error("Error updating formador status:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o status do formador.'});
      // Revert UI change on error
      fetchAndCategorizeFormadores();
    }
  };
  

  return (
    <div className="flex flex-col gap-8 py-6 h-full">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Acompanhamento de Formadores</h1>
            <p className="text-muted-foreground">Visualize e gerencie o progresso de cada formador.</p>
        </div>
        {isClient ? (
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
                                        {column.items.map((formador, index) => (
                                            <Draggable key={formador.id} draggableId={formador.id} index={index}>
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
                                                                    <User className='h-4 w-4 text-primary'/>
                                                                    {formador.nomeCompleto}
                                                                </p>
                                                                <div className='flex flex-wrap gap-1'>
                                                                    {formador.municipiosResponsaveis.slice(0, 3).map(m => (
                                                                        <Badge key={m} variant="secondary" className='text-xs'>
                                                                            <Tag className='h-3 w-3 mr-1'/>
                                                                            {m}
                                                                        </Badge>
                                                                    ))}
                                                                    {formador.municipiosResponsaveis.length > 3 && (
                                                                        <Badge variant="outline">...</Badge>
                                                                    )}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                </div>
                            )}
                        </Droppable>
                    ))}
                </div>
            </DragDropContext>
        ) : null}
    </div>
  );
}

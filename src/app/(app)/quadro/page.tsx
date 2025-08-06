
'use client';

import { useEffect, useState, useCallback } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Formacao } from '@/lib/types';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { FormFormacao } from '@/components/formacoes/form-formacao';
import { ScrollArea } from '@/components/ui/scroll-area';

type ColumnData = {
  title: string;
  items: Formacao[];
};

type Columns = {
  [key: string]: ColumnData;
};

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
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchAndCategorizeFormacoes = useCallback(async () => {
    setLoading(true);
    try {
        const querySnapshot = await getDocs(query(collection(db, 'formacoes'), orderBy('titulo')));
        const formacoesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formacao));
        
        const newColumns = { ...initialColumns };
        Object.keys(newColumns).forEach(key => {
            newColumns[key] = { ...newColumns[key], items: [] };
        });

        formacoesData.forEach(formacao => {
            const status = formacao.status || 'preparacao';
            if (newColumns[status]) {
                newColumns[status].items.push(formacao);
            } else {
                newColumns['preparacao'].items.push(formacao);
            }
        });
        
        setColumns(newColumns);
    } catch (error) {
        console.error("Error fetching formations:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as formações.' });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAndCategorizeFormacoes();
  }, [fetchAndCategorizeFormacoes]);


  const handleSuccess = () => {
    setIsDialogOpen(false);
    fetchAndCategorizeFormacoes();
  }
  
  if (loading) {
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {Object.entries(columns).map(([columnId, column]) => (
                <div
                    key={columnId}
                    className="flex flex-col gap-4 p-4 rounded-lg h-full bg-muted/50"
                >
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold font-headline">{column.title} <span className='text-sm font-light text-muted-foreground'>({column.items.length})</span></h2>
                    </div>
                    <div className="flex flex-col gap-4 min-h-[200px]">
                        {column.items.map((formacao) => (
                            <div
                                key={formacao.id}
                                className="shadow-md hover:shadow-lg transition-shadow rounded-lg"
                            >
                                <Card>
                                    <CardContent className="p-4 space-y-3">
                                        <p className="text-sm font-semibold flex items-center gap-2">
                                            {formacao.titulo}
                                        </p>
                                            <p className="text-xs text-muted-foreground">
                                            {formacao.descricao}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                         {column.items.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-4">
                                Nenhuma formação nesta etapa.
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}

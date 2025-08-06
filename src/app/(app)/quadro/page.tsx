
'use client';

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Task = {
  id: string;
  content: string;
};

type Column = {
  id: string;
  title: string;
  tasks: Task[];
};

type Columns = {
  [key: string]: Column;
};

const initialColumns: Columns = {
  'todo': {
    id: 'todo',
    title: 'A Fazer',
    tasks: [
      { id: 'task-1', content: 'Revisar material de Português' },
      { id: 'task-2', content: 'Agendar reunião com formadores de matemática' },
    ],
  },
  'inProgress': {
    id: 'inProgress',
    title: 'Em Andamento',
    tasks: [
        { id: 'task-3', content: 'Desenvolver novo módulo de Ciências' },
    ],
  },
  'done': {
    id: 'done',
    title: 'Concluído',
    tasks: [
        { id: 'task-4', content: 'Finalizar relatório do primeiro semestre' },
    ],
  },
};

export default function QuadroPage() {
  const [columns, setColumns] = useState<Columns>(initialColumns);

  return (
    <div className="flex flex-col gap-8 py-6 h-full">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Quadro de Tarefas</h1>
            <p className="text-muted-foreground">Organize e acompanhe o fluxo de trabalho.</p>
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {Object.entries(columns).map(([columnId, column]) => (
                <div
                    key={columnId}
                    className="flex flex-col gap-4 p-4 rounded-lg h-full bg-muted/50"
                >
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold font-headline">{column.title}</h2>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex flex-col gap-4">
                        {column.tasks.map((task, index) => (
                             <div
                                key={task.id}
                                className="shadow-md hover:shadow-lg transition-shadow rounded-lg"
                            >
                                <Card>
                                    <CardContent className="p-4">
                                        <p className="text-sm">{task.content}</p>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}

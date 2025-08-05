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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Formador } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const mockFormadores: Formador[] = [
  { id: '1', nomeCompleto: 'Ana Silva', email: 'ana.silva@example.com', cpf: '111.222.333-44', telefone: '(11) 98765-4321', municipiosResponsaveis: ['São Paulo', 'Guarulhos'] },
  { id: '2', nomeCompleto: 'Bruno Costa', email: 'bruno.costa@example.com', cpf: '222.333.444-55', telefone: '(21) 91234-5678', municipiosResponsaveis: ['Rio de Janeiro'] },
  { id: '3', nomeCompleto: 'Carla Dias', email: 'carla.dias@example.com', cpf: '333.444.555-66', telefone: '(31) 95555-8888', municipiosResponsaveis: ['Belo Horizonte', 'Contagem', 'Betim'] },
  { id: '4', nomeCompleto: 'Daniel Santos', email: 'daniel.santos@example.com', cpf: '444.555.666-77', telefone: '(51) 94321-8765', municipiosResponsaveis: ['Porto Alegre'] },
];

export default function FormadoresPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.perfil !== 'administrador') {
      router.replace('/materiais');
    }
  }, [user, router]);
  
  if (!user || user.perfil !== 'administrador') {
    return null; // or a loading/access denied component
  }
  
  return (
    <div className="flex flex-col gap-4 py-6 h-full">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Gerenciar Formadores</h1>
            <p className="text-muted-foreground">Adicione, edite e remova formadores do sistema.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Formador
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar formador por nome ou email..." className="pl-8" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome Completo</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Municípios</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockFormadores.map((formador) => (
              <TableRow key={formador.id}>
                <TableCell className="font-medium">{formador.nomeCompleto}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{formador.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {formador.municipiosResponsaveis.map((m) => (
                      <Badge key={m} variant="secondary">{m}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

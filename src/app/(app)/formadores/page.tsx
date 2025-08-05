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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { Formador } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormFormador } from '@/components/formadores/form-formador';

export default function FormadoresPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFormador, setSelectedFormador] = useState<Formador | null>(null);

  const fetchFormadores = useCallback(async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'formadores'));
      const formadoresData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
      setFormadores(formadoresData);
    } catch (error) {
      console.error("Error fetching formadores:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.perfil !== 'administrador') {
      router.replace('/materiais');
    } else if (user?.perfil === 'administrador') {
      fetchFormadores();
    }
  }, [user, router, fetchFormadores]);
  
  const handleSuccess = () => {
    fetchFormadores();
    setIsDialogOpen(false);
    setSelectedFormador(null);
  }
  
  const handleDelete = async (formadorId: string) => {
    if(!confirm('Tem certeza que deseja excluir este formador? Esta ação não pode ser desfeita.')) return;
    try {
        // Here you might want to delete the user from Firebase Auth as well
        // This requires admin privileges and is best done from a backend environment
        // For now, we will just delete the Firestore document.
        await deleteDoc(doc(db, "formadores", formadorId));
        await deleteDoc(doc(db, "usuarios", formadorId)); // Also remove from users collection
        fetchFormadores();
    } catch (error) {
        console.error("Error deleting formador: ", error);
    }
  }

  const openEditDialog = (formador: Formador) => {
    setSelectedFormador(formador);
    setIsDialogOpen(true);
  }

  if (!user || user.perfil !== 'administrador') {
    return null;
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
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Gerenciar Formadores</h1>
            <p className="text-muted-foreground">Adicione, edite e remova formadores do sistema.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedFormador(null);
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Formador
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{selectedFormador ? 'Editar Formador' : 'Novo Formador'}</DialogTitle>
              <DialogDescription>
                {selectedFormador ? 'Altere os dados do formador.' : 'Preencha os dados para cadastrar um novo formador.'}
              </DialogDescription>
            </DialogHeader>
            <FormFormador formador={selectedFormador} onSuccess={handleSuccess} />
          </DialogContent>
        </Dialog>
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
            {formadores.map((formador) => (
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
                      <DropdownMenuItem onClick={() => openEditDialog(formador)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDelete(formador.id)}>
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


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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2, Loader2, Map, Users, Eye } from 'lucide-react';
import type { Formador } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormFormador } from '@/components/formadores/form-formador';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DetalhesFormador } from '@/components/formadores/detalhes-formador';

type GroupedFormadores = {
    [uf: string]: Formador[];
}

export default function FormadoresPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedFormador, setSelectedFormador] = useState<Formador | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFormadores = useCallback(async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'formadores'));
      const formadoresData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
      setFormadores(formadoresData);
    } catch (error) {
      console.error("Error fetching formadores:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os formadores.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user && user.perfil !== 'administrador') {
      router.replace('/materiais');
    } else if (user?.perfil === 'administrador') {
      fetchFormadores();
    }
  }, [user, router, fetchFormadores]);
  
  const handleSuccess = () => {
    fetchFormadores();
    setIsFormDialogOpen(false);
    setSelectedFormador(null);
  }
  
  const handleDelete = async (formadorId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este formador? Esta ação não pode ser desfeita.')) {
        return;
    }
    try {
        await deleteDoc(doc(db, "formadores", formadorId));
        await deleteDoc(doc(db, "usuarios", formadorId));
        toast({ title: 'Sucesso!', description: 'Formador excluído com sucesso.' });
        fetchFormadores();
    } catch (error) {
        console.error("Error deleting formador: ", error);
        toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'Não foi possível excluir o formador.' });
    }
  }

  const openEditDialog = (formador: Formador) => {
    setSelectedFormador(formador);
    setIsFormDialogOpen(true);
  }
  
  const openDetailDialog = (formador: Formador) => {
    setSelectedFormador(formador);
    setIsDetailDialogOpen(true);
  };
  
  const handleDialogChange = (setter: React.Dispatch<React.SetStateAction<boolean>>) => (open: boolean) => {
    setter(open);
    if (!open) {
      setSelectedFormador(null);
    }
  };


  const groupedFormadores = useMemo(() => {
    const filtered = searchTerm
        ? formadores.filter(f => 
            f.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.uf.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.disciplina && f.disciplina.toLowerCase().includes(searchTerm.toLowerCase())) ||
            f.municipiosResponsaveis.some(m => m.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        : formadores;

    return filtered.reduce((acc, formador) => {
        const uf = formador.uf || 'Sem Região';
        if (!acc[uf]) {
            acc[uf] = [];
        }
        acc[uf].push(formador);
        return acc;
    }, {} as GroupedFormadores);
  }, [formadores, searchTerm]);

  const ufs = useMemo(() => Object.keys(groupedFormadores).sort(), [groupedFormadores]);


  if (!user || user.perfil !== 'administrador') {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
        <Dialog open={isFormDialogOpen} onOpenChange={handleDialogChange(setIsFormDialogOpen)}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Formador
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedFormador ? 'Editar Formador' : 'Novo Formador'}</DialogTitle>
              <DialogDescription>
                {selectedFormador ? 'Altere os dados do formador.' : 'Preencha os dados para cadastrar um novo formador.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className='max-h-[80vh]'>
                <div className='p-4'>
                    <FormFormador formador={selectedFormador} onSuccess={handleSuccess} />
                </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome, email, disciplina, cidade ou estado..." 
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {formadores.length === 0 ? (
         <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <Users className="w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum formador cadastrado</h3>
            <p className="text-sm text-muted-foreground">Comece adicionando um novo formador para visualizá-lo aqui.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={ufs} className="w-full space-y-4">
            {ufs.map(uf => (
                <AccordionItem value={uf} key={uf} className="border rounded-md px-4">
                    <AccordionTrigger>
                        <div className="flex items-center gap-3">
                            <Map className="h-5 w-5 text-primary"/>
                            <span className='text-lg font-semibold'>{uf}</span>
                            <Badge variant="outline">{groupedFormadores[uf].length} {groupedFormadores[uf].length === 1 ? 'formador' : 'formadores'}</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Nome Completo</TableHead>
                                    <TableHead className="hidden lg:table-cell">Disciplina</TableHead>
                                    <TableHead className="hidden md:table-cell">Email</TableHead>
                                    <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                                    <TableHead>Municípios</TableHead>
                                    <TableHead className="w-[60px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedFormadores[uf].map((formador) => (
                                    <TableRow key={formador.id}>
                                        <TableCell className="font-medium">
                                          <span className='cursor-pointer hover:underline' onClick={() => openDetailDialog(formador)}>
                                            {formador.nomeCompleto}
                                          </span>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell text-muted-foreground">{formador.disciplina || 'N/A'}</TableCell>
                                        <TableCell className="hidden md:table-cell text-muted-foreground">{formador.email}</TableCell>
                                        <TableCell className="hidden sm:table-cell text-muted-foreground">{formador.telefone}</TableCell>
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
                                              <DropdownMenuItem onClick={() => openDetailDialog(formador)}>
                                                  <Eye className="mr-2 h-4 w-4" />
                                                  Ver Detalhes
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => openEditDialog(formador)}>
                                                  <Pencil className="mr-2 h-4 w-4" />
                                                  Editar
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
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
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      )}

      <Dialog open={isDetailDialogOpen} onOpenChange={handleDialogChange(setIsDetailDialogOpen)}>
          <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                  <DialogTitle>Detalhes do Formador</DialogTitle>
                   <DialogDescription>
                       Informações completas sobre o formador.
                   </DialogDescription>
              </DialogHeader>
              {selectedFormador && <DetalhesFormador formador={selectedFormador} />}
          </DialogContent>
      </Dialog>
    </div>
  );
}

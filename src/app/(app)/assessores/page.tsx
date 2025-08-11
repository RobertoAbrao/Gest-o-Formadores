
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
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2, Loader2, Map, Users } from 'lucide-react';
import type { Assessor } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormAssessor } from '@/components/assessores/form-assessor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type GroupedAssessores = {
    [uf: string]: Assessor[];
}

export default function AssessoresPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [assessores, setAssessores] = useState<Assessor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAssessor, setSelectedAssessor] = useState<Assessor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAssessores = useCallback(async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'assessores'));
      const assessoresData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessor));
      setAssessores(assessoresData);
    } catch (error) {
      console.error("Error fetching assessores:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os assessores.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user && user.perfil !== 'administrador') {
      router.replace('/materiais');
    } else if (user?.perfil === 'administrador') {
      fetchAssessores();
    }
  }, [user, router, fetchAssessores]);
  
  const handleSuccess = () => {
    fetchAssessores();
    setIsDialogOpen(false);
    setSelectedAssessor(null);
  }
  
  const handleDelete = async (assessorId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este assessor? Esta ação não pode ser desfeita.')) {
        return;
    }
    try {
        await deleteDoc(doc(db, "assessores", assessorId));
        await deleteDoc(doc(db, "usuarios", assessorId));
        toast({ title: 'Sucesso!', description: 'Assessor excluído com sucesso.' });
        fetchAssessores();
    } catch (error) {
        console.error("Error deleting assessor: ", error);
        toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'Não foi possível excluir o assessor.' });
    }
  }

  const openEditDialog = (assessor: Assessor) => {
    setSelectedAssessor(assessor);
    setIsDialogOpen(true);
  }

  const groupedAssessores = useMemo(() => {
    const filtered = searchTerm
        ? assessores.filter(f => 
            f.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.uf.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.disciplina && f.disciplina.toLowerCase().includes(searchTerm.toLowerCase())) ||
            f.municipiosResponsaveis.some(m => m.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        : assessores;

    return filtered.reduce((acc, assessor) => {
        const uf = assessor.uf || 'Sem Região';
        if (!acc[uf]) {
            acc[uf] = [];
        }
        acc[uf].push(assessor);
        return acc;
    }, {} as GroupedAssessores);
  }, [assessores, searchTerm]);

  const ufs = useMemo(() => Object.keys(groupedAssessores).sort(), [groupedAssessores]);


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
            <h1 className="text-3xl font-bold tracking-tight font-headline">Gerenciar Assessores</h1>
            <p className="text-muted-foreground">Adicione, edite e remova assessores do sistema.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedAssessor(null);
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Assessor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedAssessor ? 'Editar Assessor' : 'Novo Assessor'}</DialogTitle>
              <DialogDescription>
                {selectedAssessor ? 'Altere os dados do assessor.' : 'Preencha os dados para cadastrar um novo assessor.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className='max-h-[80vh]'>
                <div className='p-4'>
                    <FormAssessor assessor={selectedAssessor} onSuccess={handleSuccess} />
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

      {assessores.length === 0 ? (
         <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <Users className="w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum assessor cadastrado</h3>
            <p className="text-sm text-muted-foreground">Comece adicionando um novo assessor para visualizá-lo aqui.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={ufs} className="w-full space-y-4">
            {ufs.map(uf => (
                <AccordionItem value={uf} key={uf} className="border rounded-md px-4">
                    <AccordionTrigger>
                        <div className="flex items-center gap-3">
                            <Map className="h-5 w-5 text-primary"/>
                            <span className='text-lg font-semibold'>{uf}</span>
                            <Badge variant="outline">{groupedAssessores[uf].length} {groupedAssessores[uf].length === 1 ? 'assessor' : 'assessores'}</Badge>
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
                                    {groupedAssessores[uf].map((assessor) => (
                                    <TableRow key={assessor.id}>
                                        <TableCell className="font-medium">{assessor.nomeCompleto}</TableCell>
                                        <TableCell className="hidden lg:table-cell text-muted-foreground">{assessor.disciplina || 'N/A'}</TableCell>
                                        <TableCell className="hidden md:table-cell text-muted-foreground">{assessor.email}</TableCell>
                                        <TableCell className="hidden sm:table-cell text-muted-foreground">{assessor.telefone}</TableCell>
                                        <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {assessor.municipiosResponsaveis.map((m) => (
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
                                            <DropdownMenuItem onClick={() => openEditDialog(assessor)}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDelete(assessor.id)}>
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
    </div>
  );
}

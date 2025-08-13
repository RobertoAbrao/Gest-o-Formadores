
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
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2, Loader2, ClipboardList } from 'lucide-react';
import type { ProjetoImplatancao } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormProjeto } from '@/components/projetos/form-projeto';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';


const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('pt-BR');
}

export default function ProjetosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<ProjetoImplatancao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<ProjetoImplatancao | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProjetos = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'projetos'), orderBy('dataCriacao', 'desc'));
      const querySnapshot = await getDocs(q);
      const projetosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjetoImplatancao));
      setProjetos(projetosData);
    } catch (error) {
      console.error("Error fetching projetos:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os projetos.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user && user.perfil !== 'administrador') {
      router.replace('/materiais');
    } else if (user?.perfil === 'administrador') {
      fetchProjetos();
    }
  }, [user, router, fetchProjetos]);
  
  const handleSuccess = () => {
    fetchProjetos();
    setIsDialogOpen(false);
    setSelectedProjeto(null);
  }
  
  const handleDelete = async (projetoId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.')) {
        return;
    }
    try {
        await deleteDoc(doc(db, "projetos", projetoId));
        toast({ title: 'Sucesso!', description: 'Projeto excluído com sucesso.' });
        fetchProjetos();
    } catch (error) {
        console.error("Error deleting projeto: ", error);
        toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'Não foi possível excluir o projeto.' });
    }
  }

  const openEditDialog = (projeto: ProjetoImplatancao) => {
    setSelectedProjeto(projeto);
    setIsDialogOpen(true);
  }

  const filteredProjetos = useMemo(() => {
    return searchTerm
        ? projetos.filter(p => 
            p.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.uf.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.formadoresNomes && p.formadoresNomes.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        : projetos;
  }, [projetos, searchTerm]);


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
            <h1 className="text-3xl font-bold tracking-tight font-headline">Gerenciar Projetos</h1>
            <p className="text-muted-foreground">Adicione, edite e acompanhe os projetos de implantação.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedProjeto(null);
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedProjeto ? 'Editar Projeto' : 'Novo Projeto de Implantação'}</DialogTitle>
              <DialogDescription>
                {selectedProjeto ? 'Altere os dados do projeto.' : 'Preencha os dados para cadastrar um novo projeto.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className='max-h-[80vh]'>
                <div className='p-4'>
                    <FormProjeto projeto={selectedProjeto} onSuccess={handleSuccess} />
                </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por município, estado ou formador..." 
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {projetos.length === 0 ? (
         <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <ClipboardList className="w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum projeto cadastrado</h3>
            <p className="text-sm text-muted-foreground">Comece adicionando um novo projeto para visualizá-lo aqui.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Município</TableHead>
                        <TableHead className="hidden lg:table-cell">Formadores</TableHead>
                        <TableHead className="hidden sm:table-cell">Implantação</TableHead>
                        <TableHead className="hidden md:table-cell">Migração</TableHead>
                        <TableHead className="hidden sm:table-cell">Alunos</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredProjetos.map((projeto) => (
                    <TableRow key={projeto.id}>
                        <TableCell className="font-medium">
                            <div>{projeto.municipio}</div>
                            <div className="text-xs text-muted-foreground">{projeto.uf}</div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{projeto.formadoresNomes || 'N/A'}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{formatDate(projeto.dataImplantacao)}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(projeto.dataMigracao)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{projeto.qtdAlunos || 'N/A'}</TableCell>
                        <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(projeto)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDelete(projeto.id)}>
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
      )}
    </div>
  );
}

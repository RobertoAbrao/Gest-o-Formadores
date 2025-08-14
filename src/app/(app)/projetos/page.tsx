
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2, Loader2, ClipboardList, CheckCircle2, XCircle, Eye, BookOpen, Link as LinkIcon } from 'lucide-react';
import type { ProjetoImplatancao, Material } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc, orderBy, query, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormProjeto } from '@/components/projetos/form-projeto';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { DetalhesProjeto } from '@/components/projetos/detalhes-projeto';


const formatDate = (timestamp: Timestamp | null | undefined) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('pt-BR');
}

export default function ProjetosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<ProjetoImplatancao[]>([]);
  const [materiais, setMateriais] = useState<Map<string, Material>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isMaterialDetailOpen, setIsMaterialDetailOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<ProjetoImplatancao | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProjetosAndMateriais = useCallback(async () => {
    setLoading(true);
    try {
      const [projetosSnapshot, materiaisSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'projetos'), orderBy('dataCriacao', 'desc'))),
        getDocs(collection(db, 'materiais'))
      ]);

      const projetosData = projetosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjetoImplatancao));
      setProjetos(projetosData);

      const materiaisMap = new Map<string, Material>();
      materiaisSnapshot.docs.forEach(doc => {
        materiaisMap.set(doc.id, { id: doc.id, ...doc.data() } as Material);
      });
      setMateriais(materiaisMap);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user && user.perfil !== 'administrador') {
      router.replace('/materiais');
    } else if (user?.perfil === 'administrador') {
        fetchProjetosAndMateriais();
    }
  }, [user, router, fetchProjetosAndMateriais]);
  
  const handleSuccess = () => {
    fetchProjetosAndMateriais();
    setIsFormDialogOpen(false);
    setSelectedProjeto(null);
  }
  
  const handleDelete = async (projetoId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.')) {
        return;
    }
    try {
        await deleteDoc(doc(db, "projetos", projectId));
        toast({ title: 'Sucesso!', description: 'Projeto excluído com sucesso.' });
        fetchProjetosAndMateriais();
    } catch (error) {
        console.error("Error deleting projeto: ", error);
        toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'Não foi possível excluir o projeto.' });
    }
  }

  const openEditDialog = (projeto: ProjetoImplatancao) => {
    setSelectedProjeto(projeto);
    setIsFormDialogOpen(true);
  }
  
  const openDetailDialog = (projeto: ProjetoImplatancao) => {
    setSelectedProjeto(projeto);
    setIsDetailDialogOpen(true);
  }

  const handleDialogChange = (setter: React.Dispatch<React.SetStateAction<boolean>>) => (open: boolean) => {
    setter(open);
    if (!open) {
      setSelectedProjeto(null);
    }
  };

  const filteredProjetos = useMemo(() => {
    return searchTerm
        ? projetos.filter(p => 
            p.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.uf.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.material && p.material.toLowerCase().includes(searchTerm.toLowerCase()))
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
        <Dialog open={isFormDialogOpen} onOpenChange={handleDialogChange(setIsFormDialogOpen)}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl">
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
          placeholder="Buscar por município, estado ou material..." 
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
                        <TableHead className="hidden lg:table-cell">Material</TableHead>
                        <TableHead className="hidden sm:table-cell">Implantação</TableHead>
                        <TableHead className="hidden sm:table-cell">Diagnóstica</TableHead>
                        <TableHead className="hidden md:table-cell">Alunos</TableHead>
                        <TableHead className="hidden md:table-cell">Formadores</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredProjetos.map((projeto) => (
                    <TableRow key={projeto.id} onClick={() => openDetailDialog(projeto)} className="cursor-pointer">
                        <TableCell className="font-medium">
                            <div>{projeto.municipio}</div>
                            <div className="text-xs text-muted-foreground">{projeto.uf}</div>
                        </TableCell>
                        <TableCell 
                            className="hidden lg:table-cell text-muted-foreground"
                        >
                            {projeto.material || 'N/A'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{formatDate(projeto.dataImplantacao)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-center">
                            {projeto.diagnostica?.ok ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-destructive mx-auto" />}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{projeto.qtdAlunos || 'N/A'}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{projeto.formadoresIds?.length || 0}</TableCell>
                        <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {e.stopPropagation(); openDetailDialog(projeto)}}>
                                <Eye className="mr-2 h-4 w-4" />
                                Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {e.stopPropagation(); openEditDialog(projeto)}}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={(e) => {e.stopPropagation(); handleDelete(projeto.id)}}>
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

      <Dialog open={isDetailDialogOpen} onOpenChange={handleDialogChange(setIsDetailDialogOpen)}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Detalhes do Projeto de Implantação</DialogTitle>
                    <DialogDescription>
                        {selectedProjeto?.municipio} - {selectedProjeto?.uf}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className='max-h-[80vh]'>
                    <div className='p-4'>
                        {selectedProjeto && <DetalhesProjeto projeto={selectedProjeto} />}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
        
        <Dialog open={isMaterialDetailOpen} onOpenChange={setIsMaterialDetailOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary"/>Detalhes do Material</DialogTitle>
                </DialogHeader>
                {selectedMaterial && (
                    <div className="space-y-4 py-4 text-sm">
                        <h3 className="font-semibold text-lg">{selectedMaterial.titulo}</h3>
                        <p className="text-muted-foreground">{selectedMaterial.descricao}</p>
                        <Badge variant="outline">{selectedMaterial.tipoMaterial}</Badge>
                        <Button variant="outline" className="w-full" asChild>
                            <a href={selectedMaterial.url} target="_blank" rel="noopener noreferrer">
                                <LinkIcon className="mr-2 h-4 w-4"/> Acessar material
                            </a>
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    </div>
  );
}

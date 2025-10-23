
'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, FileText, Video, Link as LinkIcon, Download, Loader2, Eye, LayoutGrid, Presentation, Folder } from 'lucide-react';
import type { Material, MaterialType } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, orderBy, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FormMaterial } from '@/components/materiais/form-material';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';


const typeIcons: Record<MaterialType, React.ElementType> = {
  'PDF': FileText,
  'Vídeo': Video,
  'Link Externo': LinkIcon,
  'Documento Word': FileText,
  'Apresentação': Presentation,
  'Pasta': Folder,
};

const typeColors: Record<MaterialType, string> = {
    'PDF': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-500/30',
    'Vídeo': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-500/30',
    'Link Externo': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-500/30',
    'Documento Word': 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-500/30',
    'Apresentação': 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-500/30',
    'Pasta': 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-500/30',
}


export default function MateriaisPage() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === 'administrador';
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const { toast } = useToast();

  const fetchMateriais = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'materiais'), orderBy('dataUpload', 'desc'));
      const querySnapshot = await getDocs(q);
      const materiaisData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
      setMateriais(materiaisData);
    } catch (error) {
      console.error("Error fetching materials:", error);
      toast({ variant: 'destructive', title: 'Erro ao buscar materiais', description: 'Não foi possível carregar a lista de materiais.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMateriais();
  }, [fetchMateriais]);

  const handleSuccess = () => {
    fetchMateriais();
    setIsFormDialogOpen(false);
    setSelectedMaterial(null);
  }

  const handleDeleteConfirm = async () => {
    if (!selectedMaterial) return;
    try {
        await deleteDoc(doc(db, "materiais", selectedMaterial.id));
        toast({ title: 'Sucesso!', description: 'Material excluído com sucesso.' });
        fetchMateriais();
    } catch (error) {
        console.error("Error deleting material: ", error);
        toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'Não foi possível excluir o material.' });
    } finally {
        setIsDeleteDialogOpen(false);
        setSelectedMaterial(null);
    }
  }
  
  const openDeleteDialog = (material: Material) => {
    setSelectedMaterial(material);
    setIsDeleteDialogOpen(true);
  }

  const openEditDialog = (material: Material) => {
    setSelectedMaterial(material);
    setIsFormDialogOpen(true);
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
        <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
            setIsFormDialogOpen(open);
            if (!open) setSelectedMaterial(null);
        }}>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Materiais de Apoio</h1>
                    <p className="text-muted-foreground">
                        {isAdmin ? 'Adicione e gerencie os materiais para os formadores.' : 'Acesse os materiais de apoio mais recentes.'}
                    </p>
                </div>
                {isAdmin && (
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Novo Material
                        </Button>
                    </DialogTrigger>
                )}
            </div>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                <DialogTitle>{selectedMaterial ? 'Editar Material' : 'Novo Material'}</DialogTitle>
                <DialogDescription>
                    {selectedMaterial ? 'Altere os dados do material.' : 'Preencha os dados para cadastrar um novo material.'}
                </DialogDescription>
                </DialogHeader>
                <ScrollArea className='max-h-[80vh]'>
                    <div className='p-4'>
                        <FormMaterial material={selectedMaterial} onSuccess={handleSuccess} />
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
      
        {materiais.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg mt-8">
                <LayoutGrid className="w-12 h-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Nenhum material cadastrado</h3>
                <p className="text-sm text-muted-foreground">Comece adicionando um novo material para visualizá-lo aqui.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
                {materiais.map((material) => {
                    const Icon = typeIcons[material.tipoMaterial];
                    return (
                        <Card key={material.id} className="flex flex-col">
                            <CardHeader className='pb-4'>
                                <div className='flex justify-between items-start'>
                                    <Badge variant="outline" className={`font-mono text-xs ${typeColors[material.tipoMaterial]}`}>
                                        <Icon className="mr-1 h-3 w-3" />
                                        {material.tipoMaterial}
                                    </Badge>
                                    {isAdmin && (
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-7 w-7 p-0 -mr-2 -mt-2">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditDialog(material)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => openDeleteDialog(material)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                                <CardTitle className="pt-4 text-lg leading-snug">{material.titulo}</CardTitle>
                            </CardHeader>
                            <CardContent className='flex-grow'>
                                <CardDescription className="line-clamp-3 text-sm">{material.descricao}</CardDescription>
                            </CardContent>
                            <CardFooter className="flex-col items-start gap-2">
                                <p className="text-xs text-muted-foreground">
                                    Upload em: {material.dataUpload.toDate().toLocaleDateString('pt-BR')}
                                </p>
                                <Button className='w-full' size="sm" asChild>
                                    <Link href={`/materiais/${material.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Visualizar
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        )}

       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente o material
                        dos nossos servidores.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setSelectedMaterial(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
                        Sim, excluir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

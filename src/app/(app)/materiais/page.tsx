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
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, FileText, Video, Link as LinkIcon, Download, Loader2 } from 'lucide-react';
import type { Material, MaterialType } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, orderBy, query, deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { deleteObject, ref } from 'firebase/storage';
import { FormMaterial } from '@/components/materiais/form-material';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

const typeIcons: Record<MaterialType, React.ElementType> = {
  'PDF': FileText,
  'Vídeo': Video,
  'Link Externo': LinkIcon,
  'Documento Word': FileText,
};

const typeColors: Record<MaterialType, string> = {
    'PDF': 'bg-red-100 text-red-800 border-red-200',
    'Vídeo': 'bg-blue-100 text-blue-800 border-blue-200',
    'Link Externo': 'bg-green-100 text-green-800 border-green-200',
    'Documento Word': 'bg-sky-100 text-sky-800 border-sky-200',
}


export default function MateriaisPage() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === 'administrador';
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
    setIsDialogOpen(false);
    setSelectedMaterial(null);
  }

  const handleDelete = async (material: Material) => {
    if(!confirm('Tem certeza que deseja excluir este material? Esta ação não pode ser desfeita.')) return;
    try {
        // Delete the Firestore document
        await deleteDoc(doc(db, "materiais", material.id));

        // If there's a file associated, delete it from Storage
        if (material.urlArquivo && (material.tipoMaterial === 'PDF' || material.tipoMaterial === 'Documento Word')) {
            const fileRef = ref(storage, material.urlArquivo);
            await deleteObject(fileRef);
        }

        toast({ title: 'Sucesso!', description: 'Material excluído com sucesso.' });
        fetchMateriais();
    } catch (error) {
        console.error("Error deleting material: ", error);
        toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'Não foi possível excluir o material.' });
    }
  }

  const openEditDialog = (material: Material) => {
    setSelectedMaterial(material);
    setIsDialogOpen(true);
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
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
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
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead className="hidden lg:table-cell">Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Data de Upload</TableHead>
              <TableHead className="w-[100px] text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materiais.map((material) => {
              const Icon = typeIcons[material.tipoMaterial];
              return (
                <TableRow key={material.id}>
                  <TableCell className="font-medium">{material.titulo}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{material.descricao}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className={`font-mono text-xs ${typeColors[material.tipoMaterial]}`}>
                      <Icon className="mr-1 h-3 w-3" />
                      {material.tipoMaterial}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {material.dataUpload.toDate().toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(material)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(material)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <a href={material.urlArquivo} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Acessar
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

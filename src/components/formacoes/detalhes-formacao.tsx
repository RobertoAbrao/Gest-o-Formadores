
'use client';

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, Formador, Material, Anexo } from '@/lib/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, User, BookOpen, MapPin, Calendar, Paperclip, UploadCloud, File, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';

interface DetalhesFormacaoProps {
  formacaoId: string;
}

// Helper function to convert a file to a Base64 data URL
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};


export function DetalhesFormacao({ formacaoId }: DetalhesFormacaoProps) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formador, setFormador] = useState<Formador | null>(null);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const fetchData = useCallback(async () => {
    if (!formacaoId) return;
    setLoading(true);
    try {
        const formacaoRef = doc(db, 'formacoes', formacaoId);
        const formacaoSnap = await getDoc(formacaoRef);
        if (!formacaoSnap.exists()) {
            console.error('Formação não encontrada');
            toast({ variant: "destructive", title: "Erro", description: "Formação não encontrada." });
            setLoading(false);
            return;
        }
        const formacaoData = { id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao;
        setFormacao(formacaoData);

        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
            const formadorRef = doc(db, 'formadores', formacaoData.formadoresIds[0]);
            const formadorSnap = await getDoc(formadorRef);
            if (formadorSnap.exists()) {
                setFormador({ id: formadorSnap.id, ...formadorSnap.data() } as Formador);
            }
        }

        if (formacaoData.materiaisIds && formacaoData.materiaisIds.length > 0) {
            const q = query(collection(db, 'materiais'), where('__name__', 'in', formacaoData.materiaisIds));
            const materiaisSnap = await getDocs(q);
            const materiaisData = materiaisSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
            setMateriais(materiaisData);
        }
    } catch (error) {
        console.error('Erro ao buscar detalhes da formação: ', error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os detalhes da formação." });
    } finally {
        setLoading(false);
    }
  }, [formacaoId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !formacao) return;

    setUploading(true);
    try {
      const dataUrl = await fileToDataURL(file);

      const novoAnexo: Anexo = { nome: file.name, url: dataUrl };

      const formacaoRef = doc(db, 'formacoes', formacao.id);
      await updateDoc(formacaoRef, {
        anexos: arrayUnion(novoAnexo)
      });
      
      toast({ title: "Sucesso", description: "Anexo enviado." });
      
      await fetchData();

    } catch (error) {
      console.error("Erro no upload do arquivo:", error);
      toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar o arquivo." });
    } finally {
      setUploading(false);
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAnexo = async (anexo: Anexo) => {
    if (!formacao || !window.confirm(`Tem certeza que deseja excluir o anexo "${anexo.nome}"?`)) {
      return;
    }
    try {
      const formacaoRef = doc(db, 'formacoes', formacao.id);
      await updateDoc(formacaoRef, {
        anexos: arrayRemove(anexo)
      });
      toast({ title: "Sucesso", description: "Anexo excluído." });
      await fetchData();
    } catch (error) {
      console.error("Erro ao excluir anexo:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível excluir o anexo." });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!formacao) {
    return <div className="p-8">Formação não encontrada.</div>;
  }

  return (
    <ScrollArea className="max-h-[70vh]">
        <div className="space-y-6 p-4">
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Detalhes Gerais</h4>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
                {formador && (
                    <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Formador</p>
                            <p className="font-medium">{formador.nomeCompleto}</p>
                        </div>
                    </div>
                )}
                 <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Município</p>
                        <p className="font-medium">{formacao.municipio}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant="outline">{formacao.status}</Badge>
                    </div>
                </div>
            </div>
          </div>
          
          {materiais.length > 0 && (
            <div className='space-y-4'>
                <h4 className="font-semibold text-lg">Materiais de Apoio</h4>
                <Separator />
                <ul className="list-disc space-y-2 pl-5">
                    {materiais.map(material => (
                        <li key={material.id}>
                            <a href={material.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {material.titulo}
                            </a>
                             <span className='text-xs text-muted-foreground ml-2'>({material.tipoMaterial})</span>
                        </li>
                    ))}
                </ul>
            </div>
          )}

          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h4 className="font-semibold text-lg">Anexos e Atas</h4>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                />
                 <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2"/>}
                    Enviar Arquivo
                </Button>
             </div>
             <Separator />
             {(!formacao.anexos || formacao.anexos.length === 0) ? (
                <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                    <p>
                        <Paperclip className="h-6 w-6 mx-auto mb-2"/>
                        Nenhum anexo encontrado. Use o botão acima para enviar.
                    </p>
                </div>
             ) : (
                <div className="space-y-2">
                    {formacao.anexos.map((anexo, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/50 transition-colors group">
                           <a 
                                href={anexo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={anexo.nome}
                                className="flex items-center flex-1 truncate"
                            >
                                <File className="h-5 w-5 mr-3 text-primary" />
                                <span className="truncate text-sm">{anexo.nome}</span>
                            </a>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 opacity-50 group-hover:opacity-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleDeleteAnexo(anexo);
                                }}
                            >
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                        </div>
                    ))}
                </div>
             )}
          </div>
        </div>
      </ScrollArea>
  );
}


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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, Formador, Material, Anexo, FormadorStatus, Despesa } from '@/lib/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, User, BookOpen, MapPin, Calendar, Paperclip, UploadCloud, File as FileIcon, Trash2, Archive, DollarSign, Info, Eye } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';


interface DetalhesFormacaoProps {
  formacaoId: string;
  onClose: () => void;
  isArchived?: boolean;
}

const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const statusOptions: FormadorStatus[] = ['preparacao', 'em-formacao', 'pos-formacao', 'concluido'];

const formatDate = (timestamp: Timestamp | null | undefined) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('pt-BR');
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};


export function DetalhesFormacao({ formacaoId, onClose, isArchived = false }: DetalhesFormacaoProps) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formador, setFormador] = useState<Formador | null>(null);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
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

        let formadorId: string | null = null;
        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
            formadorId = formacaoData.formadoresIds[0];
            const formadorRef = doc(db, 'formadores', formadorId);
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
        } else {
            setMateriais([]);
        }
        
        // Fetch expenses
        if (formadorId) {
            const qDespesas = query(collection(db, 'despesas'), where('formadorId', '==', formadorId));
            const despesasSnap = await getDocs(qDespesas);
            const allDespesas = despesasSnap.docs.map(doc => ({id: doc.id, ...doc.data()} as Despesa));
            
            const startDate = formacaoData.dataInicio?.toMillis();
            const endDate = formacaoData.dataFim?.toMillis();

            const filteredDespesas = allDespesas.filter(d => {
                if (!startDate || !endDate) return false;
                const despesaDate = d.data.toMillis();
                return despesaDate >= startDate && despesaDate <= endDate;
            });
            
            filteredDespesas.sort((a, b) => a.data.toMillis() - b.data.toMillis());
            setDespesas(filteredDespesas);
        } else {
            setDespesas([]);
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

  const handleStatusChange = async (newStatus: FormadorStatus) => {
    if (!formacao || isArchived) return;
    try {
      const formacaoRef = doc(db, 'formacoes', formacao.id);
      await updateDoc(formacaoRef, { status: newStatus });
      setFormacao(prev => prev ? { ...prev, status: newStatus } : null);
      toast({ title: "Sucesso", description: `Status alterado para ${newStatus}.` });
      return true; // Indicate success
    } catch (error) {
       console.error("Erro ao alterar status:", error);
       toast({ variant: "destructive", title: "Erro", description: "Não foi possível alterar o status." });
       return false; // Indicate failure
    }
  }

  const handleArchive = async () => {
    if (!formacao || !window.confirm('Tem certeza que deseja arquivar esta formação?')) return;
    
    const success = await handleStatusChange('arquivado');
    if (success) {
        toast({ title: "Sucesso", description: "Formação arquivada." });
        onClose();
    } else {
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível arquivar a formação." });
    }
  }

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
  
  const totalDespesas = despesas.reduce((sum, item) => sum + item.valor, 0);

  return (
    <ScrollArea className="max-h-[70vh]">
        <Tabs defaultValue="info" className="p-4">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Informações Gerais</TabsTrigger>
                <TabsTrigger value="despesas">
                    Despesas <Badge variant="secondary" className="ml-2">{despesas.length}</Badge>
                </TabsTrigger>
            </TabsList>
            <TabsContent value="info">
                <div className="space-y-6 pt-4">
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
                                    <p className="text-sm text-muted-foreground">Data Início</p>
                                    <p className="font-medium">{formatDate(formacao.dataInicio)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Data Fim</p>
                                    <p className="font-medium">{formatDate(formacao.dataFim)}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    {isArchived ? (
                                        <Badge variant="secondary">Arquivado</Badge>
                                    ) : (
                                        <Select onValueChange={(value) => handleStatusChange(value as FormadorStatus)} value={formacao.status}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Alterar status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statusOptions.map(option => (
                                                    <SelectItem key={option} value={option}>
                                                        {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
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
                            {!isArchived && (
                                <>
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
                                </>
                            )}
                        </div>
                        <Separator />
                        {(!formacao.anexos || formacao.anexos.length === 0) ? (
                            <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                                <p>
                                    <Paperclip className="h-6 w-6 mx-auto mb-2"/>
                                    Nenhum anexo encontrado.
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
                                            <FileIcon className="h-5 w-5 mr-3 text-primary" />
                                            <span className="truncate text-sm">{anexo.nome}</span>
                                        </a>
                                        {!isArchived && (
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
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {!isArchived && formacao.status === 'concluido' && (
                        <div className="space-y-4 pt-4 border-t">
                            <h4 className="font-semibold text-lg">Ações</h4>
                            <p className="text-sm text-muted-foreground">
                                Esta formação foi concluída. Você pode arquivá-la para removê-la do quadro principal.
                            </p>
                            <Button variant="outline" onClick={handleArchive}>
                                <Archive className="mr-2 h-4 w-4" />
                                Arquivar Formação
                            </Button>
                        </div>
                    )}
                </div>
            </TabsContent>
            <TabsContent value="despesas">
                 <div className="space-y-6 pt-4">
                    <div className="flex justify-between items-center">
                         <h4 className="font-semibold text-lg">Relatório de Despesas</h4>
                         <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total</p>
                             <p className="text-xl font-bold text-primary">{formatCurrency(totalDespesas)}</p>
                         </div>
                    </div>
                    <Separator />
                     {despesas.length === 0 ? (
                        <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                            <p>
                                <DollarSign className="h-6 w-6 mx-auto mb-2"/>
                                Nenhuma despesa encontrada para esta formação.
                            </p>
                        </div>
                     ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead className="w-[120px] text-center">Comprovante</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {despesas.map(despesa => (
                                        <TableRow key={despesa.id}>
                                            <TableCell>{despesa.data.toDate().toLocaleDateString('pt-BR')}</TableCell>
                                            <TableCell><Badge variant="outline">{despesa.tipo}</Badge></TableCell>
                                            <TableCell className="text-muted-foreground">{despesa.descricao}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(despesa.valor)}</TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    disabled={!despesa.comprovanteUrl}
                                                    onClick={() => {
                                                        if (despesa.comprovanteUrl) {
                                                            window.open(despesa.comprovanteUrl, '_blank');
                                                        }
                                                    }}
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    Visualizar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </div>
                     )}
                     { !formacao.dataInicio || !formacao.dataFim && (
                         <Alert variant="default">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Datas não definidas</AlertTitle>
                            <AlertDescription>
                                Para visualizar as despesas, defina as datas de início e fim da formação.
                            </AlertDescription>
                        </Alert>
                     )}
                 </div>
            </TabsContent>
        </Tabs>
      </ScrollArea>
  );
}

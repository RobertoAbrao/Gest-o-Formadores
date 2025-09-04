
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
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import type { Formacao, Formador, Material, Anexo, FormadorStatus, Despesa, TipoDespesa, Avaliacao, LogisticaViagem } from '@/lib/types';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Loader2, User, MapPin, Calendar, Paperclip, UploadCloud, File as FileIcon, Trash2, Archive, DollarSign, Info, Eye, Utensils, Car, Building, Book, Grip, Hash, Users, Star, ClipboardCheck, ToggleLeft, ToggleRight, PlaneTakeoff, PlaneLanding, Hotel, CalendarCheck2, Image as ImageIcon, FileText, FileType, Download } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { DetalhesDespesa } from '../despesas/detalhes-despesa';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';


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
const despesaTypes: TipoDespesa[] = ['Alimentação', 'Transporte', 'Hospedagem', 'Material Didático', 'Outros'];

const typeIcons: Record<TipoDespesa, React.ElementType> = {
  'Alimentação': Utensils,
  'Transporte': Car,
  'Hospedagem': Building,
  'Material Didático': Book,
  'Outros': Grip,
};

const formatDate = (timestamp: Timestamp | null | undefined, options?: Intl.DateTimeFormatOptions) => {
    if (!timestamp) return 'N/A';
    const defaultOptions: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    return timestamp.toDate().toLocaleDateString('pt-BR', options || defaultOptions);
}


const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

type GroupedDespesas = {
    [key in TipoDespesa]?: Despesa[];
}

type GroupedByFormador = {
    [formadorId: string]: {
        formadorNome: string;
        despesasPorTipo: GroupedDespesas;
        total: number;
    }
}

type AvaliacaoSummary = {
    total: number;
    mediaEditora: number;
    modalidade: Record<string, number>;
    funcao: Record<string, number>;
    etapaEnsino: Record<string, number>;
    materialTema: Record<string, number>;
    assuntos: Record<string, number>;
    organizacao: Record<string, number>;
    relevancia: Record<string, number>;
    material: Record<string, number>;
    avaliacaoEditora: Record<string, number>;
}


export function DetalhesFormacao({ formacaoId, onClose, isArchived = false }: DetalhesFormacaoProps) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [selectedDespesa, setSelectedDespesa] = useState<Despesa | null>(null);
  const [isDespesaDialogOpen, setIsDespesaDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') {
        return <FileText className="h-10 w-10 text-red-500 mr-3" />;
    }
    if (extension === 'doc' || extension === 'docx') {
        return <FileType className="h-10 w-10 text-blue-500 mr-3" />;
    }
    return <FileIcon className="h-10 w-10 text-gray-500 mr-3" />;
  };

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

        if (formacaoData.anexos) {
            formacaoData.anexos.sort((a, b) => b.dataUpload.toMillis() - a.dataUpload.toMillis());
        }

        setFormacao(formacaoData);

        let formadoresData: Formador[] = [];
        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
            const qFormadores = query(collection(db, 'formadores'), where('__name__', 'in', formacaoData.formadoresIds));
            const formadoresSnap = await getDocs(qFormadores);
            formadoresData = formadoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
            setFormadores(formadoresData);
        } else {
            setFormadores([]);
        }

        if (formacaoData.materiaisIds && formacaoData.materiaisIds.length > 0) {
            const q = query(collection(db, 'materiais'), where('__name__', 'in', formacaoData.materiaisIds));
            const materiaisSnap = await getDocs(q);
            const materiaisData = materiaisSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
            setMateriais(materiaisData);
        } else {
            setMateriais([]);
        }
        
        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
            const formadoresMap = new Map(formadoresData.map(f => [f.id, f.nomeCompleto]));

            const qDespesas = query(collection(db, 'despesas'), where('formacaoId', '==', formacaoId));
            const despesasSnap = await getDocs(qDespesas);
            const allDespesas = despesasSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    formadorNome: formadoresMap.get(data.formadorId) || 'N/A'
                } as Despesa
            });
            
            allDespesas.sort((a, b) => a.data.toMillis() - b.data.toMillis());
            setDespesas(allDespesas);
        } else {
            setDespesas([]);
        }

        const qAvaliacoes = query(collection(db, 'avaliacoes'), where('formacaoId', '==', formacaoId));
        const avaliacoesSnap = await getDocs(qAvaliacoes);
        const avaliacoesData = avaliacoesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Avaliacao));
        setAvaliacoes(avaliacoesData);


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

    const avaliacaoSummary = useMemo<AvaliacaoSummary | null>(() => {
        if (avaliacoes.length === 0) return null;

        const summary: AvaliacaoSummary = {
            total: avaliacoes.length,
            mediaEditora: 0,
            modalidade: {},
            funcao: {},
            etapaEnsino: {},
            materialTema: {},
            assuntos: {},
            organizacao: {},
            relevancia: {},
            material: {},
            avaliacaoEditora: {},
        };

        let totalEditora = 0;

        for (const avaliacao of avaliacoes) {
            totalEditora += Number(avaliacao.avaliacaoEditora);
            
            summary.modalidade[avaliacao.modalidade] = (summary.modalidade[avaliacao.modalidade] || 0) + 1;
            summary.funcao[avaliacao.funcao] = (summary.funcao[avaliacao.funcao] || 0) + 1;
            summary.etapaEnsino[avaliacao.etapaEnsino] = (summary.etapaEnsino[avaliacao.etapaEnsino] || 0) + 1;
            
            for (const tema of avaliacao.materialTema) {
                summary.materialTema[tema] = (summary.materialTema[tema] || 0) + 1;
            }

            summary.assuntos[avaliacao.avaliacaoAssuntos] = (summary.assuntos[avaliacao.avaliacaoAssuntos] || 0) + 1;
            summary.organizacao[avaliacao.avaliacaoOrganizacao] = (summary.organizacao[avaliacao.avaliacaoOrganizacao] || 0) + 1;
            summary.relevancia[avaliacao.avaliacaoRelevancia] = (summary.relevancia[avaliacao.avaliacaoRelevancia] || 0) + 1;
            summary.material[avaliacao.materialAtendeExpectativa] = (summary.material[avaliacao.materialAtendeExpectativa] || 0) + 1;
            summary.avaliacaoEditora[avaliacao.avaliacaoEditora] = (summary.avaliacaoEditora[avaliacao.avaliacaoEditora] || 0) + 1;
        }

        summary.mediaEditora = totalEditora / summary.total;
        
        return summary;
    }, [avaliacoes]);

  const despesasAgrupadas = useMemo(() => {
    return despesas.reduce((acc, despesa) => {
        const { formadorId, formadorNome = 'N/A', tipo, valor } = despesa;

        if (!acc[formadorId]) {
            acc[formadorId] = {
                formadorNome: formadorNome,
                despesasPorTipo: {},
                total: 0
            };
        }

        if (!acc[formadorId].despesasPorTipo[tipo]) {
            acc[formadorId].despesasPorTipo[tipo] = [];
        }

        acc[formadorId].despesasPorTipo[tipo]!.push(despesa);
        acc[formadorId].total += valor;

        return acc;
    }, {} as GroupedByFormador);
  }, [despesas]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !formacao) return;

    setUploading(true);
    try {
      const dataUrl = await fileToDataURL(file);
      const novoAnexo: Anexo = { 
          nome: file.name, 
          url: dataUrl,
          dataUpload: Timestamp.now()
        };
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
  
  const handleToggleAvaliacoes = async (checked: boolean) => {
    if (!formacao) return;
    try {
        const formacaoRef = doc(db, 'formacoes', formacao.id);
        await updateDoc(formacaoRef, { avaliacoesAbertas: checked });
        setFormacao(prev => prev ? { ...prev, avaliacoesAbertas: checked } : null);
        toast({ title: "Sucesso", description: `Avaliações ${checked ? 'abertas' : 'fechadas'}.` });
    } catch (error) {
        console.error("Erro ao alterar status da avaliação:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível alterar o status da avaliação." });
    }
  }

  const handleExportAvaliacoes = () => {
    if (!formacao || avaliacoes.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhum dado para exportar', description: 'Não há avaliações para esta formação.' });
        return;
    }

    const dataToExport = avaliacoes.map(avaliacao => ({
      'Nome Completo': avaliacao.nomeCompleto,
      'Email': avaliacao.email,
      'Formação': formacao.titulo,
      'Data da Formação': formatDate(avaliacao.dataFormacao, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      'Modalidade': avaliacao.modalidade,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Participantes");

    // Auto-size columns
    const cols = Object.keys(dataToExport[0]);
    const colWidths = cols.map(col => ({
        wch: Math.max(
            col.length,
            ...dataToExport.map(row => row[col as keyof typeof row]?.toString().length ?? 0)
        )
    }));
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, `Participantes - ${formacao.titulo}.xlsx`);
    toast({ title: 'Sucesso', description: 'O download da lista de participantes foi iniciado.' });
  };


  const openDespesaDetails = (despesa: Despesa) => {
    setSelectedDespesa(despesa);
    setIsDespesaDialogOpen(true);
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
  const totalHospedagem = formacao.logistica?.reduce((sum, item) => sum + (item.valorHospedagem || 0), 0) || 0;

  return (
    <ScrollArea className="max-h-[80vh]">
      <div className='p-1'>
        <Tabs defaultValue="info" className="p-4">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">Informações Gerais</TabsTrigger>
                <TabsTrigger value="logistica">Logística</TabsTrigger>
                <TabsTrigger value="despesas">
                    Despesas <Badge variant="secondary" className="ml-2">{despesas.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="avaliacoes">
                    Avaliações <Badge variant="secondary" className="ml-2">{avaliacoes.length}</Badge>
                </TabsTrigger>
            </TabsList>
            <TabsContent value="info">
                <div className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg">Detalhes Gerais</h4>
                        <Separator />
                        <div className="grid gap-4 md:grid-cols-2">
                            {formadores.length > 0 && (
                                <div className="flex items-start gap-3">
                                    <User className="h-5 w-5 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Formador(es)</p>
                                        {formadores.map(f => <p key={f.id} className="font-medium">{f.nomeCompleto}</p>)}
                                    </div>
                                </div>
                            )}
                            {formacao.participantes && formacao.participantes > 0 && (
                                <div className="flex items-start gap-3">
                                    <Users className="h-5 w-5 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Nº de Participantes</p>
                                        <p className="font-medium">{formacao.participantes}</p>
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
                            <h4 className="font-semibold text-lg">Linha do Tempo de Anexos</h4>
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
                                <div>
                                    <Paperclip className="h-6 w-6 mx-auto mb-2"/>
                                    Nenhum anexo encontrado.
                                </div>
                            </div>
                        ) : (
                            <div className="relative pl-6">
                                <div className="absolute left-6 top-0 bottom-0 w-px bg-border"></div>
                                {formacao.anexos.map((anexo, index) => {
                                    const isImage = anexo.url.startsWith('data:image');
                                    return (
                                        <div key={index} className="relative mb-8">
                                            <div className="absolute -left-[34px] top-1.5 h-4 w-4 rounded-full bg-primary border-4 border-background"></div>
                                            <div className="pl-4">
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(anexo.dataUpload, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <div className="flex flex-col items-start p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors group mt-1">
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center flex-1 truncate">
                                                            {!isImage && getFileIcon(anexo.nome)}
                                                            <a 
                                                                href={anexo.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                download={anexo.nome}
                                                                className="truncate text-sm font-medium hover:underline"
                                                            >
                                                                {anexo.nome}
                                                            </a>
                                                        </div>
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
                                                    {isImage && (
                                                        <a 
                                                            href={anexo.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            download={anexo.nome}
                                                            className="mt-2 w-full"
                                                        >
                                                        <img src={anexo.url} alt={anexo.nome} className="w-full rounded-md object-contain" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {!isArchived && (
                        <div className="space-y-4 pt-4 border-t">
                            <h4 className="font-semibold text-lg">Ações</h4>
                            <div className="flex flex-wrap items-center gap-4">
                                {formacao.status === 'concluido' && (
                                    <Button variant="outline" onClick={handleArchive}>
                                        <Archive className="mr-2 h-4 w-4" />
                                        Arquivar Formação
                                    </Button>
                                )}
                                <div className="flex items-center space-x-2">
                                    <Switch 
                                        id="avaliacoes-switch" 
                                        checked={formacao.avaliacoesAbertas}
                                        onCheckedChange={handleToggleAvaliacoes}
                                    />
                                    <Label htmlFor="avaliacoes-switch" className='flex items-center gap-2'>
                                        {formacao.avaliacoesAbertas 
                                            ? <><ToggleRight className="text-green-600"/> Avaliações Abertas</> 
                                            : <><ToggleLeft/> Avaliações Fechadas</>}
                                    </Label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </TabsContent>
            <TabsContent value="logistica">
                 <div className="space-y-6 pt-4">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                         <h4 className="font-semibold text-lg truncate">Passagens e Hospedagem</h4>
                         <div className="text-right flex-shrink-0">
                            <p className="text-sm text-muted-foreground">Custo Total de Hospedagem</p>
                             <p className="text-xl font-bold text-primary">{formatCurrency(totalHospedagem)}</p>
                         </div>
                    </div>
                    <Separator />
                     {(!formacao.logistica || formacao.logistica.length === 0) ? (
                        <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                            <div>
                                <Hotel className="h-6 w-6 mx-auto mb-2"/>
                                Nenhuma informação de logística registrada.
                            </div>
                        </div>
                     ) : (
                        <>
                            <div className="hidden md:block border rounded-lg overflow-hidden">
                               <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Formador</TableHead>
                                            <TableHead>Partida</TableHead>
                                            <TableHead>Ida/Volta</TableHead>
                                            <TableHead>Hotel</TableHead>
                                            <TableHead>Check-in/Check-out</TableHead>
                                            <TableHead className="text-right">Valor Hosp.</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {formacao.logistica.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">{item.formadorNome}</TableCell>
                                                <TableCell>{item.localPartida || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <div className='flex items-center gap-1'>
                                                        <PlaneTakeoff className='h-4 w-4 text-muted-foreground' /> {formatDate(item.dataIda)}
                                                    </div>
                                                    <div className='flex items-center gap-1'>
                                                        <PlaneLanding className='h-4 w-4 text-muted-foreground' /> {formatDate(item.dataVolta)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.hotel || 'N/A'}</TableCell>
                                                <TableCell>
                                                     <div className='flex items-center gap-1'>
                                                        <CalendarCheck2 className='h-4 w-4 text-muted-foreground' /> {formatDate(item.checkin)}
                                                    </div>
                                                    <div className='flex items-center gap-1'>
                                                        <CalendarCheck2 className='h-4 w-4 text-muted-foreground' /> {formatDate(item.checkout)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {item.valorHospedagem ? formatCurrency(item.valorHospedagem) : 'N/A'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="md:hidden space-y-4">
                                {formacao.logistica.map((item, index) => (
                                    <Card key={index} className="bg-muted/40">
                                        <CardHeader className="pb-4">
                                            <CardTitle className="text-base flex items-center justify-between">
                                                <span>{item.formadorNome}</span>
                                                <span className="font-bold text-primary">{item.valorHospedagem ? formatCurrency(item.valorHospedagem) : 'N/A'}</span>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3 text-sm">
                                            <div className="flex justify-between border-t pt-3">
                                                <span className="text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> Partida</span>
                                                <span>{item.localPartida || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground flex items-center gap-2"><Hotel className="h-4 w-4" /> Hotel</span>
                                                <span>{item.hotel || 'N/A'}</span>
                                            </div>
                                             <div className="flex justify-between">
                                                <span className="text-muted-foreground flex items-center gap-2"><PlaneTakeoff className="h-4 w-4" /> Ida</span>
                                                <span>{formatDate(item.dataIda)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground flex items-center gap-2"><PlaneLanding className="h-4 w-4" /> Volta</span>
                                                <span>{formatDate(item.dataVolta)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground flex items-center gap-2"><CalendarCheck2 className="h-4 w-4" /> Check-in</span>
                                                <span>{formatDate(item.checkin)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground flex items-center gap-2"><CalendarCheck2 className="h-4 w-4" /> Check-out</span>
                                                <span>{formatDate(item.checkout)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </>
                     )}
                 </div>
            </TabsContent>
            <TabsContent value="despesas">
                 <div className="space-y-6 pt-4">
                    <div className="flex justify-between items-center">
                         <h4 className="font-semibold text-lg">Relatório de Despesas</h4>
                         <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Geral</p>
                             <p className="text-xl font-bold text-primary">{formatCurrency(totalDespesas)}</p>
                         </div>
                    </div>
                    <Separator />
                     {despesas.length === 0 ? (
                        <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                            <div>
                                <DollarSign className="h-6 w-6 mx-auto mb-2"/>
                                Nenhuma despesa encontrada para esta formação.
                            </div>
                        </div>
                     ) : (
                        <Accordion type="multiple" className="w-full space-y-4">
                            {Object.entries(despesasAgrupadas).map(([formadorId, data]) => (
                                <AccordionItem value={formadorId} key={formadorId} className="border rounded-md px-4">
                                    <AccordionTrigger className="hover:no-underline">
                                        <div className="flex items-center gap-3">
                                            <User className="h-5 w-5 text-primary"/>
                                            <span className='text-lg font-semibold'>{data.formadorNome}</span>
                                        </div>
                                        <span className="text-lg font-semibold text-primary">{formatCurrency(data.total)}</span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <Accordion type="multiple" defaultValue={despesaTypes} className="w-full">
                                            {despesaTypes.map(type => {
                                                const despesasDoTipo = data.despesasPorTipo[type] || [];
                                                if (despesasDoTipo.length === 0) return null;
                                                const Icon = typeIcons[type];
                                                const total = despesasDoTipo.reduce((sum, item) => sum + item.valor, 0);

                                                return (
                                                    <AccordionItem value={type} key={type}>
                                                        <AccordionTrigger>
                                                            <div className="flex items-center gap-3">
                                                                <Icon className="h-5 w-5 text-primary"/>
                                                                <span className='font-semibold'>{type}</span>
                                                                <Badge variant="outline">{despesasDoTipo.length} {despesasDoTipo.length === 1 ? 'registro' : 'registros'}</Badge>
                                                            </div>
                                                            <span className="font-semibold text-primary">{formatCurrency(total)}</span>
                                                        </AccordionTrigger>
                                                        <AccordionContent>
                                                            <div className="border rounded-lg overflow-hidden">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>Data</TableHead>
                                                                            <TableHead>Descrição</TableHead>
                                                                            <TableHead className="text-right">Valor</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {despesasDoTipo.map(despesa => (
                                                                            <TableRow key={despesa.id} onClick={() => openDespesaDetails(despesa)} className="cursor-pointer">
                                                                                <TableCell>{despesa.data.toDate().toLocaleDateString('pt-BR')}</TableCell>
                                                                                <TableCell className="text-muted-foreground">{despesa.descricao}</TableCell>
                                                                                <TableCell className="text-right font-medium">{formatCurrency(despesa.valor)}</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                )
                                            })}
                                        </Accordion>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                     )}
                 </div>
            </TabsContent>
            <TabsContent value="avaliacoes">
                 <div className="space-y-6 pt-4">
                     <div className='flex justify-between items-center'>
                        <h4 className="font-semibold text-lg">Resultados da Avaliação</h4>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleExportAvaliacoes}
                            disabled={avaliacoes.length === 0}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Exportar para CSV
                        </Button>
                     </div>
                     <Separator />
                      {avaliacoes.length === 0 ? (
                        <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                            <div>
                                <ClipboardCheck className="h-6 w-6 mx-auto mb-2"/>
                                Nenhuma avaliação recebida para esta formação.
                            </div>
                        </div>
                     ) : (
                        <div>
                             {avaliacaoSummary && (
                                <div className="mb-8 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">Total de Respostas</CardTitle>
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">{avaliacaoSummary.total}</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">Média Avaliação da Editora</CardTitle>
                                                <Star className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">{avaliacaoSummary.mediaEditora.toFixed(1)} / 5</div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Card>
                                        <CardHeader><CardTitle className="text-base">Resumo das Respostas</CardTitle></CardHeader>
                                        <CardContent className="space-y-6 text-sm">
                                            
                                            <div className="space-y-2">
                                                <p className="font-medium">Modalidade</p>
                                                {Object.entries(avaliacaoSummary.modalidade).map(([key, value]) => (
                                                    <div key={key}>
                                                        <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / avaliacaoSummary.total) * 100).toFixed(0)}%)</span></div>
                                                        <Progress value={(value / avaliacaoSummary.total) * 100} />
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-medium">Função Pedagógica</p>
                                                {Object.entries(avaliacaoSummary.funcao).map(([key, value]) => (
                                                    <div key={key}>
                                                        <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / avaliacaoSummary.total) * 100).toFixed(0)}%)</span></div>
                                                        <Progress value={(value / avaliacaoSummary.total) * 100} />
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-medium">Etapa de Ensino</p>
                                                {Object.entries(avaliacaoSummary.etapaEnsino).map(([key, value]) => (
                                                    <div key={key}>
                                                        <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / avaliacaoSummary.total) * 100).toFixed(0)}%)</span></div>
                                                        <Progress value={(value / avaliacaoSummary.total) * 100} />
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <p className="font-medium">Material/Tema da Formação</p>
                                                {Object.entries(avaliacaoSummary.materialTema).map(([key, value]) => (
                                                    <div key={key}>
                                                        <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / avaliacaoSummary.total) * 100).toFixed(0)}%)</span></div>
                                                        <Progress value={(value / avaliacaoSummary.total) * 100} />
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-medium">Assuntos Abordados</p>
                                                {Object.entries(avaliacaoSummary.assuntos).map(([key, value]) => (
                                                    <div key={key}>
                                                        <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / avaliacaoSummary.total) * 100).toFixed(0)}%)</span></div>
                                                        <Progress value={(value / avaliacaoSummary.total) * 100} />
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-medium">Organização do Encontro</p>
                                                {Object.entries(avaliacaoSummary.organizacao).map(([key, value]) => (
                                                    <div key={key}>
                                                        <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / avaliacaoSummary.total) * 100).toFixed(0)}%)</span></div>
                                                        <Progress value={(value / avaliacaoSummary.total) * 100} />
                                                    </div>
                                                ))}
                                            </div>

                                             <div className="space-y-2">
                                                <p className="font-medium">Relevância para Prática</p>
                                                {Object.entries(avaliacaoSummary.relevancia).map(([key, value]) => (
                                                    <div key={key}>
                                                        <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / avaliacaoSummary.total) * 100).toFixed(0)}%)</span></div>
                                                        <Progress value={(value / avaliacaoSummary.total) * 100} />
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <p className="font-medium">Material Atende Expectativas</p>
                                                {Object.entries(avaliacaoSummary.material).map(([key, value]) => (
                                                    <div key={key}>
                                                        <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / avaliacaoSummary.total) * 100).toFixed(0)}%)</span></div>
                                                        <Progress value={(value / avaliacaoSummary.total) * 100} />
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <p className="font-medium">Avaliação da Editora (1-5)</p>
                                                {Object.entries(avaliacaoSummary.avaliacaoEditora).sort(([a], [b]) => Number(a) - Number(b)).map(([key, value]) => (
                                                    <div key={key}>
                                                        <div className="flex justify-between mb-1">
                                                            <span className="flex items-center gap-1">{key} <Star className="h-4 w-4 text-yellow-400" /></span>
                                                            <span>{value} ({((value / avaliacaoSummary.total) * 100).toFixed(0)}%)</span>
                                                        </div>
                                                        <Progress value={(value / avaliacaoSummary.total) * 100} />
                                                    </div>
                                                ))}
                                            </div>

                                        </CardContent>
                                    </Card>
                                    <Separator />
                                </div>
                            )}
                            
                            <h4 className="font-semibold text-lg mb-4">Respostas Individuais</h4>
                             <Accordion type="multiple" className="w-full space-y-2">
                                {avaliacoes.map(avaliacao => (
                                    <AccordionItem value={avaliacao.id} key={avaliacao.id} className="border rounded-md">
                                        <AccordionTrigger className='px-4 hover:no-underline'>
                                            <div className="flex items-center justify-between w-full pr-4">
                                                <span>{avaliacao.nomeCompleto}</span>
                                                <span className="text-xs text-muted-foreground font-normal">
                                                    {formatDate(avaliacao.dataCriacao, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="text-sm space-y-4 p-4 border-t">
                                                <div className='space-y-3'>
                                                    <div><strong>Função:</strong> {avaliacao.funcao}</div>
                                                    <div>
                                                      <strong>Assuntos:</strong> <Badge variant="outline">{avaliacao.avaliacaoAssuntos}</Badge>
                                                    </div>
                                                    <div>
                                                      <strong>Organização:</strong> <Badge variant="outline">{avaliacao.avaliacaoOrganizacao}</Badge>
                                                    </div>
                                                    <div>
                                                      <strong>Relevância:</strong> <Badge variant="outline">{avaliacao.avaliacaoRelevancia}</Badge>
                                                    </div>
                                                    <div>
                                                      <strong>Material Atende:</strong> <Badge variant="outline">{avaliacao.materialAtendeExpectativa}</Badge>
                                                    </div>
                                                    <div>
                                                        <strong>Avaliação (1-5):</strong>
                                                        <div className='flex items-center gap-1 mt-1'>
                                                            {[...Array(5)].map((_, i) => (
                                                            <Star key={i} className={`h-5 w-5 ${i < Number(avaliacao.avaliacaoEditora) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}/>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {avaliacao.interesseFormacao && (
                                                    <div>
                                                        <strong>Interesse:</strong>
                                                        <p className='text-muted-foreground pl-2 border-l-2 ml-1'>{avaliacao.interesseFormacao}</p>
                                                    </div>
                                                    )}
                                                    {avaliacao.observacoes && (
                                                    <div>
                                                        <strong>Observações:</strong>
                                                        <p className='text-muted-foreground pl-2 border-l-2 ml-1'>{avaliacao.observacoes}</p>
                                                    </div>
                                                    )}
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                     )}
                 </div>
            </TabsContent>
        </Tabs>
        <Dialog open={isDespesaDialogOpen} onOpenChange={(open) => {
            setIsDespesaDialogOpen(open);
            if (!open) {
                setSelectedDespesa(null);
            }
        }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Detalhes da Despesa</DialogTitle>
                    <DialogDescription>
                        Visualize as informações completas da despesa.
                    </DialogDescription>
                </DialogHeader>
                {selectedDespesa && <DetalhesDespesa despesa={selectedDespesa} />}
            </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}


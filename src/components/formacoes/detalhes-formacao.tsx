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
    addDoc,
    deleteDoc,
    setDoc,
    limit,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { differenceInCalendarDays } from 'date-fns';
import { db } from '@/lib/firebase';
import type { Formacao, Formador, Material, Anexo, FormadorStatus, Despesa, TipoDespesa, Avaliacao, AvaliacaoSecretaria, LogisticaViagem, ChecklistItem } from '@/lib/types';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Loader2, User, MapPin, Calendar, Paperclip, UploadCloud, File as FileIcon, Trash2, Archive, DollarSign, Info, Eye, Utensils, Car, Building, Book, Grip, Hash, Users, Star, ClipboardCheck, FileText, FileType, Sparkles, ToggleLeft, ToggleRight, PlaneTakeoff, PlaneLanding, Hotel, CalendarCheck2, Image as ImageIcon, Download, Printer, RotateCcw, ListChecks, MessageSquare, MessageSquareText, Copy, Mail, CheckCircle, Pencil, Megaphone } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { changeFormacaoStatus } from '@/lib/formacao-actions';
import { FASES, faseDaFormacao, podeConcluir } from '@/lib/fase-formacao';
import { CHECKLIST_ITENS, itemMarcado, progressoChecklist, type FaseChecklist } from '@/lib/checklist-formacao';
import { tituloDaFormacao } from '@/components/quadro/quadro-modelo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { DetalhesDespesa } from '../despesas/detalhes-despesa';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import Link from 'next/link';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';


/**
 * Detalhe de uma formação, aberto dentro de um <DialogContent> (quadro, Dashboard,
 * Arquivados). O cabeçalho — título, fase, datas, formadores, checklist e ações —
 * é renderizado AQUI, para as três telas mostrarem o mesmo; quem abre não deve
 * colocar outro DialogHeader em volta.
 *
 * Layout: cabeçalho e abas fixos, só o conteúdo da aba rola. Para isso o
 * DialogContent de quem abre precisa ser `flex flex-col p-0 overflow-hidden` com
 * altura máxima (ver /quadro).
 */
interface DetalhesFormacaoProps {
    formacaoId: string;
    onClose: () => void;
    isArchived?: boolean;
    /** Sem esta prop, o botão Editar não aparece (Dashboard e Arquivados não editam daqui). */
    onEditar?: () => void;
}

// Estendendo o tipo Anexo para incluir um ID opcional, para diferenciar os novos dos antigos
type DisplayAnexo = Anexo & { id?: string };

/** Noites de hospedagem — mesma conta do formulário (form-formacao: calculateTotalCost). */
const noitesDe = (item: LogisticaViagem): number => {
    const ini = item.checkin?.toDate?.();
    const fim = item.checkout?.toDate?.();
    if (!ini || !fim) return 0;
    return Math.max(0, differenceInCalendarDays(fim, ini));
};

// Os itens do checklist ficam em '@/lib/checklist-formacao' (o card do quadro também usa).

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

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
    mediaFormador: number;
    modalidade: Record<string, number>;
    funcao: Record<string, number>;
    etapaEnsino: Record<string, number>;
    materialTema: Record<string, number>;
    assuntos: Record<string, number>;
    organizacao: Record<string, number>;
    relevancia: Record<string, number>;
    material: Record<string, number>;
    avaliacaoEditora: Record<string, number>;
    avaliacaoFormador?: Record<string, number>;
}


const StarRating = ({ rating }: { rating: number | string | undefined }) => {
    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1) return <span className="text-muted-foreground text-sm">N/A</span>;
    return (
        <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={`h-5 w-5 ${star <= numericRating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                />
            ))}
        </div>
    );
};

export function DetalhesFormacao({ formacaoId, onClose, isArchived = false, onEditar }: DetalhesFormacaoProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    // Aba controlada: recarregar dados não pode devolver a pessoa para a primeira aba.
    const [aba, setAba] = useState('checklist');
    const [mudandoStatus, setMudandoStatus] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formacao, setFormacao] = useState<Formacao | null>(null);
    const [formadores, setFormadores] = useState<Formador[]>([]);
    const [materiais, setMateriais] = useState<Material[]>([]);
    const [despesas, setDespesas] = useState<Despesa[]>([]);
    const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
    const [avaliacoesSecretaria, setAvaliacoesSecretaria] = useState<AvaliacaoSecretaria[]>([]);
    const [anexos, setAnexos] = useState<DisplayAnexo[]>([]);
    const [selectedDespesa, setSelectedDespesa] = useState<Despesa | null>(null);
    const [isDespesaDialogOpen, setIsDespesaDialogOpen] = useState(false);

    const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
    const [editingObservation, setEditingObservation] = useState<{ itemId: string; currentObservation: string } | null>(null);
    const [observationText, setObservationText] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const getFileIcon = (fileName: string) => {
        const extension = fileName.split('.').pop()?.toLowerCase();
        if (extension === 'pdf') {
            return <FileText className="h-6 w-6 text-red-500 shrink-0" />;
        }
        if (extension === 'doc' || extension === 'docx') {
            return <FileType className="h-6 w-6 text-blue-500 shrink-0" />;
        }
        return <FileIcon className="h-6 w-6 text-gray-500 shrink-0" />;
    };

    /**
     * `silencioso`: recarga depois de anexar/excluir. Não liga o `loading`, que troca
     * o modal inteiro por um spinner — antes isso desmontava as abas e jogava a
     * pessoa de volta para a primeira.
     */
    const fetchData = useCallback(async (silencioso = false) => {
        if (!formacaoId) return;
        if (!silencioso) setLoading(true);
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

            // Fetch new attachments from the 'anexos' collection
            const anexosQuery = query(collection(db, 'anexos'), where('formacaoId', '==', formacaoId));
            const anexosSnap = await getDocs(anexosQuery);
            const novosAnexos = anexosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DisplayAnexo));

            // Get old attachments and combine
            const antigosAnexos = formacaoData.anexos || [];
            const allAnexos = [...antigosAnexos, ...novosAnexos];
            allAnexos.sort((a, b) => b.dataUpload.toMillis() - a.dataUpload.toMillis());
            setAnexos(allAnexos);


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

            const qAvaliacaoSecretaria = query(collection(db, 'avaliacoesSecretaria'), where('formacaoId', '==', formacaoId));
            const avaliacaoSecretariaSnap = await getDocs(qAvaliacaoSecretaria);
            const avaliacaoSecretariaData = avaliacaoSecretariaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AvaliacaoSecretaria));
            setAvaliacoesSecretaria(avaliacaoSecretariaData);


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

    const calculateAvaliacaoSummary = (filteredAvaliacoes: Avaliacao[]): AvaliacaoSummary | null => {
        if (filteredAvaliacoes.length === 0) return null;

        const summary: AvaliacaoSummary = {
            total: filteredAvaliacoes.length,
            mediaEditora: 0,
            mediaFormador: 0,
            modalidade: {},
            funcao: {},
            etapaEnsino: {},
            materialTema: {},
            assuntos: {},
            organizacao: {},
            relevancia: {},
            material: {},
            avaliacaoEditora: {},
            avaliacaoFormador: {},
        };

        let totalEditora = 0;
        let totalFormador = 0;
        let countFormador = 0;

        for (const avaliacao of filteredAvaliacoes) {
            totalEditora += Number(avaliacao.avaliacaoEditora);
            if (avaliacao.avaliacaoFormador) {
                totalFormador += Number(avaliacao.avaliacaoFormador);
                countFormador++;
            }

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
            if (avaliacao.avaliacaoFormador) {
                if (!summary.avaliacaoFormador) summary.avaliacaoFormador = {};
                summary.avaliacaoFormador[avaliacao.avaliacaoFormador] = (summary.avaliacaoFormador[avaliacao.avaliacaoFormador] || 0) + 1;
            }
        }

        summary.mediaEditora = totalEditora / summary.total;
        summary.mediaFormador = countFormador > 0 ? totalFormador / countFormador : 0;

        return summary;
    };

    const avaliacaoSummaryGeral = useMemo(() => calculateAvaliacaoSummary(avaliacoes), [avaliacoes]);

    const avaliacoesPorFormador = useMemo(() => {
        const grouped: Record<string, Avaliacao[]> = {};
        for (const formador of formadores) {
            grouped[formador.id] = avaliacoes.filter(a => a.formadorId === formador.id);
        }
        return grouped;
    }, [avaliacoes, formadores]);

    const formadoresComAvaliacao = useMemo(() => {
        return formadores.filter(f => avaliacoesPorFormador[f.id] && avaliacoesPorFormador[f.id].length > 0);
    }, [formadores, avaliacoesPorFormador]);

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

            const novoAnexo = {
                nome: file.name,
                url: dataUrl,
                dataUpload: Timestamp.now(),
                formacaoId: formacao.id, // Link to the formation
            };

            await addDoc(collection(db, 'anexos'), novoAnexo);

            toast({ title: "Sucesso", description: "Anexo enviado." });
            await fetchData(true);
        } catch (error) {
            console.error("Erro no upload do arquivo:", error);
            toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar o arquivo." });
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDeleteAnexo = async (anexo: DisplayAnexo) => {
        if (!formacao || !window.confirm(`Tem certeza que deseja excluir o anexo "${anexo.nome}"?`)) {
            return;
        }
        try {
            if (anexo.id) {
                // New system: delete the document from the 'anexos' collection
                await deleteDoc(doc(db, 'anexos', anexo.id));
            } else {
                // Old system: remove the item from the 'anexos' array in the formation document
                const formacaoRef = doc(db, 'formacoes', formacao.id);
                await updateDoc(formacaoRef, {
                    anexos: arrayRemove(anexo)
                });
            }
            toast({ title: "Sucesso", description: "Anexo excluído." });
            await fetchData(true);
        } catch (error) {
            console.error("Erro ao excluir anexo:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível excluir o anexo." });
        }
    };

    /**
     * Grava o status sem avisar nada — quem chama dá UM aviso só. (Antes este
     * método já mostrava "Status alterado para arquivado" e o chamador mostrava
     * outro, e o usuário via dois.)
     *
     * Concluir e arquivar passam por `changeFormacaoStatus`, o mesmo do card do
     * quadro: concluir cria a demanda de agradecimento no Diário de Bordo.
     */
    const gravarStatus = async (newStatus: FormadorStatus, comAcoes = true): Promise<boolean> => {
        if (!formacao) return false;
        setMudandoStatus(true);
        try {
            if (comAcoes) await changeFormacaoStatus(formacao, newStatus, user);
            else await updateDoc(doc(db, 'formacoes', formacao.id), { status: newStatus });
            setFormacao(prev => prev ? { ...prev, status: newStatus } : null);
            return true;
        } catch (error) {
            console.error("Erro ao alterar status:", error);
            return false;
        } finally {
            setMudandoStatus(false);
        }
    };

    const handleConcluir = async () => {
        if (await gravarStatus('concluido')) {
            toast({ title: "Formação concluída", description: "A demanda de agradecimento está no Diário de Bordo." });
        } else {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível concluir a formação." });
        }
    };

    const handleArchive = async () => {
        if (!formacao || !window.confirm('Tem certeza que deseja arquivar esta formação?')) return;

        if (await gravarStatus('arquivado')) {
            toast({ title: "Formação arquivada", description: "Ela continua em Arquivados." });
            onClose();
        } else {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível arquivar a formação." });
        }
    }

    const handleUnarchive = async () => {
        if (!formacao || !window.confirm('Tem certeza que deseja desarquivar esta formação?')) return;

        // Volta como concluída (foi assim que entrou no arquivo), sem as ações
        // automáticas: desarquivar não é concluir de novo.
        if (await gravarStatus('concluido', false)) {
            toast({ title: "Formação desarquivada", description: "Ela volta ao quadro, na coluna Concluída." });
            onClose();
        } else {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível desarquivar a formação." });
        }
    };

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

    const handleCopyLink = async (path: string) => {
        const url = `${window.location.origin}/${path}/${formacaoId}`;
        try {
            await navigator.clipboard.writeText(url);
            toast({ title: 'Link copiado', description: 'O link está na área de transferência.' });
        } catch {
            // Sem permissão de área de transferência: mostra o link para copiar à mão.
            toast({ variant: 'destructive', title: 'Não deu para copiar', description: url });
        }
    }

    const handleChecklistChange = async (itemId: string, checked: boolean) => {
        if (!formacao) return;
        try {
            const formacaoRef = doc(db, 'formacoes', formacao.id);
            const currentItem = formacao.checklist?.[itemId];

            // Prepare new value, preserving observation if it exists
            const currentObservation = (typeof currentItem === 'object' && currentItem !== null) ? currentItem.observation : '';
            const newValue = { checked, observation: currentObservation || '' };

            await updateDoc(formacaoRef, {
                [`checklist.${itemId}`]: newValue,
            });

            // Optimistic update
            setFormacao(prev => {
                if (!prev) return null;
                const newChecklist = { ...(prev.checklist || {}), [itemId]: newValue };
                return { ...prev, checklist: newChecklist };
            });
        } catch (error) {
            console.error("Erro ao atualizar o checklist:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar o item do checklist." });
        }
    };

    const handleOpenObservationModal = (itemId: string) => {
        const checklistValue = formacao?.checklist?.[itemId];
        const currentObservation = (typeof checklistValue === 'object' && checklistValue !== null && 'observation' in checklistValue ? checklistValue.observation : '') || '';
        setEditingObservation({ itemId, currentObservation });
        setObservationText(currentObservation);
        setIsObservationModalOpen(true);
    };

    const handleSaveObservation = async () => {
        if (!formacao || !editingObservation) return;
        const { itemId } = editingObservation;

        try {
            const formacaoRef = doc(db, 'formacoes', formacao.id);
            const currentItem = formacao.checklist?.[itemId];
            const isChecked = typeof currentItem === 'object' ? currentItem.checked : !!currentItem;

            await updateDoc(formacaoRef, {
                [`checklist.${itemId}`]: { checked: isChecked, observation: observationText },
            });

            // Optimistically update local state
            setFormacao(prev => {
                if (!prev) return null;
                const newChecklist = { ...prev.checklist };
                newChecklist[itemId] = { checked: isChecked, observation: observationText };
                return { ...prev, checklist: newChecklist };
            });

            toast({ title: "Sucesso", description: "Observação salva." });
            setIsObservationModalOpen(false);
            setEditingObservation(null);
        } catch (error) {
            console.error("Erro ao salvar observação:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar a observação." });
        }
    };


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

    const AvaliacaoSummaryComponent = ({ summary, avaliacoes, formadorName }: { summary: AvaliacaoSummary | null, avaliacoes: Avaliacao[], formadorName?: string }) => {
        if (!summary) return null;
        return (
            <div className="mb-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Respostas</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.total}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Média {formadorName || 'Formador'}</CardTitle>
                            <Star className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.mediaFormador > 0 ? `${summary.mediaFormador.toFixed(1)} / 5` : 'N/A'}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Média Editora LT</CardTitle>
                            <Star className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.mediaEditora.toFixed(1)} / 5</div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader><CardTitle className="text-base">Resumo das Respostas</CardTitle></CardHeader>
                    <CardContent className="space-y-6 text-sm">

                        <div className="space-y-2">
                            <p className="font-medium">Modalidade</p>
                            {Object.entries(summary.modalidade).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span></div>
                                    <Progress value={(value / summary.total) * 100} />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Função Pedagógica</p>
                            {Object.entries(summary.funcao).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span></div>
                                    <Progress value={(value / summary.total) * 100} />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Etapa de Ensino</p>
                            {Object.entries(summary.etapaEnsino).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span></div>
                                    <Progress value={(value / summary.total) * 100} />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Material/Tema da Formação</p>
                            {Object.entries(summary.materialTema).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span></div>
                                    <Progress value={(value / summary.total) * 100} />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Assuntos Abordados</p>
                            {Object.entries(summary.assuntos).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span></div>
                                    <Progress value={(value / summary.total) * 100} />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Organização do Encontro</p>
                            {Object.entries(summary.organizacao).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span></div>
                                    <Progress value={(value / summary.total) * 100} />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Relevância para Prática</p>
                            {Object.entries(summary.relevancia).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span></div>
                                    <Progress value={(value / summary.total) * 100} />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Material Atende Expectativas</p>
                            {Object.entries(summary.material).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between mb-1"><span>{key}</span><span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span></div>
                                    <Progress value={(value / summary.total) * 100} />
                                </div>
                            ))}
                        </div>

                        {summary.avaliacaoFormador && Object.keys(summary.avaliacaoFormador).length > 0 && (
                            <div className="space-y-2">
                                <p className="font-medium">Avaliação do Formador (1-5)</p>
                                {Object.entries(summary.avaliacaoFormador).sort(([a], [b]) => Number(a) - Number(b)).map(([key, value]) => (
                                    <div key={key}>
                                        <div className="flex justify-between mb-1">
                                            <span className="flex items-center gap-1">{key} <Star className="h-4 w-4 text-yellow-400" /></span>
                                            <span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span>
                                        </div>
                                        <Progress value={(value / summary.total) * 100} />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-2">
                            <p className="font-medium">Avaliação da Editora (1-5)</p>
                            {Object.entries(summary.avaliacaoEditora).sort(([a], [b]) => Number(a) - Number(b)).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between mb-1">
                                        <span className="flex items-center gap-1">{key} <Star className="h-4 w-4 text-yellow-400" /></span>
                                        <span>{value} ({((value / summary.total) * 100).toFixed(0)}%)</span>
                                    </div>
                                    <Progress value={(value / summary.total) * 100} />
                                </div>
                            ))}
                        </div>

                    </CardContent>
                </Card>
            </div>
        );
    };

    const AvaliacaoSecretariaComponent = ({ avaliacoes }: { avaliacoes: AvaliacaoSecretaria[] }) => {
        return (
            <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-lg">Avaliação da Secretaria</h4>
                    <Button variant="outline" size="sm" onClick={() => handleCopyLink('avaliacao-secretaria')}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar Link do Formulário
                    </Button>
                </div>
                <Separator />
                {avaliacoes.length === 0 ? (
                    <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                        <div>
                            <ClipboardCheck className="h-6 w-6 mx-auto mb-2" />
                            Nenhuma avaliação da secretaria foi recebida para esta formação ainda.
                        </div>
                    </div>
                ) : (
                    avaliacoes.map((avaliacao) => {
                        const fields = [
                            { label: "Domínio do conteúdo e clareza", value: avaliacao.dominioConteudo },
                            { label: "Tempo dedicado", value: avaliacao.tempoDedicado },
                            { label: "Formato da apresentação", value: avaliacao.formatoApresentacao },
                            { label: "Dúvidas esclarecidas", value: avaliacao.duvidasEsclarecidas },
                            { label: "Aplicabilidade na prática", value: `${avaliacao.aplicabilidade}/5` },
                            { label: "Percepção de engajamento", value: avaliacao.percepcaoEngajamento },
                            { label: "Organização geral", value: avaliacao.organizacaoGeral },
                            { label: "Avaliação do Coffee Break", value: avaliacao.avaliacaoCoffeeBreak },
                        ];

                        const openFields = [
                            { label: "Sugestões para o material", value: avaliacao.sugestoesMaterial },
                            { label: "Principais benefícios", value: avaliacao.principaisBeneficios },
                            { label: "Comentários finais", value: avaliacao.comentariosFinais },
                        ].filter(f => f.value);

                        return (
                            <Card key={avaliacao.id}>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        {avaliacao.nomeCompleto}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-2 text-xs">
                                        <Mail className="h-3 w-3" />
                                        {avaliacao.email}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                        {fields.map(field => (
                                            <div key={field.label} className="flex justify-between items-center border-b pb-2">
                                                <span className="font-medium text-muted-foreground">{field.label}</span>
                                                <Badge variant="secondary">{field.value}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                    {openFields.length > 0 && (
                                        <div className="mt-6 space-y-4">
                                            <Separator />
                                            {openFields.map(field => (
                                                <div key={field.label} className="text-sm">
                                                    <p className="font-medium mb-1">{field.label}:</p>
                                                    <p className="text-muted-foreground italic pl-4 border-l-2">"{field.value}"</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        );
    };

    const IndividualResponseList = ({ responses }: { responses: Avaliacao[] }) => {
        if (responses.length === 0) {
            return <p className="text-center text-sm text-muted-foreground py-4">Nenhuma resposta individual para este formador.</p>;
        }
        return (
            <Accordion type="multiple" className="w-full space-y-2">
                {responses.map((avaliacao) => (
                    <AccordionItem value={avaliacao.id} key={avaliacao.id} className="border rounded-md bg-muted/20">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex-1 text-left font-semibold">{avaliacao.nomeCompleto}</div>
                            <div className="text-sm text-muted-foreground">{formatDate(avaliacao.dataCriacao, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="font-medium">Função:</span> <Badge variant="outline">{avaliacao.funcao}</Badge></div>
                                    <div><span className="font-medium">Assuntos:</span> <Badge variant="outline">{avaliacao.avaliacaoAssuntos}</Badge></div>
                                    <div><span className="font-medium">Organização:</span> <Badge variant="outline">{avaliacao.avaliacaoOrganizacao}</Badge></div>
                                    <div><span className="font-medium">Relevância:</span> <Badge variant="outline">{avaliacao.avaliacaoRelevancia}</Badge></div>
                                    <div><span className="font-medium">Material Atende:</span> <Badge variant="outline">{avaliacao.materialAtendeExpectativa}</Badge></div>
                                </div>
                                <Separator />
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">Avaliação do Formador:</span>
                                        <StarRating rating={avaliacao.avaliacaoFormador} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">Avaliação da Editora:</span>
                                        <StarRating rating={avaliacao.avaliacaoEditora} />
                                    </div>
                                </div>
                                <Separator />
                                {avaliacao.interesseFormacao && (
                                    <div className="text-sm">
                                        <p className="font-medium mb-1">Interesse:</p>
                                        <p className="text-muted-foreground italic pl-4 border-l-2">"{avaliacao.interesseFormacao}"</p>
                                    </div>
                                )}
                                {avaliacao.observacoes && (
                                    <div className="text-sm">
                                        <p className="font-medium mb-1">Observações:</p>
                                        <p className="text-muted-foreground italic pl-4 border-l-2">"{avaliacao.observacoes}"</p>
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center p-8">
                {/* O Radix exige título e descrição no diálogo mesmo enquanto carrega. */}
                <DialogTitle className="sr-only">Carregando formação</DialogTitle>
                <DialogDescription className="sr-only">Aguarde: os dados da formação estão sendo carregados.</DialogDescription>
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!formacao) {
        return (
            <div className="space-y-1 p-8">
                <DialogTitle>Formação não encontrada</DialogTitle>
                <DialogDescription>Ela pode ter sido excluída.</DialogDescription>
            </div>
        );
    }

    const totalDespesas = despesas.reduce((sum, item) => sum + item.valor, 0);
    // Noites × diária, a mesma conta do formulário. Antes somava só uma diária por pessoa.
    const totalHospedagem = formacao.logistica?.reduce((sum, item) => sum + noitesDe(item) * (item.valorDiaria || 0), 0) || 0;

    const fase = faseDaFormacao(formacao);
    const arquivada = isArchived || fase === 'arquivada';
    const checklist = progressoChecklist(formacao);
    const pctChecklist = checklist.total ? (checklist.feitos / checklist.total) * 100 : 0;
    const inicioTxt = formacao.dataInicio ? formatDate(formacao.dataInicio) : null;
    const fimTxt = formacao.dataFim ? formatDate(formacao.dataFim) : null;
    const periodo = !inicioTxt && !fimTxt
        ? 'Sem data'
        : inicioTxt && fimTxt && inicioTxt !== fimTxt ? `${inicioTxt} a ${fimTxt}` : (inicioTxt || fimTxt);
    const nomesFormadores = formadores.length > 0
        ? formadores.map(f => f.nomeCompleto).join(', ')
        : (formacao.formadoresNomes || []).join(', ');
    const local = [formacao.municipio, formacao.uf].filter(Boolean).join('/');

    return (
        <>
            <DialogHeader className="shrink-0 space-y-3 border-b p-4 pr-12 text-left sm:p-6 sm:pr-12">
                <div className="space-y-1.5">
                    <DialogTitle className="text-xl leading-snug sm:text-2xl">{tituloDaFormacao(formacao)}</DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium', FASES[fase].selo)}>
                                {FASES[fase].titulo}
                            </span>
                            <span className="font-mono text-xs">{formacao.codigo}</span>
                            <span aria-hidden>·</span>
                            <span>{periodo}</span>
                            {local && (
                                <>
                                    <span aria-hidden>·</span>
                                    <span>{local}</span>
                                </>
                            )}
                        </div>
                    </DialogDescription>
                </div>

                <p className="flex items-start gap-2 text-sm">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    {nomesFormadores ? <span>{nomesFormadores}</span> : <span className="text-muted-foreground">Sem formador definido</span>}
                </p>

                <button
                    type="button"
                    onClick={() => setAba('checklist')}
                    className="flex w-full items-center gap-2 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Abrir o checklist"
                >
                    <ListChecks className="h-4 w-4" />
                    <span>Checklist</span>
                    <Progress value={pctChecklist} className="h-1.5 flex-1" />
                    <span className="tabular-nums">{checklist.feitos}/{checklist.total}</span>
                </button>

                <div className="flex flex-wrap gap-2">
                    {!arquivada && podeConcluir(fase) && (
                        <Button onClick={handleConcluir} disabled={mudandoStatus} className="h-10 sm:h-9">
                            {mudandoStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Marcar como concluída
                        </Button>
                    )}
                    {!arquivada && onEditar && (
                        <Button variant="outline" onClick={onEditar} className="h-10 sm:h-9">
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                        </Button>
                    )}
                    {!arquivada && (
                        <Button variant="outline" asChild className="h-10 sm:h-9">
                            <Link href={`/ficha/${formacao.id}`} target="_blank" rel="noopener">
                                <Megaphone className="mr-2 h-4 w-4" />
                                Ficha de divulgação
                            </Link>
                        </Button>
                    )}
                    {!arquivada && fase === 'concluida' && (
                        <Button variant="outline" onClick={handleArchive} disabled={mudandoStatus} className="h-10 sm:h-9">
                            <Archive className="mr-2 h-4 w-4" />
                            Arquivar
                        </Button>
                    )}
                    {arquivada && (
                        <Button variant="outline" onClick={handleUnarchive} disabled={mudandoStatus} className="h-10 sm:h-9">
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Desarquivar
                        </Button>
                    )}
                </div>
            </DialogHeader>

            {/* Cabeçalho e abas ficam parados; só o conteúdo da aba rola. */}
            <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b px-4 py-2 sm:px-6">
                    <TabsList className="h-auto max-w-full justify-start overflow-x-auto">
                        <TabsTrigger value="checklist">
                            Checklist <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{checklist.feitos}/{checklist.total}</span>
                        </TabsTrigger>
                        <TabsTrigger value="info">Geral</TabsTrigger>
                        <TabsTrigger value="logistica">Logística</TabsTrigger>
                        <TabsTrigger value="despesas">
                            Despesas <Badge variant="secondary" className="ml-2">{despesas.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="avaliacoes">
                            Avaliações <Badge variant="secondary" className="ml-2">{avaliacoes.length + avaliacoesSecretaria.length}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
                        <TabsContent value="checklist">
                            <div className="space-y-4 pt-2">
                                <Accordion type="multiple" defaultValue={['antes']} className="w-full">
                                    {([['antes', 'Antes do evento'], ['dia', 'No dia do evento'], ['apos', 'Após o evento']] as const).map(([faseChecklist, titulo]) => (
                                        <FaseDoChecklist
                                            key={faseChecklist}
                                            titulo={titulo}
                                            fase={faseChecklist}
                                            formacao={formacao}
                                            desabilitado={arquivada}
                                            onMarcar={handleChecklistChange}
                                            onObservacao={handleOpenObservationModal}
                                        />
                                    ))}
                                </Accordion>
                            </div>
                        </TabsContent>
                        <TabsContent value="info">
                            <div className="space-y-6 pt-2">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="flex items-start gap-3 md:col-span-2">
                                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">Descrição</p>
                                            <p className="whitespace-pre-wrap">{formacao.descricao?.trim() || <span className="text-muted-foreground">Sem descrição.</span>}</p>
                                        </div>
                                    </div>
                                    {!!formacao.participantes && formacao.participantes > 0 && (
                                        <div className="flex items-start gap-3">
                                            <Users className="mt-0.5 h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">Nº de participantes</p>
                                                <p className="font-medium">{formacao.participantes}</p>
                                            </div>
                                        </div>
                                    )}
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
                                                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                                                    Enviar Arquivo
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                    <Separator />
                                    {anexos.length === 0 ? (
                                        <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                                            <div>
                                                <Paperclip className="h-6 w-6 mx-auto mb-2" />
                                                Nenhum anexo encontrado.
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative pl-6">
                                            <div className="absolute left-6 top-0 bottom-0 w-px bg-border"></div>
                                            {anexos.map((anexo, index) => {
                                                const isImage = anexo.url.startsWith('data:image');
                                                return (
                                                    <div key={index} className="relative mb-8">
                                                        <div className="absolute -left-[34px] top-1.5 h-4 w-4 rounded-full bg-primary border-4 border-background"></div>
                                                        <div className="pl-4">
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatDate(anexo.dataUpload, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                            <div className="flex flex-col items-start p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors group mt-1">
                                                                <div className="flex items-start justify-between w-full gap-2">
                                                                    <div className="flex items-start flex-1 min-w-0 gap-2">
                                                                        {!isImage && getFileIcon(anexo.nome)}
                                                                        <a
                                                                            href={anexo.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            download={anexo.nome}
                                                                            className="text-sm font-medium hover:underline break-words pt-0.5"
                                                                        >
                                                                            {anexo.nome}
                                                                        </a>
                                                                    </div>
                                                                    {!isArchived && (
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-7 w-7 opacity-50 group-hover:opacity-100 shrink-0"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                handleDeleteAnexo(anexo);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-4 w-4 text-destructive" />
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
                            </div>
                        </TabsContent>
                        <TabsContent value="logistica">
                            <div className="space-y-6 pt-2">
                                <div className="flex flex-wrap justify-between items-start gap-4">
                                    <h4 className="font-semibold text-lg truncate">Passagens e Hospedagem</h4>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm text-muted-foreground">Custo total de hospedagem</p>
                                        <p className="text-xl font-bold text-primary">{formatCurrency(totalHospedagem)}</p>
                                        <p className="text-xs text-muted-foreground">diária × noites (check-in a check-out)</p>
                                    </div>
                                </div>
                                <Separator />
                                {(!formacao.logistica || formacao.logistica.length === 0) ? (
                                    <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                                        <div>
                                            <Hotel className="h-6 w-6 mx-auto mb-2" />
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
                                                        <TableHead className="text-right">Hospedagem</TableHead>
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
                                                                <ValorHospedagem item={item} />
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
                                                            <span className="text-right font-bold text-primary"><ValorHospedagem item={item} /></span>
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
                            <div className="space-y-6 pt-2">
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
                                            <DollarSign className="h-6 w-6 mx-auto mb-2" />
                                            Nenhuma despesa lançada para esta formação.
                                        </div>
                                    </div>
                                ) : (
                                    <Accordion type="multiple" className="w-full space-y-4">
                                        {Object.entries(despesasAgrupadas).map(([formadorId, data]) => (
                                            <AccordionItem value={formadorId} key={formadorId} className="border rounded-md px-4">
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex items-center gap-3">
                                                        <User className="h-5 w-5 text-primary" />
                                                        <span className='text-lg font-semibold'>{data.formadorNome}</span>
                                                    </div>
                                                    <span className="text-lg font-semibold text-primary">{formatCurrency(data.total)}</span>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    {/* Uma tabela só, com o tipo numa coluna: antes era uma sanfona por tipo dentro da sanfona do formador. */}
                                                    <div className="overflow-x-auto rounded-lg border">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Data</TableHead>
                                                                    <TableHead>Tipo</TableHead>
                                                                    <TableHead>Descrição</TableHead>
                                                                    <TableHead className="text-right">Valor</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {despesaTypes.flatMap(type => data.despesasPorTipo[type] || [])
                                                                    .sort((a, b) => a.data.toMillis() - b.data.toMillis())
                                                                    .map(despesa => {
                                                                        const Icon = typeIcons[despesa.tipo] ?? Grip;
                                                                        return (
                                                                            <TableRow key={despesa.id} onClick={() => openDespesaDetails(despesa)} className="cursor-pointer">
                                                                                <TableCell className="whitespace-nowrap">{despesa.data.toDate().toLocaleDateString('pt-BR')}</TableCell>
                                                                                <TableCell className="whitespace-nowrap">
                                                                                    <span className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4 text-muted-foreground" />{despesa.tipo}</span>
                                                                                </TableCell>
                                                                                <TableCell className="text-muted-foreground">{despesa.descricao}</TableCell>
                                                                                <TableCell className="text-right font-medium">{formatCurrency(despesa.valor)}</TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </div>
                        </TabsContent>
                        <TabsContent value="avaliacoes">
                            <div className="space-y-6 pt-2">
                                {!arquivada && (
                                    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3">
                                            <Switch
                                                id="avaliacoes-switch"
                                                checked={!!formacao.avaliacoesAbertas}
                                                onCheckedChange={handleToggleAvaliacoes}
                                            />
                                            <Label htmlFor="avaliacoes-switch" className="flex flex-col gap-0.5">
                                                <span className="flex items-center gap-2 font-medium">
                                                    {formacao.avaliacoesAbertas
                                                        ? <><ToggleRight className="h-4 w-4 text-green-600" /> Avaliações abertas</>
                                                        : <><ToggleLeft className="h-4 w-4" /> Avaliações fechadas</>}
                                                </span>
                                                <span className="text-xs font-normal text-muted-foreground">
                                                    {formacao.avaliacoesAbertas
                                                        ? 'O formulário está recebendo respostas.'
                                                        : 'Quem abrir o link verá o formulário fechado.'}
                                                </span>
                                            </Label>
                                        </div>
                                        {formacao.avaliacoesAbertas && (
                                            <Button variant="outline" size="sm" className="h-10 sm:h-9" onClick={() => handleCopyLink('avaliacao')}>
                                                <Copy className="mr-2 h-4 w-4" />
                                                Copiar link do formulário
                                            </Button>
                                        )}
                                    </div>
                                )}
                                <div className='flex flex-wrap justify-between items-center gap-2'>
                                    <h4 className="font-semibold text-lg">Resultados das Avaliações</h4>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExportAvaliacoes}
                                            disabled={avaliacoes.length === 0}
                                        >
                                            <Download className="mr-2 h-4 w-4" />
                                            Exportar Participantes
                                        </Button>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/relatorio/${formacaoId}`} target="_blank">
                                                <Printer className="mr-2 h-4 w-4" />
                                                Imprimir Relatório Completo
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                                <Separator />
                                <Tabs defaultValue="geral" className='pt-2'>
                                    <TabsList className="h-auto flex flex-wrap justify-start">
                                        <TabsTrigger value="geral">Geral (Participantes)</TabsTrigger>
                                        <TabsTrigger value="secretaria">Secretaria</TabsTrigger>
                                        {formadoresComAvaliacao.map(formador => (
                                            <TabsTrigger key={formador.id} value={formador.id}>
                                                {formador.nomeCompleto.split(' ')[0]}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    <TabsContent value="geral" className="pt-4">
                                        {avaliacoes.length === 0 ? (
                                            <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                                                Nenhuma avaliação de participante recebida.
                                            </div>
                                        ) : (
                                            <AvaliacaoSummaryComponent summary={avaliacaoSummaryGeral} avaliacoes={avaliacoes} />
                                        )}
                                    </TabsContent>
                                    <TabsContent value="secretaria" className="pt-4">
                                        <AvaliacaoSecretariaComponent avaliacoes={avaliacoesSecretaria} />
                                    </TabsContent>
                                    {formadoresComAvaliacao.map(formador => (
                                        <TabsContent key={formador.id} value={formador.id} className="pt-4">
                                            <div className="flex justify-end mb-4">
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/relatorio/${formacaoId}/${formador.id}`} target="_blank">
                                                        <Printer className="mr-2 h-4 w-4" /> Gerar Relatório Individual
                                                    </Link>
                                                </Button>
                                            </div>
                                            <AvaliacaoSummaryComponent
                                                summary={calculateAvaliacaoSummary(avaliacoesPorFormador[formador.id])}
                                                avaliacoes={avaliacoesPorFormador[formador.id]}
                                                formadorName={formador.nomeCompleto.split(' ')[0]}
                                            />
                                            <div className="mt-6">
                                                <h4 className="font-semibold text-lg mb-4">Respostas Individuais ({avaliacoesPorFormador[formador.id].length})</h4>
                                                <IndividualResponseList responses={avaliacoesPorFormador[formador.id]} />
                                            </div>
                                        </TabsContent>
                                    ))}
                                </Tabs>

                            </div>
                        </TabsContent>
                </div>
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
                    <Dialog open={isObservationModalOpen} onOpenChange={setIsObservationModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Adicionar Observação</DialogTitle>
                                <DialogDescription>
                                    Adicione uma nota para o item do checklist.
                                </DialogDescription>
                            </DialogHeader>
                            <Textarea
                                value={observationText}
                                onChange={(e) => setObservationText(e.target.value)}
                                placeholder="Digite sua observação aqui..."
                                rows={5}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsObservationModalOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSaveObservation}>Salvar Observação</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
        </>
    );
}

// ---------------------------------------------------------------------------

/**
 * Hospedagem de uma linha da logística: "R$ 200 × 3 = R$ 600".
 * Sem check-in/out não dá para contar noites — mostra só a diária e avisa.
 */
function ValorHospedagem({ item }: { item: LogisticaViagem }) {
    if (!item.valorDiaria) return <span className="text-muted-foreground">N/A</span>;
    const noites = noitesDe(item);
    if (noites === 0) {
        return (
            <span className="inline-flex flex-col items-end">
                <span>{formatCurrency(item.valorDiaria)}/diária</span>
                <span className="text-xs font-normal text-muted-foreground">sem check-in/out: fora do total</span>
            </span>
        );
    }
    return (
        <span className="inline-flex flex-col items-end">
            <span>{formatCurrency(item.valorDiaria * noites)}</span>
            <span className="text-xs font-normal text-muted-foreground">
                {formatCurrency(item.valorDiaria)} × {noites} {noites === 1 ? 'noite' : 'noites'}
            </span>
        </span>
    );
}

/**
 * Uma fase do checklist (antes / no dia / após).
 *
 * Fica FORA do DetalhesFormacao de propósito: declarado dentro do render, virava um
 * componente novo a cada render, o React o desmontava e remontava a cada clique, e
 * o checkbox perdia o foco.
 */
function FaseDoChecklist({
    titulo,
    fase,
    formacao,
    desabilitado,
    onMarcar,
    onObservacao,
}: {
    titulo: string;
    fase: FaseChecklist;
    formacao: Formacao;
    desabilitado: boolean;
    onMarcar: (itemId: string, checked: boolean) => void;
    onObservacao: (itemId: string) => void;
}) {
    const items = CHECKLIST_ITENS.filter(item => item.phase === fase);
    const { feitos, total } = progressoChecklist(formacao, fase);
    const progress = total > 0 ? (feitos / total) * 100 : 0;

    return (
        <AccordionItem value={fase}>
            <AccordionTrigger>
                <div className='flex flex-col items-start gap-2'>
                    <span className='font-semibold text-base'>{titulo}</span>
                    <div className='flex items-center gap-2'>
                        <Progress value={progress} className="w-32 h-2" />
                        <span className='text-xs text-muted-foreground'>{feitos} de {total}</span>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="space-y-1 pl-1">
                    {items.map(item => {
                        const valor = formacao.checklist?.[item.id];
                        const marcado = itemMarcado(valor);
                        const observacao = typeof valor === 'object' && valor !== null ? valor.observation : '';

                        return (
                            <div key={item.id} className="flex min-h-10 items-center gap-3">
                                <Checkbox
                                    id={item.id}
                                    checked={marcado}
                                    onCheckedChange={(checked) => onMarcar(item.id, !!checked)}
                                    disabled={desabilitado}
                                />
                                <label
                                    htmlFor={item.id}
                                    className="flex-grow text-sm font-normal leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {item.label}
                                </label>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 shrink-0 text-muted-foreground"
                                    onClick={() => onObservacao(item.id)}
                                    disabled={desabilitado}
                                    aria-label={observacao ? 'Ver observação' : 'Adicionar observação'}
                                >
                                    {observacao ? <MessageSquareText className="h-4 w-4 text-primary" /> : <MessageSquare className="h-4 w-4" />}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

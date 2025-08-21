
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
import type { Formacao, Formador, Material, Anexo, FormadorStatus, Despesa, TipoDespesa, Avaliacao } from '@/lib/types';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Loader2, User, MapPin, Calendar, Paperclip, UploadCloud, File as FileIcon, Trash2, Archive, DollarSign, Info, Eye, Printer, ArrowLeft, Utensils, Car, Building, Book, Grip, Hash, Users, Star, ClipboardCheck, FileText, FileType } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DetalhesDespesa } from '@/components/despesas/detalhes-despesa';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/AppLogo';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { RelatorioFormacaoPrint } from '@/components/formacoes/relatorio-formacao-print';

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
    respostasAbertas: {
        motivos: string[];
        interesses: string[];
        observacoes: string[];
    }
}


export default function DetalhesFormacaoPage() {
  const params = useParams();
  const router = useRouter();
  const formacaoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
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

        if (formacaoData.anexos) {
            formacaoData.anexos.sort((a, b) => b.dataUpload.toMillis() - a.dataUpload.toMillis());
            setAnexos(formacaoData.anexos);
        }

        let formadoresData: Formador[] = [];
        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
            const qFormadores = query(collection(db, 'formadores'), where('__name__', 'in', formacaoData.formadoresIds));
            const formadoresSnap = await getDocs(qFormadores);
            formadoresData = formadoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
            setFormadores(formadoresData);
        }
        
        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
             const qDespesas = query(collection(db, 'despesas'), where('formacaoId', '==', formacaoId));
            const despesasSnap = await getDocs(qDespesas);
            const allDespesas = despesasSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Despesa));
            
            allDespesas.sort((a, b) => a.data.toMillis() - b.data.toMillis());
            setDespesas(allDespesas);
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
        respostasAbertas: {
            motivos: [],
            interesses: [],
            observacoes: []
        }
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

        if (avaliacao.motivoMaterialNaoAtende) summary.respostasAbertas.motivos.push(avaliacao.motivoMaterialNaoAtende);
        if (avaliacao.interesseFormacao) summary.respostasAbertas.interesses.push(avaliacao.interesseFormacao);
        if (avaliacao.observacoes) summary.respostasAbertas.observacoes.push(avaliacao.observacoes);
    }

    summary.mediaEditora = totalEditora / summary.total;
    
    return summary;
}, [avaliacoes]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Carregando relatório...</p>
      </div>
    );
  }

  if (!formacao) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
            <p className='text-xl'>Formação não encontrada.</p>
            <Button asChild variant="outline">
                <Link href="/quadro">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao Quadro
                </Link>
            </Button>
        </div>
    );
  }
  
  const formadorPrincipal = formadores.length > 0 ? formadores[0] : null;

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            padding: 1rem;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
        <div className="bg-background min-h-screen p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-start mb-8 no-print">
                    <div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/quadro">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar
                            </Link>
                        </Button>
                        <p className="text-muted-foreground mt-2 text-sm">Pré-visualização do Relatório</p>
                    </div>
                    <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir / Salvar PDF
                    </Button>
                </div>
                <div className="printable-area">
                    <RelatorioFormacaoPrint 
                        formacao={formacao}
                        formador={formadorPrincipal}
                        anexos={anexos}
                        despesas={despesas}
                        avaliacoes={avaliacoes}
                        summary={avaliacaoSummary}
                    />
                </div>
            </div>
        </div>
    </>
  );
}

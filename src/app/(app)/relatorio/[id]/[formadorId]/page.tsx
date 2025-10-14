
'use client';

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, Formador, Anexo, Despesa, Avaliacao } from '@/lib/types';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RelatorioFormacaoPrint } from '@/components/formacoes/relatorio-formacao-print';

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
    avaliacaoFormador: Record<string, number>;
    respostasAbertas: {
        motivos: string[];
        interesses: string[];
        observacoes: string[];
    }
}


export default function RelatorioIndividualPage() {
  const params = useParams();
  const formacaoId = params.id as string;
  const formadorId = params.formadorId as string;
  const [loading, setLoading] = useState(true);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formador, setFormador] = useState<Formador | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  
  const fetchData = useCallback(async () => {
    if (!formacaoId || !formadorId) return;
    setLoading(true);
    try {
        const formacaoRef = doc(db, 'formacoes', formacaoId);
        const formacaoSnap = await getDoc(formacaoRef);
        if (!formacaoSnap.exists()) {
            throw new Error("Formação não encontrada.");
        }
        const formacaoData = { id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao;
        setFormacao(formacaoData);

        if (formacaoData.anexos) {
            formacaoData.anexos.sort((a, b) => b.dataUpload.toMillis() - a.dataUpload.toMillis());
            setAnexos(formacaoData.anexos);
        }
        
        const formadorRef = doc(db, 'formadores', formadorId);
        const formadorSnap = await getDoc(formadorRef);
         if (!formadorSnap.exists()) {
            throw new Error("Formador não encontrado.");
        }
        const formadorData = { id: formadorSnap.id, ...formadorSnap.data() } as Formador;
        setFormador(formadorData);

        // Fetch and filter despesas for the specific formador
        const qDespesas = query(collection(db, 'despesas'), where('formacaoId', '==', formacaoId), where('formadorId', '==', formadorId));
        const despesasSnap = await getDocs(qDespesas);
        const despesasData = despesasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Despesa));
        despesasData.sort((a, b) => a.data.toMillis() - b.data.toMillis());
        setDespesas(despesasData);
        
        // Fetch and filter avaliacoes for the specific formador
        const qAvaliacoes = query(collection(db, 'avaliacoes'), where('formacaoId', '==', formacaoId), where('formadorId', '==', formadorId));
        const avaliacoesSnap = await getDocs(qAvaliacoes);
        const avaliacoesData = avaliacoesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Avaliacao));
        setAvaliacoes(avaliacoesData);

    } catch (error) {
        console.error('Erro ao buscar detalhes do relatório individual: ', error);
    } finally {
        setLoading(false);
    }
  }, [formacaoId, formadorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const avaliacaoSummary = useMemo<AvaliacaoSummary | null>(() => {
    if (avaliacoes.length === 0) return null;

    const summary: AvaliacaoSummary = {
        total: avaliacoes.length,
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
        respostasAbertas: { motivos: [], interesses: [], observacoes: [] }
    };

    let totalEditora = 0;
    let totalFormador = 0;
    let countFormador = 0;
    
    for (const avaliacao of avaliacoes) {
        totalEditora += Number(avaliacao.avaliacaoEditora);
        if (avaliacao.avaliacaoFormador) {
            totalFormador += Number(avaliacao.avaliacaoFormador);
            countFormador++;
            summary.avaliacaoFormador[avaliacao.avaliacaoFormador] = (summary.avaliacaoFormador[avaliacao.avaliacaoFormador] || 0) + 1;
        }

        summary.modalidade[avaliacao.modalidade] = (summary.modalidade[avaliacao.modalidade] || 0) + 1;
        summary.funcao[avaliacao.funcao] = (summary.funcao[avaliacao.funcao] || 0) + 1;
        summary.etapaEnsino[avaliacao.etapaEnsino] = (summary.etapaEnsino[avaliacao.etapaEnsino] || 0) + 1;
        avaliacao.materialTema.forEach(tema => {
            summary.materialTema[tema] = (summary.materialTema[tema] || 0) + 1;
        });
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
    summary.mediaFormador = countFormador > 0 ? totalFormador / countFormador : 0;
    return summary;
  }, [avaliacoes]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Carregando relatório individual...</p>
      </div>
    );
  }

  if (!formacao || !formador) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
            <p className='text-xl'>Relatório não encontrado.</p>
            <Button asChild variant="outline">
                <Link href="/quadro">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao Quadro
                </Link>
            </Button>
        </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-container { padding: 0; margin: 0; }
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; height: auto; padding: 0; margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>
        <div className="bg-background min-h-screen p-4 sm:p-8 print-container">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-start mb-8 no-print">
                    <div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/quadro">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar
                            </Link>
                        </Button>
                        <p className="text-muted-foreground mt-2 text-sm">Pré-visualização do Relatório Individual: {formador.nomeCompleto}</p>
                    </div>
                    <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir / Salvar PDF
                    </Button>
                </div>
                <div className="printable-area">
                    <RelatorioFormacaoPrint 
                        formacao={formacao}
                        formadores={[formador]}
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

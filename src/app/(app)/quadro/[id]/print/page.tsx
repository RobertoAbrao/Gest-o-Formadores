
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, Formador, Material, Anexo, Despesa } from '@/lib/types';
import { Loader2, Printer } from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { Button } from '@/components/ui/button';
import { RelatorioFormacaoPrint } from '@/components/formacoes/relatorio-formacao-print';

export default function PrintPage() {
  const params = useParams();
  const formacaoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formador, setFormador] = useState<Formador | null>(null);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!formacaoId) {
      setError('ID da formação não encontrado.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const formacaoRef = doc(db, 'formacoes', formacaoId);
      const formacaoSnap = await getDoc(formacaoRef);
      if (!formacaoSnap.exists()) {
        setError('Formação não encontrada.');
        setLoading(false);
        return;
      }
      const formacaoData = { id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao;
      setFormacao(formacaoData);

      if (formacaoData.anexos) {
        formacaoData.anexos.sort((a, b) => b.dataUpload.toMillis() - a.dataUpload.toMillis());
        setAnexos(formacaoData.anexos);
      }

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
        setMateriais(materiaisSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
      }

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
      }
    } catch (err) {
      console.error(err);
      setError('Falha ao carregar dados da formação.');
    } finally {
      setLoading(false);
    }
  }, [formacaoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Carregando relatório...</p>
      </div>
    );
  }

  if (error) {
    return <div className="flex h-screen w-full items-center justify-center text-red-500">{error}</div>;
  }

  if (!formacao) {
    return <div className="flex h-screen w-full items-center justify-center">Nenhuma formação para exibir.</div>;
  }
  
  const handlePrint = () => {
    window.print();
  }

  return (
    <div className="bg-background min-h-screen p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-start mb-8 no-print">
                <div>
                    <AppLogo />
                    <p className="text-muted-foreground mt-1">Pré-visualização do Relatório</p>
                </div>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                </Button>
            </div>
            <div className="printable-area">
                <RelatorioFormacaoPrint 
                    formacao={formacao}
                    formador={formador}
                    anexos={anexos}
                    despesas={despesas}
                />
            </div>
        </div>

        <style jsx global>{`
            @media print {
                .no-print {
                    display: none;
                }
                body {
                    background-color: #fff;
                }
                .printable-area {
                    margin: 0;
                    padding: 0;
                }
            }
            @page {
                size: auto;
                margin: 0.5in;
            }
        `}</style>
    </div>
  );
}

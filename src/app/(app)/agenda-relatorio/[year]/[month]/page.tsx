
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  startOfMonth,
  endOfMonth,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, ProjetoImplatancao, Lembrete } from '@/lib/types';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RelatorioAgendaPrint } from '@/components/dashboard/relatorio-agenda-print';
import Link from 'next/link';

export type CalendarEvent = {
    date: Timestamp;
    type: 'formacao' | 'projeto-marco' | 'projeto-acompanhamento' | 'lembrete';
    title: string;
    details: string;
}

export default function AgendaRelatorioPage() {
  const params = useParams();
  const router = useRouter();
  const year = parseInt(params.year as string, 10);
  const month = parseInt(params.month as string, 10);

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      setError('Data inválida fornecida.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const formacoesCol = collection(db, 'formacoes');
        const projetosCol = collection(db, 'projetos');
        const lembretesCol = collection(db, 'lembretes');

        const [formacoesSnap, projetosSnap, lembretesSnap] = await Promise.all([
            getDocs(query(formacoesCol, where('status', '!=', 'arquivado'))),
            getDocs(projetosCol),
            getDocs(query(lembretesCol, where('concluido', '==', false)))
        ]);

        const allEvents: CalendarEvent[] = [];

        // Process Formações
        formacoesSnap.docs.forEach(doc => {
            const formacao = { id: doc.id, ...doc.data() } as Formacao;
            if (formacao.dataInicio && formacao.dataInicio.toDate() >= startDate && formacao.dataInicio.toDate() <= endDate) {
                allEvents.push({ date: formacao.dataInicio, type: 'formacao', title: formacao.titulo, details: `Início - ${formacao.municipio}` });
            }
            if (formacao.dataFim && formacao.dataFim.toDate() >= startDate && formacao.dataFim.toDate() <= endDate) {
                allEvents.push({ date: formacao.dataFim, type: 'formacao', title: formacao.titulo, details: `Fim - ${formacao.municipio}` });
            }
        });

        // Process Projetos
        projetosSnap.docs.forEach(doc => {
            const projeto = { id: doc.id, ...doc.data() } as ProjetoImplatancao;
             if (projeto.dataMigracao && projeto.dataMigracao.toDate() >= startDate && projeto.dataMigracao.toDate() <= endDate) {
                allEvents.push({ date: projeto.dataMigracao, type: 'projeto-marco', title: `Migração: ${projeto.municipio}`, details: `Projeto ${projeto.versao}` });
            }
             if (projeto.dataImplantacao && projeto.dataImplantacao.toDate() >= startDate && projeto.dataImplantacao.toDate() <= endDate) {
                allEvents.push({ date: projeto.dataImplantacao, type: 'projeto-marco', title: `Implantação: ${projeto.municipio}`, details: `Projeto ${projeto.versao}` });
            }
            // Add other project dates here if they are in the range
        });
        
        // Process Lembretes
        lembretesSnap.docs.forEach(doc => {
            const lembrete = { id: doc.id, ...doc.data() } as Lembrete;
            if (lembrete.data.toDate() >= startDate && lembrete.data.toDate() <= endDate) {
                allEvents.push({ date: lembrete.data, type: 'lembrete', title: lembrete.titulo, details: 'Lembrete Pessoal' });
            }
        });
        
        allEvents.sort((a, b) => a.date.toMillis() - b.date.toMillis());
        setEvents(allEvents);

    } catch (err) {
      console.error(err);
      setError('Falha ao carregar dados do relatório.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

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

  return (
     <>
      <style jsx global>{`
        @media print {
          body {
            background-color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-container {
            padding: 0;
            margin: 0;
          }
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
            padding: 0;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
        <div className="bg-background min-h-screen p-4 sm:p-8 print-container">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-start mb-8 no-print">
                    <div>
                    <Button variant="outline" size="sm" asChild>
                            <Link href="/dashboard">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar
                            </Link>
                        </Button>
                        <p className="text-muted-foreground mt-2 text-sm">Pré-visualização do Relatório Mensal</p>
                    </div>
                    <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir / Salvar PDF
                    </Button>
                </div>
                <div className="printable-area">
                    <RelatorioAgendaPrint 
                        events={events}
                        year={year}
                        month={month}
                    />
                </div>
            </div>
        </div>
    </>
  );
}

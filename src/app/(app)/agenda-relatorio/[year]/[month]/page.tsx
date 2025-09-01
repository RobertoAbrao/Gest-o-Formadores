
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, ProjetoImplatancao, Lembrete } from '@/lib/types';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RelatorioAgendaPrint } from '@/components/dashboard/relatorio-agenda-print';
import Link from 'next/link';
import { subDays } from 'date-fns';

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
        const formacoesCol = collection(db, 'formacoes');
        const projetosCol = collection(db, 'projetos');
        const lembretesCol = collection(db, 'lembretes');
        
        const allEvents: CalendarEvent[] = [];

        // Fetch all active formations
        const activeFormacoesQuery = query(formacoesCol, where('status', '!=', 'arquivado'));
        const formacoesSnap = await getDocs(activeFormacoesQuery);
        formacoesSnap.forEach(doc => {
            const formacao = { id: doc.id, ...doc.data() } as Formacao;
            if (formacao.dataInicio) {
                allEvents.push({ date: formacao.dataInicio, type: 'formacao', title: formacao.titulo, details: `Início - ${formacao.municipio}` });
            }
            if (formacao.dataFim) {
                allEvents.push({ date: formacao.dataFim, type: 'formacao', title: formacao.titulo, details: `Fim - ${formacao.municipio}` });
            }
            if(formacao.logistica) {
              formacao.logistica.forEach(item => {
                if(item.alertaLembrete && item.diasLembrete && item.checkin) {
                  const alertDate = subDays(item.checkin.toDate(), item.diasLembrete);
                    allEvents.push({
                        date: Timestamp.fromDate(alertDate),
                        type: 'lembrete',
                        title: item.alertaLembrete,
                        details: `Lembrete para ${item.formadorNome} na formação ${formacao.titulo}`
                    });
                }
              });
            }
        });

        // Fetch all projects
        const projetosSnap = await getDocs(projetosCol);
        projetosSnap.forEach(doc => {
            const projeto = { id: doc.id, ...doc.data() } as ProjetoImplatancao;
            if (projeto.dataMigracao) allEvents.push({ date: projeto.dataMigracao, type: 'projeto-marco', title: `Migração: ${projeto.municipio}`, details: `Projeto ${projeto.versao}` });
            if (projeto.dataImplantacao) allEvents.push({ date: projeto.dataImplantacao, type: 'projeto-marco', title: `Implantação: ${projeto.municipio}`, details: `Projeto ${projeto.versao}` });
            
            if (projeto.simulados) {
              Object.keys(projeto.simulados).forEach(key => {
                  const simuladoKey = key as keyof typeof projeto.simulados;
                  const simulado = projeto.simulados![simuladoKey];
                  const numero = simuladoKey.replace('s', '');
                  if (simulado && simulado.dataInicio) allEvents.push({ date: simulado.dataInicio, type: 'projeto-acompanhamento', title: `Início Simulado ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}` });
                  if (simulado && simulado.dataFim) allEvents.push({ date: simulado.dataFim, type: 'projeto-acompanhamento', title: `Fim Simulado ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}` });
              });
            }
            if (projeto.devolutivas) {
                Object.keys(projeto.devolutivas).forEach(key => {
                    const devolutivaKey = key as keyof typeof projeto.devolutivas;
                    const devolutiva = projeto.devolutivas![devolutivaKey];
                    const numero = devolutivaKey.replace('d', '');

                    if (devolutiva && (devolutiva as any).data) { // For d4
                        allEvents.push({ date: (devolutiva as any).data, type: 'projeto-acompanhamento', title: `Devolutiva ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}` });
                    } else if (devolutiva) { // For d1, d2, d3
                        if (devolutiva.dataInicio) allEvents.push({ date: devolutiva.dataInicio, type: 'projeto-acompanhamento', title: `Início Devolutiva ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}` });
                        if (devolutiva.dataFim) allEvents.push({ date: devolutiva.dataFim, type: 'projeto-acompanhamento', title: `Fim Devolutiva ${numero}: ${projeto.municipio}`, details: `Projeto ${projeto.versao}` });
                    }
                });
            }
        });
        
        // Fetch all non-concluded reminders
        const lembretesQuery = query(lembretesCol, where('concluido', '==', false));
        const lembretesSnap = await getDocs(lembretesQuery);
        lembretesSnap.forEach(doc => {
            const lembrete = { id: doc.id, ...doc.data() } as Lembrete;
            allEvents.push({ date: lembrete.data, type: 'lembrete', title: lembrete.titulo, details: 'Lembrete Pessoal' });
        });

        const monthlyEvents = allEvents.filter(event => {
            const eventDate = event.date.toDate();
            return eventDate.getFullYear() === year && eventDate.getMonth() === month - 1;
        });
        
        monthlyEvents.sort((a, b) => a.date.toMillis() - b.date.toMillis());
        setEvents(monthlyEvents);

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

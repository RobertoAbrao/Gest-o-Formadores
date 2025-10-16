
'use client';

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, Formador } from '@/lib/types';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Printer, ArrowLeft, RefreshCw, PlusCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/AppLogo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const DIAS_DA_SEMANA = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo',
];

type AgendaRow = {
    dia: string;
    horario: string;
    area: string;
};

type AgendasState = {
    [formadorId: string]: AgendaRow[];
};

export default function FichaDevolutivaPage() {
  const params = useParams();
  const formacaoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalidade, setModalidade] = useState<'online' | 'presencial'>('online');
  const [agendas, setAgendas] = useState<AgendasState>({});

  const fetchData = useCallback(async () => {
    if (!formacaoId) return;
    setLoading(true);
    try {
        const formacaoRef = doc(db, 'formacoes', formacaoId);
        const formacaoSnap = await getDoc(formacaoRef);
        if (!formacaoSnap.exists()) {
            throw new Error("Formação não encontrada.");
        }
        const formacaoData = { id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao;
        setFormacao(formacaoData);

        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
            const qFormadores = query(collection(db, 'formadores'), where('__name__', 'in', formacaoData.formadoresIds));
            const formadoresSnap = await getDocs(qFormadores);
            const formadoresData = formadoresSnap.docs.map(d => ({ id: d.id, ...d.data() } as Formador));
            setFormadores(formadoresData);
            
            const initialAgendas: AgendasState = {};
            formadoresData.forEach(f => {
                initialAgendas[f.id] = [{ dia: '', horario: '', area: '' }];
            });
            setAgendas(initialAgendas);

        } else {
            setFormadores([]);
        }

    } catch (error: any) {
        console.error('Erro ao buscar detalhes da formação: ', error);
        setError(error.message);
    } finally {
        setLoading(false);
    }
  }, [formacaoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleAddRow = (formadorId: string) => {
    setAgendas(prev => ({
        ...prev,
        [formadorId]: [...(prev[formadorId] || []), { dia: '', horario: '', area: '' }]
    }));
  };
  
  const handleAgendaChange = (formadorId: string, rowIndex: number, field: keyof AgendaRow, value: string) => {
      setAgendas(prev => {
          const newAgendas = { ...prev };
          const formadorAgenda = [...(newAgendas[formadorId] || [])];
          if (formadorAgenda[rowIndex]) {
              formadorAgenda[rowIndex] = { ...formadorAgenda[rowIndex], [field]: value };
          }
          newAgendas[formadorId] = formadorAgenda;
          return newAgendas;
      });
  };

  const generalSchedule = useMemo(() => {
    const allEntries: (AgendaRow & { formadorNome: string })[] = [];

    for (const formadorId in agendas) {
      const formador = formadores.find(f => f.id === formadorId);
      if (formador) {
        agendas[formadorId].forEach(row => {
          if (row.dia && row.horario) { // Only include filled rows
            allEntries.push({
              ...row,
              formadorNome: formador.nomeCompleto,
            });
          }
        });
      }
    }

    const groupedByDay = allEntries.reduce((acc, entry) => {
        if (!acc[entry.dia]) {
            acc[entry.dia] = [];
        }
        acc[entry.dia].push(entry);
        return acc;
    }, {} as Record<string, (AgendaRow & { formadorNome: string })[]>);

    // Sort days
    const sortedDays = DIAS_DA_SEMANA.filter(day => groupedByDay[day]);
    
    return sortedDays.map(day => ({
        day,
        entries: groupedByDay[day].sort((a,b) => a.horario.localeCompare(b.horario))
    }));

  }, [agendas, formadores]);


  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Carregando ficha...</p>
      </div>
    );
  }

  if (error) {
    return <div className="flex h-screen w-full items-center justify-center text-red-500">{error}</div>;
  }
  
  if (!formacao) {
     return <div className="flex h-screen w-full items-center justify-center">Formação não encontrada.</div>;
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background-color: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-container { padding: 0; margin: 0; }
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; height: auto; padding: 1rem; margin: 0; }
          .no-print { display: none !important; }
          .print-only { visibility: visible !important; display: inline !important; }
          .editable-field { border-bottom: 1px dashed #ccc; padding: 2px; }
          .print-table th, .print-table td { border: 1px solid #ddd; padding: 8px; }
          .print-table { border-collapse: collapse; width: 100%; }
        }
      `}</style>
        <div className="bg-muted/30 min-h-screen p-4 sm:p-8 print-container">
            <div className="max-w-4xl mx-auto bg-card p-6 rounded-lg shadow-sm">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-8 no-print">
                    <div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/quadro">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar ao Quadro
                            </Link>
                        </Button>
                        <p className="text-muted-foreground mt-2 text-sm">Pré-visualização da Ficha de Devolutiva</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setModalidade(modalidade === 'online' ? 'presencial' : 'online')}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Alterar para {modalidade === 'online' ? 'Presencial' : 'Online'}
                        </Button>
                        <Button onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir / Salvar PDF
                        </Button>
                    </div>
                </div>
                <div className="printable-area bg-white text-black font-sans space-y-6">
                    <header className="flex justify-between items-center pb-4 border-b-2">
                        <AppLogo textClassName='text-2xl' iconClassName='h-10 w-10' />
                        <h2 
                          className="text-xl font-bold text-right editable-field" 
                          contentEditable 
                          suppressContentEditableWarning
                        >
                          Divulgação de Links - {formacao.titulo}
                        </h2>
                    </header>
                    
                    <section>
                         <p 
                           className="text-sm editable-field"
                           contentEditable
                           suppressContentEditableWarning
                         >
                            Prezadas Diretoria de Formação e Equipe Pedagógica,
                            <br />
                            Informamos a agenda e os links de acesso para as Formações On-line focadas no Simulado X de cada ano/área, conforme o cronograma abaixo.
                        </p>
                    </section>

                    <section className='bg-gray-100 p-4 rounded-md text-sm'>
                        <h3 className="font-bold mb-2">Data e Horário Comum para Todas as Formações:</h3>
                        <p>
                            • <strong>Quando:</strong> <span className="editable-field" contentEditable suppressContentEditableWarning>Segunda-feira, 13 de outubro</span>
                        </p>
                        <p>
                            • <strong>Horário:</strong> <span className="editable-field" contentEditable suppressContentEditableWarning>7:00 – 8:30pm (19h00 às 20h30)</span>
                        </p>
                        <p className="mt-2 text-xs">Pedimos a gentileza de acessar o link correspondente ao seu ano/área de atuação.</p>
                    </section>
                    
                    {modalidade === 'presencial' && (
                        <section>
                             <h3 className="text-lg font-bold mb-2">Cronograma Geral do Evento</h3>
                             <div className="border rounded-lg overflow-hidden">
                                <Table className="print-table">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className='w-[20%]'>Dia</TableHead>
                                            <TableHead className='w-[20%]'>Horário</TableHead>
                                            <TableHead>Ano/Área</TableHead>
                                            <TableHead className='w-[25%]'>Formador(a)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {generalSchedule.length > 0 ? (
                                            generalSchedule.map(({ day, entries }) => (
                                                entries.map((entry, index) => (
                                                    <TableRow key={`${day}-${index}`}>
                                                        {index === 0 && <TableCell rowSpan={entries.length} className="font-medium align-top">{day}</TableCell>}
                                                        <TableCell>{entry.horario}</TableCell>
                                                        <TableCell>{entry.area}</TableCell>
                                                        <TableCell>{entry.formadorNome}</TableCell>
                                                    </TableRow>
                                                ))
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-24">Nenhuma atividade agendada. Preencha as agendas individuais.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                             </div>
                        </section>
                    )}

                    <section>
                        <h3 className="text-lg font-bold mb-2">
                            {modalidade === 'online' ? 'Links de Acesso à Formação (Google Meet)' : 'Agenda Individual da Formação'}
                        </h3>
                        {modalidade === 'online' ? (
                            <div className="space-y-6">
                                <div className="border rounded-lg overflow-hidden">
                                    <Table className="print-table">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[25%]">Ano/Área</TableHead>
                                                <TableHead className="w-[25%]">Formador(a)</TableHead>
                                                <TableHead>Link da Videochamada (Google Meet)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {formadores.map((formador) => (
                                                <TableRow key={formador.id}>
                                                    <TableCell className="editable-field" contentEditable suppressContentEditableWarning></TableCell>
                                                    <TableCell>{formador.nomeCompleto}</TableCell>
                                                    <TableCell className="editable-field" contentEditable suppressContentEditableWarning></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div>
                                     <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                        <User className="h-5 w-5" />
                                        Equipe de Formadores
                                     </h3>
                                     <div className="border rounded-lg overflow-hidden">
                                        <Table className="print-table">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[30%]">Formador(a)</TableHead>
                                                    <TableHead>Currículo</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                 {formadores.map((formador) => (
                                                    <TableRow key={formador.id}>
                                                        <TableCell className='font-semibold'>{formador.nomeCompleto}</TableCell>
                                                        <TableCell className="text-xs text-gray-600 whitespace-pre-wrap">{formador.curriculo || 'Currículo não informado.'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                     </div>
                                </div>
                            </div>
                           ) : (
                            <div className="space-y-6">
                                {formadores.map(formador => (
                                    <Card key={formador.id}>
                                        <CardHeader>
                                            <CardTitle>{formador.nomeCompleto}</CardTitle>
                                            {formador.curriculo && (
                                                <CardDescription className="text-xs text-muted-foreground whitespace-pre-wrap pt-1">
                                                    {formador.curriculo}
                                                </CardDescription>
                                            )}
                                        </CardHeader>
                                        <CardContent>
                                            <Table className="print-table">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className='w-[30%]'>Dia da Semana</TableHead>
                                                        <TableHead className='w-[25%]'>Horário</TableHead>
                                                        <TableHead>Ano/Área</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(agendas[formador.id] || []).map((agendaRow, rowIndex) => (
                                                        <TableRow key={`agenda-row-${formador.id}-${rowIndex}`}>
                                                            <TableCell>
                                                                <Select
                                                                    value={agendaRow.dia || ''}
                                                                    onValueChange={(value) => handleAgendaChange(formador.id, rowIndex, 'dia', value)}
                                                                >
                                                                    <SelectTrigger className="w-full no-print">
                                                                        <SelectValue placeholder="Selecione..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {DIAS_DA_SEMANA.map(dia => (
                                                                            <SelectItem key={dia} value={dia}>{dia}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <span className="hidden print-only">{agendaRow.dia}</span>
                                                            </TableCell>
                                                            <TableCell 
                                                                className="editable-field" 
                                                                contentEditable 
                                                                suppressContentEditableWarning
                                                                onBlur={(e) => handleAgendaChange(formador.id, rowIndex, 'horario', e.currentTarget.textContent || '')}
                                                            />
                                                            <TableCell 
                                                                className="editable-field" 
                                                                contentEditable 
                                                                suppressContentEditableWarning
                                                                onBlur={(e) => handleAgendaChange(formador.id, rowIndex, 'area', e.currentTarget.textContent || '')}
                                                            />
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <div className="pt-4 text-right no-print">
                                                <Button size="sm" variant="outline" onClick={() => handleAddRow(formador.id)}>
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Horário
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                           )}
                    </section>
                    
                    <footer className="text-xs text-gray-500 pt-4 border-t">
                        <strong className='text-gray-600'>Atenção:</strong> A Editora LT informa que não se responsabiliza pela divulgação indevida dos links gerados para a participação do encontro, tampouco com eventuais invasões virtuais que possam comprometer a formação da equipe gestora da rede de ensino do Município.
                    </footer>
                </div>
            </div>
        </div>
    </>
  );
}

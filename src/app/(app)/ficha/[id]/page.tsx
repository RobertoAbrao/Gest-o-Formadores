
'use client';

import {
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao } from '@/lib/types';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, Printer, ArrowLeft, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/AppLogo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function FichaDevolutivaPage() {
  const params = useParams();
  const formacaoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!formacaoId) return;
    setLoading(true);
    try {
        const formacaoRef = doc(db, 'formacoes', formacaoId);
        const formacaoSnap = await getDoc(formacaoRef);
        if (!formacaoSnap.exists()) {
            throw new Error("Formação não encontrada.");
        }
        setFormacao({ id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao);
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
          .editable-field { border-bottom: 1px dashed #ccc; padding: 2px; }
          .print-table th, .print-table td { border: 1px solid #ddd; padding: 8px; }
          .print-table { border-collapse: collapse; width: 100%; }
        }
      `}</style>
        <div className="bg-muted/30 min-h-screen p-4 sm:p-8 print-container">
            <div className="max-w-4xl mx-auto bg-card p-6 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-8 no-print">
                    <div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/quadro">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar ao Quadro
                            </Link>
                        </Button>
                        <p className="text-muted-foreground mt-2 text-sm">Pré-visualização da Ficha de Devolutiva</p>
                    </div>
                    <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir / Salvar PDF
                    </Button>
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
                        <h3 className="font-bold mb-2 flex items-center gap-2"><Calendar className="h-4 w-4"/> Data e Horário Comum para Todas as Formações:</h3>
                        <p>
                            • <strong>Quando:</strong> <span className="editable-field" contentEditable suppressContentEditableWarning>Segunda-feira, 13 de outubro</span>
                        </p>
                        <p>
                            • <strong>Horário:</strong> <span className="editable-field" contentEditable suppressContentEditableWarning>7:00 – 8:30pm (19h00 às 20h30)</span>
                        </p>
                        <p className="mt-2 text-xs">Pedimos a gentileza de acessar o link correspondente ao seu ano/área de atuação.</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold mb-2">Links de Acesso à Formação (Google Meet)</h3>
                        <div className="border rounded-lg overflow-hidden">
                            <Table className="print-table">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className='w-[30%]'>Ano/Área</TableHead>
                                        <TableHead className='w-[20%]'>Formador(a)</TableHead>
                                        <TableHead>Link da Videochamada (Google Meet)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[...Array(6)].map((_, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="editable-field" contentEditable suppressContentEditableWarning></TableCell>
                                            <TableCell className="editable-field" contentEditable suppressContentEditableWarning></TableCell>
                                            <TableCell className="editable-field" contentEditable suppressContentEditableWarning></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
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

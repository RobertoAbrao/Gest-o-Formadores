

'use client';

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, Formador, FichaDevolutiva, AgendasState, AgendaRow, LinkOnline } from '@/lib/types';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Printer, ArrowLeft, RefreshCw, PlusCircle, User, Save, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/AppLogo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isValid, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


const DIAS_DA_SEMANA = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo',
];

// Componente para renderizar texto com links
const LinkifiedText = ({ text }: { text: string }) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return (
        <>
            {parts.map((part, i) =>
                urlRegex.test(part) ? (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {part}
                    </a>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
};


export default function FichaDevolutivaPage() {
  const params = useParams();
  const formacaoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Dados da Formação
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  
  // Estado da Ficha (dados que podem ser salvos)
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [modalidade, setModalidade] = useState<'online' | 'presencial'>('online');
  const [introducao, setIntroducao] = useState('');
  const [horario, setHorario] = useState('19h00 às 20h30');
  const [endereco, setEndereco] = useState('');
  const [agendas, setAgendas] = useState<AgendasState>({});
  const [linksOnline, setLinksOnline] = useState<LinkOnline[]>([]);
  
  // Estado para formadores genéricos
  const [formadoresGenericos, setFormadoresGenericos] = useState<{id: string, nome: string}[]>([]);
  const [agendasGenericas, setAgendasGenericas] = useState<AgendasState>({});


  const [error, setError] = useState<string | null>(null);

  const initializeDefaultState = (formacaoData: Formacao, formadoresData: Formador[]) => {
      const textoModalidade = modalidade === 'online' ? ' e os links de acesso' : '';
      setIntroducao(`Prezadas Diretoria de Formação e Equipe Pedagógica,\nInformamos a agenda${textoModalidade} para a formação "${formacaoData.titulo}", conforme o cronograma abaixo.`);
      setEndereco('Endereço (Anos Iniciais): Escola Municipal Pedro Paulo Corte Filho – Av. Salvador, Cidade Universitária, 221 - Jardim Universitário, Luís Eduardo Magalhães – BA\nEndereço (Anos Finais): Colégio Municipal Ângelo Bosa - R. Morro do Chapéu, 1298 - Bairro Floraes Lea III, Luís Eduardo Magalhães - BA');

      const initialAgendas: AgendasState = {};
      formadoresData.forEach(f => {
          initialAgendas[f.id] = [{ dia: '', horario: '', area: '', participantes: 0 }];
      });
      setAgendas(initialAgendas);
      
      setAgendasGenericas({});
      setFormadoresGenericos([]);

      const initialLinks: LinkOnline[] = formadoresData.map(f => ({
          id: f.id,
          formadorNome: f.nomeCompleto,
          anoArea: '',
          linkUrl: '',
      }));
      setLinksOnline(initialLinks);
  };

  const fetchData = useCallback(async () => {
    if (!formacaoId) return;
    setLoading(true);
    try {
        const formacaoRef = doc(db, 'formacoes', formacaoId);
        const formacaoSnap = await getDoc(formacaoRef);
        if (!formacaoSnap.exists()) throw new Error("Formação não encontrada.");
        
        const formacaoData = { id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao;
        setFormacao(formacaoData);

        let formadoresData: Formador[] = [];
        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
            const qFormadores = query(collection(db, 'formadores'), where('__name__', 'in', formacaoData.formadoresIds));
            const formadoresSnap = await getDocs(qFormadores);
            formadoresData = formadoresSnap.docs.map(d => ({ id: d.id, ...d.data() } as Formador));
            setFormadores(formadoresData);
        } else {
            setFormadores([]);
        }

        // Tenta buscar a ficha salva
        const fichaRef = doc(db, 'fichas_devolutivas', formacaoId);
        const fichaSnap = await getDoc(fichaRef);

        if (fichaSnap.exists()) {
            const fichaData = fichaSnap.data() as FichaDevolutiva;
            setFichaId(fichaData.id);
            setModalidade(fichaData.modalidade);
            setIntroducao(fichaData.introducao);
            setHorario(fichaData.horario);
            setEndereco(fichaData.endereco);
            setAgendas(fichaData.agendas || {});
            setLinksOnline(fichaData.links?.map((l, i) => ({ ...l, id: `loaded_${i}`})) || []);
            setFormadoresGenericos(fichaData.formadoresGenericos || []);
            setAgendasGenericas(fichaData.agendasGenericas || {});
        } else {
            // Se não existir, inicializa com os padrões
            initializeDefaultState(formacaoData, formadoresData);
        }

    } catch (error: any) {
        console.error('Erro ao buscar detalhes da ficha: ', error);
        setError(error.message);
    } finally {
        setLoading(false);
    }
  }, [formacaoId, modalidade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveChanges = async () => {
    if (!formacao) return;
    setSaving(true);
    try {
      const fichaData: Partial<FichaDevolutiva> = {
        formacaoId: formacao.id,
        modalidade,
        introducao,
        horario,
        endereco,
        agendas,
        links: linksOnline.map(({ id, ...rest }) => rest), // Strip out the id before saving
        agendasGenericas,
        formadoresGenericos,
      };

      const fichaRef = doc(db, 'fichas_devolutivas', formacao.id);
      await setDoc(fichaRef, { ...fichaData, lastUpdated: serverTimestamp() }, { merge: true });

      if(!fichaId) setFichaId(formacao.id);

      toast({ title: 'Sucesso!', description: 'Ficha salva com sucesso.' });
    } catch (error) {
      console.error("Erro ao salvar a ficha: ", error);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: 'Não foi possível salvar as alterações da ficha.' });
    } finally {
      setSaving(false);
    }
  };
  
  const handleAddRow = (formadorId: string, isGeneric = false) => {
    const setState = isGeneric ? setAgendasGenericas : setAgendas;
    setState(prev => ({
        ...prev,
        [formadorId]: [...(prev[formadorId] || []), { dia: '', horario: '', area: '', participantes: 0 }]
    }));
  };
  
  const handleAgendaChange = (formadorId: string, rowIndex: number, field: keyof AgendaRow, value: string, isGeneric = false) => {
      const setState = isGeneric ? setAgendasGenericas : setAgendas;
      setState(prev => {
          const newAgendas = { ...prev };
          const formadorAgenda = [...(newAgendas[formadorId] || [])];
          if (formadorAgenda[rowIndex]) {
              const updatedRow = { ...formadorAgenda[rowIndex] };
              if (field === 'participantes') {
                  const numValue = parseInt(value, 10);
                  (updatedRow[field] as any) = isNaN(numValue) ? 0 : numValue;
              } else {
                  (updatedRow[field] as any) = value;
              }
              formadorAgenda[rowIndex] = updatedRow;
          }
          newAgendas[formadorId] = formadorAgenda;
          return newAgendas;
      });
  };

  const handleLinkChange = (index: number, field: keyof Omit<LinkOnline, 'id'>, value: string) => {
      const newLinks = [...linksOnline];
      if (newLinks[index]) {
          (newLinks[index] as any)[field] = value;
          setLinksOnline(newLinks);
      }
  };
  
    const handleAddGenericFormador = () => {
        const newId = `generico_${Date.now()}`;
        // Find the highest number used in existing generic formador names
        const existingNumbers = formadoresGenericos.map(f => {
            const match = f.nome.match(/Formador (\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        });
        const nextNumber = existingNumbers.length > 0 ? Math.max(0, ...existingNumbers) + 1 : 1;
        const newName = `Formador ${nextNumber}`;

        setFormadoresGenericos(prev => [...prev, { id: newId, nome: newName }]);
        setAgendasGenericas(prev => ({ ...prev, [newId]: [{ dia: '', horario: '', area: '', participantes: 0 }] }));
    }

    const handleAddGenericLink = () => {
        // Find the highest number used in existing generic formador names
        const existingGenericNames = linksOnline.filter(l => l.formadorNome.startsWith('Formador '));
        const existingNumbers = existingGenericNames.map(l => {
            const match = l.formadorNome.match(/Formador (\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        });
        const nextNumber = existingNumbers.length > 0 ? Math.max(0, ...existingNumbers) + 1 : 1;
        const newName = `Formador ${nextNumber}`;

        const newLink: LinkOnline = {
            id: `generico_link_${Date.now()}`,
            formadorNome: newName,
            anoArea: '',
            linkUrl: '',
        };

        setLinksOnline(prev => [...prev, newLink]);
    }
  
  const handleRemoveGenericFormador = (idToRemove: string) => {
    setFormadoresGenericos(prev => prev.filter(f => f.id !== idToRemove));
    setAgendasGenericas(prev => {
        const newAgendas = { ...prev };
        delete newAgendas[idToRemove];
        return newAgendas;
    });
  }

  const handleRemoveGenericLink = (idToRemove: string) => {
    setLinksOnline(prev => prev.filter(l => l.id !== idToRemove));
  };


  const generalSchedule = useMemo(() => {
    const allEntries: (AgendaRow & { formadorNome: string })[] = [];

    const processAgendas = (agendaState: AgendasState, formadorList: { id: string, nomeCompleto: string }[] | { id: string, nome: string }[]) => {
        for (const formadorId in agendaState) {
            const formador = formadorList.find(f => f.id === formadorId);
            if (formador) {
                agendaState[formadorId].forEach(row => {
                    if (row.dia && row.horario) {
                        allEntries.push({
                            ...row,
                            formadorNome: (formador as any).nomeCompleto || (formador as any).nome,
                        });
                    }
                });
            }
        }
    };
    
    processAgendas(agendas, formadores);
    processAgendas(agendasGenericas, formadoresGenericos);

    const groupedByDay = allEntries.reduce((acc, entry) => {
        if (!acc[entry.dia]) {
            acc[entry.dia] = [];
        }
        acc[entry.dia].push(entry);
        return acc;
    }, {} as Record<string, (AgendaRow & { formadorNome: string })[]>);

    const sortedDays = DIAS_DA_SEMANA.filter(day => groupedByDay[day]);
    
    return sortedDays.map(day => ({
        day,
        entries: groupedByDay[day].sort((a,b) => a.horario.localeCompare(b.horario))
    }));

  }, [agendas, agendasGenericas, formadores, formadoresGenericos]);


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

  const formattedPeriod = (() => {
    const startDate = formacao.dataInicio?.toDate();
    const endDate = formacao.dataFim?.toDate();

    if (!startDate || !isValid(startDate)) {
      return 'Data a confirmar';
    }

    if (!endDate || !isValid(endDate) || isSameDay(startDate, endDate)) {
      return format(startDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
    }

    return `De ${format(startDate, 'dd', { locale: ptBR })} a ${format(endDate, "dd 'de' MMMM", { locale: ptBR })}`;
  })();

  const dynamicTitle = modalidade === 'online' 
    ? `Divulgação de Links - ${formacao.titulo}` 
    : `Divulgação - ${formacao.titulo}`;

  const dynamicFooter = modalidade === 'online'
    ? 'Pedimos a gentileza de acessar o link correspondente ao seu ano/área de atuação.'
    : 'Pedimos a gentileza de se dirigir ao local correspondente ao seu ano/área de atuação.';

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
          .editable-textarea {
             padding: 8px;
             width: 100%;
             white-space: pre-wrap; /* Preserve line breaks */
          }
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
                        <Button variant="outline" onClick={handleSaveChanges} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Alterações
                        </Button>
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
                        <h2 className="text-xl font-bold text-right">
                          {dynamicTitle}
                        </h2>
                    </header>
                    
                    <section>
                         <Textarea
                           value={introducao}
                           onChange={(e) => setIntroducao(e.target.value)}
                           className="w-full text-sm no-print"
                           rows={3}
                         />
                         <div className="hidden print-only editable-textarea">{introducao}</div>
                    </section>

                    <section className='bg-gray-100 p-4 rounded-md text-sm'>
                        <h3 className="font-bold mb-2">Data e Horário Comum para Todas as Formações:</h3>
                         <p className="flex items-center gap-2">
                            • <strong>Quando:</strong> <span className="print-only">{formattedPeriod}</span>
                            <span className="no-print">{formattedPeriod}</span>
                        </p>
                        <p className="flex items-center gap-2">
                            • <strong>Horário:</strong> 
                            <Input
                                value={horario}
                                onChange={e => setHorario(e.target.value)}
                                className="w-48 text-sm p-1 h-8 no-print"
                            />
                            <span className="hidden print-only">{horario}</span>
                        </p>
                        <p className="mt-2 text-xs">
                          {dynamicFooter}
                        </p>
                    </section>
                    
                     {modalidade === 'presencial' && (
                        <section>
                             <h3 className="text-lg font-bold mb-2">Endereço do Evento</h3>
                              <Textarea
                                value={endereco}
                                onChange={(e) => setEndereco(e.target.value)}
                                className="w-full text-sm no-print"
                                rows={4}
                              />
                               <div className="hidden print-only editable-textarea">{endereco}</div>
                        </section>
                    )}

                    {modalidade === 'presencial' && (
                        <section>
                             <h3 className="text-lg font-bold mb-2">Cronograma Geral do Evento</h3>
                             <div className="border rounded-lg overflow-hidden">
                                <Table className="print-table">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className='w-[20%]'>Dia</TableHead>
                                            <TableHead className='w-[15%]'>Horário</TableHead>
                                            <TableHead>Ano/Área</TableHead>
                                            <TableHead className='w-[25%]'>Formador(a)</TableHead>
                                            <TableHead className='w-[15%] text-right'>Participantes</TableHead>
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
                                                        <TableCell className="text-right">{entry.participantes || 0}</TableCell>
                                                    </TableRow>
                                                ))
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">Nenhuma atividade agendada. Preencha as agendas individuais.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                             </div>
                        </section>
                    )}

                    <section>
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="text-lg font-bold">
                                {modalidade === 'online' ? 'Links de Acesso à Formação (Google Meet)' : 'Agenda Individual da Formação'}
                            </h3>
                             <Button size="sm" variant="outline" className="no-print" onClick={modalidade === 'online' ? handleAddGenericLink : handleAddGenericFormador}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Formador Genérico
                            </Button>
                        </div>
                        {modalidade === 'online' ? (
                            <div className="space-y-6">
                                <div className="border rounded-lg overflow-hidden">
                                    <Table className="print-table">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[25%]">Ano/Área</TableHead>
                                                <TableHead className="w-[25%]">Formador(a)</TableHead>
                                                <TableHead>Link da Videochamada (Google Meet)</TableHead>
                                                <TableHead className="w-[50px] no-print"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {linksOnline.map((link, index) => (
                                                <TableRow key={link.id || index}>
                                                    <TableCell>
                                                      <Input
                                                          value={link.anoArea}
                                                          onChange={(e) => handleLinkChange(index, 'anoArea', e.target.value)}
                                                          className="w-full text-sm no-print"
                                                      />
                                                      <span className="hidden print-only">{link.anoArea}</span>
                                                    </TableCell>
                                                    <TableCell>{link.formadorNome}</TableCell>
                                                    <TableCell>
                                                        <Textarea
                                                            value={link.linkUrl}
                                                            onChange={(e) => handleLinkChange(index, 'linkUrl', e.target.value)}
                                                            className="w-full text-sm no-print min-h-[60px]"
                                                            rows={2}
                                                        />
                                                        <div className="hidden print-only whitespace-pre-wrap">
                                                            <LinkifiedText text={link.linkUrl} />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="no-print">
                                                        {link.formadorNome.startsWith('Formador ') && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveGenericLink(link.id!)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
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
                                                        <TableHead className='w-[25%]'>Dia da Semana</TableHead>
                                                        <TableHead className='w-[20%]'>Horário</TableHead>
                                                        <TableHead>Ano/Área</TableHead>
                                                        <TableHead className='w-[20%]'>Participantes</TableHead>
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
                                                            <TableCell>
                                                                <Input value={agendaRow.horario} onChange={(e) => handleAgendaChange(formador.id, rowIndex, 'horario', e.target.value)} className="w-full text-sm no-print h-9" placeholder="08h00-12h00" />
                                                                <span className="hidden print-only">{agendaRow.horario}</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input value={agendaRow.area} onChange={(e) => handleAgendaChange(formador.id, rowIndex, 'area', e.target.value)} className="w-full text-sm no-print h-9" placeholder="Anos Iniciais" />
                                                                <span className="hidden print-only">{agendaRow.area}</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input type="number" value={agendaRow.participantes || ''} onChange={(e) => handleAgendaChange(formador.id, rowIndex, 'participantes', e.target.value)} className="w-full text-sm no-print h-9" placeholder="0"/>
                                                                <span className="hidden print-only">{agendaRow.participantes || ''}</span>
                                                            </TableCell>
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
                                {formadoresGenericos.map(formador => (
                                    <Card key={formador.id} className="border-dashed">
                                        <CardHeader>
                                            <div className='flex justify-between items-center'>
                                                <CardTitle>{formador.nome}</CardTitle>
                                                <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => handleRemoveGenericFormador(formador.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <Table className="print-table">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className='w-[25%]'>Dia da Semana</TableHead>
                                                        <TableHead className='w-[20%]'>Horário</TableHead>
                                                        <TableHead>Ano/Área</TableHead>
                                                        <TableHead className='w-[20%]'>Participantes</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(agendasGenericas[formador.id] || []).map((agendaRow, rowIndex) => (
                                                        <TableRow key={`agenda-row-${formador.id}-${rowIndex}`}>
                                                            <TableCell>
                                                                <Select
                                                                    value={agendaRow.dia || ''}
                                                                    onValueChange={(value) => handleAgendaChange(formador.id, rowIndex, 'dia', value, true)}
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
                                                            <TableCell>
                                                                <Input value={agendaRow.horario} onChange={(e) => handleAgendaChange(formador.id, rowIndex, 'horario', e.target.value, true)} className="w-full text-sm no-print h-9" placeholder="08h00-12h00" />
                                                                <span className="hidden print-only">{agendaRow.horario}</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input value={agendaRow.area} onChange={(e) => handleAgendaChange(formador.id, rowIndex, 'area', e.target.value, true)} className="w-full text-sm no-print h-9" placeholder="Anos Finais" />
                                                                <span className="hidden print-only">{agendaRow.area}</span>
                                                            </TableCell>
                                                             <TableCell>
                                                                <Input type="number" value={agendaRow.participantes || ''} onChange={(e) => handleAgendaChange(formador.id, rowIndex, 'participantes', e.target.value, true)} className="w-full text-sm no-print h-9" placeholder="0"/>
                                                                <span className="hidden print-only">{agendaRow.participantes || ''}</span>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <div className="pt-4 text-right no-print">
                                                <Button size="sm" variant="outline" onClick={() => handleAddRow(formador.id, true)}>
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


'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Archive } from 'lucide-react';
import type { Formacao } from '@/lib/types';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DetalhesFormacao } from '@/components/formacoes/detalhes-formacao';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function ArquivadosPage() {
  const [formacoes, setFormacoes] = useState<Formacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedFormacao, setSelectedFormacao] = useState<Formacao | null>(null);
  const { toast } = useToast();

  const fetchFormacoesArquivadas = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'formacoes'),
        where('status', '==', 'arquivado'),
      );
      const querySnapshot = await getDocs(q);
      const formacoesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formacao));
      setFormacoes(formacoesData);
    } catch (error) {
      console.error("Error fetching archived formations:", error);
      toast({ variant: 'destructive', title: 'Erro ao buscar arquivos', description: 'Não foi possível carregar a lista de formações arquivadas.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFormacoesArquivadas();
  }, [fetchFormacoesArquivadas]);
  
  const handleOpenDetails = (formacao: Formacao) => {
    setSelectedFormacao(formacao);
    setIsDetailDialogOpen(true);
  };

  const handleDetailDialogChange = (open: boolean) => {
    setIsDetailDialogOpen(open);
    if (!open) {
      setSelectedFormacao(null);
      fetchFormacoesArquivadas();
    }
  }

  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('pt-BR');
  }

  const groupedFormacoes = useMemo(() => {
    const groups: Record<string, Formacao[]> = {};
    
    formacoes.forEach(f => {
      const year = f.dataFim ? f.dataFim.toDate().getFullYear().toString() : 'Sem Data';
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(f);
    });

    // Ordena as formações dentro de cada ano pela data de fim decrescente
    Object.keys(groups).forEach(year => {
      groups[year].sort((a, b) => (b.dataFim?.toMillis() ?? 0) - (a.dataFim?.toMillis() ?? 0));
    });

    return groups;
  }, [formacoes]);

  const years = useMemo(() => Object.keys(groupedFormacoes).sort((a, b) => b.localeCompare(a)), [groupedFormacoes]);

  if (loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6 h-full">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Formações Arquivadas</h1>
                <p className="text-muted-foreground">
                    Consulte o histórico de formações organizadas por ano de conclusão.
                </p>
            </div>
        </div>
      
      {formacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <Archive className="w-12 h-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma formação arquivada</h3>
              <p className="text-sm text-muted-foreground text-center">As formações concluídas aparecerão aqui após serem arquivadas no Quadro.</p>
          </div>
      ) : (
        <Accordion type="multiple" defaultValue={[years[0]]} className="w-full space-y-4">
            {years.map(year => (
                <AccordionItem value={year} key={year} className="border rounded-lg px-4 bg-card shadow-sm">
                    <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-primary" />
                            <span className="text-xl font-bold">{year}</span>
                            <Badge variant="secondary">{groupedFormacoes[year].length} {groupedFormacoes[year].length === 1 ? 'item' : 'itens'}</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="border rounded-lg overflow-hidden mt-2">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Título</TableHead>
                                        <TableHead className="hidden lg:table-cell">Município</TableHead>
                                        <TableHead className="hidden md:table-cell">Data de Conclusão</TableHead>
                                        <TableHead className="w-[100px] text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedFormacoes[year].map((formacao) => (
                                        <TableRow key={formacao.id} className="group">
                                            <TableCell className="font-medium">{formacao.titulo}</TableCell>
                                            <TableCell className="hidden lg:table-cell text-muted-foreground">{formacao.municipio}</TableCell>
                                            <TableCell className="hidden md:table-cell text-muted-foreground">
                                                {formatDate(formacao.dataFim)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge 
                                                    variant="outline" 
                                                    className="cursor-pointer hover:bg-primary hover:text-white transition-colors"
                                                    onClick={() => handleOpenDetails(formacao)}
                                                >
                                                    Ver Relatório
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      )}
      
      <Dialog open={isDetailDialogOpen} onOpenChange={handleDetailDialogChange}>
            <DialogContent className="sm:max-w-2xl">
                {selectedFormacao && (
                  <>
                    <DialogHeader>
                        <DialogTitle className="text-2xl">
                           {selectedFormacao.titulo.startsWith('Devolutiva') && !selectedFormacao.titulo.includes(':') && selectedFormacao.municipio
                              ? `${selectedFormacao.titulo}: ${selectedFormacao.municipio}`
                              : selectedFormacao.titulo}
                        </DialogTitle>
                        <DialogDescription>{selectedFormacao.descricao}</DialogDescription>
                    </DialogHeader>
                    <DetalhesFormacao 
                        formacaoId={selectedFormacao.id} 
                        onClose={() => handleDetailDialogChange(false)} 
                        isArchived={true}
                    />
                  </>
                )}
            </DialogContent>
        </Dialog>
    </div>
  );
}

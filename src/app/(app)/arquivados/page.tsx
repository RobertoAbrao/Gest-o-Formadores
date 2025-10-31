
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
import { Loader2 } from 'lucide-react';
import type { Formacao } from '@/lib/types';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DetalhesFormacao } from '@/components/formacoes/detalhes-formacao';

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
                    Consulte o histórico de formações que já foram concluídas e arquivadas.
                </p>
            </div>
        </div>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead className="hidden lg:table-cell">Município</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Data de Conclusão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formacoes.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nenhuma formação arquivada encontrada.
                    </TableCell>
                </TableRow>
            ) : formacoes.map((formacao) => (
                <TableRow key={formacao.id} onClick={() => handleOpenDetails(formacao)} className="cursor-pointer">
                  <TableCell className="font-medium">{formacao.titulo}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{formacao.municipio}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">Arquivado</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDate(formacao.dataFim)}
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
      
      <Dialog open={isDetailDialogOpen} onOpenChange={handleDetailDialogChange}>
            <DialogContent className="sm:max-w-2xl">
                {selectedFormacao && (
                  <>
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{selectedFormacao.titulo}</DialogTitle>
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

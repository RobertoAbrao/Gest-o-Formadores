
'use server';

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
import type { Formacao, Formador, Despesa } from '@/lib/types';
import AppLogo from '../AppLogo';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface RelatorioProps {
  formacaoId: string;
}

const formatDate = (timestamp: Timestamp | null | undefined, options?: Intl.DateTimeFormatOptions) => {
    if (!timestamp) return 'N/A';
    const defaultOptions: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    return timestamp.toDate().toLocaleDateString('pt-BR', options || defaultOptions);
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};


async function getRelatorioData(formacaoId: string) {
    const formacaoRef = doc(db, 'formacoes', formacaoId);
    const formacaoSnap = await getDoc(formacaoRef);
    if (!formacaoSnap.exists()) {
      throw new Error('Formação não encontrada.');
    }
    const formacao = { id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao;
    
    let formador: Formador | null = null;
    if (formacao.formadoresIds && formacao.formadoresIds.length > 0) {
      const formadorId = formacao.formadoresIds[0];
      const formadorRef = doc(db, 'formadores', formadorId);
      const formadorSnap = await getDoc(formadorRef);
      if (formadorSnap.exists()) {
        formador = { id: formadorSnap.id, ...formadorSnap.data() } as Formador;
      }
    }

    let despesas: Despesa[] = [];
    if (formador) {
        const qDespesas = query(collection(db, 'despesas'), where('formadorId', '==', formador.id));
        const despesasSnap = await getDocs(qDespesas);
        const allDespesas = despesasSnap.docs.map(doc => ({id: doc.id, ...doc.data()} as Despesa));
        
        const startDate = formacao.dataInicio?.toMillis();
        const endDate = formacao.dataFim?.toMillis();

        const filteredDespesas = allDespesas.filter(d => {
            if (!startDate || !endDate) return false;
            const despesaDate = d.data.toMillis();
            return despesaDate >= startDate && despesaDate <= endDate;
        });
        
        filteredDespesas.sort((a, b) => a.data.toMillis() - b.data.toMillis());
        despesas = filteredDespesas;
    }
    
    return { formacao, formador, despesas };
}


export async function RelatorioDespesas({ formacaoId }: RelatorioProps) {
  const { formacao, formador, despesas } = await getRelatorioData(formacaoId);
  const totalDespesas = despesas.reduce((sum, item) => sum + item.valor, 0);
  const dataEmissao = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="bg-white text-black font-sans p-8 rounded-lg shadow-lg border">
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
        <AppLogo textClassName='text-3xl' iconClassName='h-10 w-10' />
        <div className='text-right'>
            <h2 className="text-2xl font-bold">Relatório de Despesas</h2>
            <p className="text-sm text-gray-500">Data de Emissão: {dataEmissao}</p>
        </div>
      </header>

      <main className="mt-8 space-y-10">
        <section>
          <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Detalhes da Formação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div><strong>Formação:</strong> {formacao.titulo}</div>
            <div><strong>Status:</strong> <Badge variant="outline" className="text-sm">{formacao.status}</Badge></div>
            <div><strong>Município:</strong> {formacao.municipio} - {formacao.uf}</div>
            <div><strong>Período:</strong> {formatDate(formacao.dataInicio)} a {formatDate(formacao.dataFim)}</div>
          </div>
        </section>

        {formador && (
            <section>
                <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Dados do Formador</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div><strong>Nome:</strong> {formador.nomeCompleto}</div>
                    <div><strong>Email:</strong> {formador.email}</div>
                    <div><strong>CPF:</strong> {formador.cpf}</div>
                    <div><strong>Telefone:</strong> {formador.telefone}</div>
                </div>
            </section>
        )}
        
        <section>
          <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Despesas Detalhadas</h3>
            {despesas.length > 0 ? (
                <>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {despesas.map((despesa) => (
                        <TableRow key={despesa.id}>
                        <TableCell>{despesa.data.toDate().toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{despesa.tipo}</TableCell>
                        <TableCell>{despesa.descricao}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(despesa.valor)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                 <div className="flex justify-end mt-4">
                    <div className="text-right">
                        <p className="text-gray-600">Total Geral:</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalDespesas)}</p>
                    </div>
                </div>
                </>
            ) : (
                <p className="text-sm text-gray-500 italic">Nenhuma despesa registrada para o período desta formação.</p>
            )}
        </section>

        <section className="pt-16">
            <div className="w-1/2 mx-auto">
                <div className="border-t border-gray-400 text-center pt-2">
                    <p className="text-sm">Assinatura do Responsável</p>
                </div>
            </div>
        </section>
      </main>

      <footer className="text-center text-xs text-gray-400 pt-8 mt-8 border-t">
        EduConnect Hub - Portal de Apoio Pedagógico
      </footer>
    </div>
  );
}


import type { Formacao, Formador, Anexo, Despesa } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import AppLogo from '../AppLogo';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface RelatorioProps {
  formacao: Formacao;
  formador: Formador | null;
  anexos: Anexo[];
  despesas: Despesa[];
}

const formatDate = (timestamp: Timestamp | null | undefined, options?: Intl.DateTimeFormatOptions) => {
    if (!timestamp) return 'N/A';
    const defaultOptions: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    return timestamp.toDate().toLocaleString('pt-BR', options || defaultOptions);
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function RelatorioFormacaoPrint({ formacao, formador, anexos, despesas }: RelatorioProps) {
  const totalDespesas = despesas.reduce((sum, item) => sum + item.valor, 0);
  const dataEmissao = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="bg-white text-black font-sans p-8 rounded-lg shadow-lg border">
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
        <AppLogo textClassName='text-3xl' iconClassName='h-10 w-10' />
        <div className='text-right'>
            <h2 className="text-2xl font-bold">Relatório de Formação</h2>
            <p className="text-sm text-gray-500">Data de Emissão: {dataEmissao}</p>
        </div>
      </header>

      <main className="mt-8 space-y-10">
        <section>
          <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Detalhes da Formação</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <p><strong>Formação:</strong> {formacao.titulo}</p>
            <div><strong>Status:</strong> <Badge variant="outline" className="text-sm">{formacao.status}</Badge></div>
            <p><strong>Município:</strong> {formacao.municipio} - {formacao.uf}</p>
             <p><strong>Período:</strong> {formatDate(formacao.dataInicio, {dateStyle: 'short'})} a {formatDate(formacao.dataFim, {dateStyle: 'short'})}</p>
            {formacao.participantes && (
                <p><strong>Nº de Participantes:</strong> {formacao.participantes}</p>
            )}
          </div>
        </section>

        {formador && (
            <section>
                <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Dados do Formador</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <p><strong>Nome:</strong> {formador.nomeCompleto}</p>
                    <p><strong>Email:</strong> {formador.email}</p>
                    <p><strong>CPF:</strong> {formador.cpf}</p>
                    <p><strong>Telefone:</strong> {formador.telefone}</p>
                </div>
            </section>
        )}
        
        {anexos.length > 0 && (
          <section>
            <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Linha do Tempo de Anexos e Atas</h3>
             <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Data de Upload</TableHead>
                    <TableHead>Nome do Arquivo</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {anexos.map((anexo, index) => (
                    <TableRow key={index}>
                        <TableCell>{formatDate(anexo.dataUpload, { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                        <TableCell>{anexo.nome}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
          </section>
        )}

        <section>
          <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Relatório de Despesas</h3>
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
        Gestão Formadores - Portal de Apoio Pedagógico
      </footer>
    </div>
  );
}

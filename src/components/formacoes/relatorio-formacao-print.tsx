
import type { Formacao, Formador, Anexo, Despesa, Avaliacao } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import AppLogo from '../AppLogo';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Star } from 'lucide-react';

interface RelatorioProps {
  formacao: Formacao;
  formador: Formador | null;
  anexos: Anexo[];
  despesas: Despesa[];
  avaliacoes: Avaliacao[];
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

export function RelatorioFormacaoPrint({ formacao, formador, anexos, despesas, avaliacoes }: RelatorioProps) {
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
        
        <section className="break-before-page">
          <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Avaliações Detalhadas</h3>
           {avaliacoes.length > 0 ? (
                <div className="space-y-4">
                    {avaliacoes.map((avaliacao, index) => (
                        <Card key={avaliacao.id} className="break-inside-avoid">
                            <CardHeader>
                                <CardTitle className="text-base">Avaliação de: {avaliacao.nomeCompleto}</CardTitle>
                                <p className="text-xs text-gray-500">{avaliacao.email} - {formatDate(avaliacao.dataCriacao, {dateStyle: 'full'})}</p>
                            </CardHeader>
                            <CardContent className="text-sm space-y-3">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    <p><strong>Formador Avaliado:</strong> {avaliacao.formadorNome}</p>
                                    <p><strong>Modalidade:</strong> {avaliacao.modalidade}</p>
                                    <p><strong>Função:</strong> {avaliacao.funcao}</p>
                                    <p><strong>Etapa de Ensino:</strong> {avaliacao.etapaEnsino}</p>
                                    <p><strong>Avaliação (1-5):</strong> 
                                        <span className="flex items-center gap-1">{[...Array(5)].map((_, i) => (
                                          <Star key={i} className={`h-4 w-4 ${i < Number(avaliacao.avaliacaoEditora) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}/>
                                        ))}</span>
                                    </p>
                                </div>
                                
                                <div>
                                    <p><strong>Material/Tema:</strong> {avaliacao.materialTema.join(', ')}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                     <p><strong>Assuntos:</strong> <Badge variant="outline">{avaliacao.avaliacaoAssuntos}</Badge></p>
                                    <p><strong>Organização:</strong> <Badge variant="outline">{avaliacao.avaliacaoOrganizacao}</Badge></p>
                                    <p><strong>Relevância:</strong> <Badge variant="outline">{avaliacao.avaliacaoRelevancia}</Badge></p>
                                    <p><strong>Material Atende:</strong> <Badge variant="outline">{avaliacao.materialAtendeExpectativa}</Badge></p>
                                </div>

                                {avaliacao.motivoMaterialNaoAtende && (
                                    <div><strong>Motivo (Material):</strong><p className="pl-2 border-l-2 ml-1 text-gray-600 italic">{avaliacao.motivoMaterialNaoAtende}</p></div>
                                )}
                                {avaliacao.interesseFormacao && (
                                    <div><strong>Interesse:</strong><p className="pl-2 border-l-2 ml-1 text-gray-600 italic">{avaliacao.interesseFormacao}</p></div>
                                )}
                                {avaliacao.observacoes && (
                                    <div><strong>Observações:</strong><p className="pl-2 border-l-2 ml-1 text-gray-600 italic">{avaliacao.observacoes}</p></div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
           ) : (
                <p className="text-sm text-gray-500 italic">Nenhuma avaliação recebida para esta formação.</p>
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

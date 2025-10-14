
import type { Formacao, Formador, Anexo, Despesa, Avaliacao } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import AppLogo from '../AppLogo';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Star, Users, File as FileIcon, FileType, FileText, User } from 'lucide-react';
import { Progress } from '../ui/progress';

type AvaliacaoSummary = {
    total: number;
    mediaEditora: number;
    mediaFormador: number;
    modalidade: Record<string, number>;
    funcao: Record<string, number>;
    etapaEnsino: Record<string, number>;
    materialTema: Record<string, number>;
    assuntos: Record<string, number>;
    organizacao: Record<string, number>;
    relevancia: Record<string, number>;
    material: Record<string, number>;
    avaliacaoEditora: Record<string, number>;
    avaliacaoFormador: Record<string, number>;
    respostasAbertas: {
        motivos: string[];
        interesses: string[];
        observacoes: string[];
    }
}

interface RelatorioProps {
  formacao: Formacao;
  formadores: Formador[];
  anexos: Anexo[];
  despesas: Despesa[];
  avaliacoes: Avaliacao[];
  summary: AvaliacaoSummary | null;
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

const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const QuestionSummary = ({ title, data, total }: {title: string, data: Record<string, number>, total: number}) => (
    <div className="space-y-2">
        <p className="font-medium">{title}</p>
        {Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
            <div key={key}>
                <div className="flex justify-between mb-1 text-xs">
                    <span>{key}</span>
                    <span>{value} ({((value / total) * 100).toFixed(0)}%)</span>
                </div>
                <Progress value={(value / total) * 100} className="h-1.5" />
            </div>
        ))}
    </div>
)

const OpenEndedResponses = ({ title, responses }: { title: string, responses: string[] }) => (
    <div>
        <h4 className="font-semibold text-sm mb-1">{title}</h4>
        {responses.length > 0 ? (
            <ul className="list-disc list-inside space-y-2 text-xs text-gray-700 pl-2">
                {responses.map((resp, i) => (
                    <li key={i} className="italic">"{resp}"</li>
                ))}
            </ul>
        ) : (
            <p className="text-xs text-gray-500 italic">Nenhuma resposta.</p>
        )}
    </div>
);


export function RelatorioFormacaoPrint({ formacao, formadores, anexos, despesas, avaliacoes, summary }: RelatorioProps) {
  const totalDespesas = despesas.reduce((sum, item) => sum + item.valor, 0);
  const dataEmissao = new Date().toLocaleDateString('pt-BR');

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') {
        return <FileText className="h-6 w-6 text-red-500 mr-2 shrink-0" />;
    }
    if (extension === 'doc' || extension === 'docx') {
        return <FileType className="h-6 w-6 text-blue-500 mr-2 shrink-0" />;
    }
    return <FileIcon className="h-6 w-6 text-gray-500 mr-2 shrink-0" />;
  };

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
            <div><strong>Status:</strong> <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold">{formacao.status}</span></div>
            <p><strong>Município:</strong> {formacao.municipio}</p>
             <p><strong>Período:</strong> {formatDate(formacao.dataInicio, {dateStyle: 'short'})} a {formatDate(formacao.dataFim, {dateStyle: 'short'})}</p>
            {formacao.participantes && (
                <p><strong>Nº de Participantes:</strong> {formacao.participantes}</p>
            )}
          </div>
        </section>

        {formadores && formadores.length > 0 && (
            <section>
                <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Dados dos Formadores</h3>
                <div className="space-y-4">
                  {formadores.map(formador => (
                    <div key={formador.id} className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm pt-2 border-b last:border-b-0 pb-2">
                        <p><strong>Nome:</strong> {formador.nomeCompleto}</p>
                        <p><strong>Email:</strong> {formador.email}</p>
                        <p><strong>CPF:</strong> {formador.cpf}</p>
                        <p><strong>Telefone:</strong> {formador.telefone}</p>
                    </div>
                  ))}
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
                    <TableHead>Arquivo</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {anexos.map((anexo, index) => {
                        const isImage = anexo.url.startsWith('data:image');
                        return (
                             <TableRow key={index}>
                                <TableCell className="w-[150px]">{formatDate(anexo.dataUpload, { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                                <TableCell>
                                    <div className='flex items-center gap-2'>
                                        {!isImage && getFileIcon(anexo.nome)}
                                        <span className='truncate'>{anexo.nome}</span>
                                    </div>
                                    {isImage && <img src={anexo.url} alt={anexo.nome} className="max-w-xs rounded-md mt-2 border p-1" />}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
          </section>
        )}
        
        {formacao.logistica && formacao.logistica.length > 0 && (
            <section>
                <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Logística de Viagem</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Formador</TableHead>
                            <TableHead>Hotel</TableHead>
                            <TableHead>Check-in/out</TableHead>
                            <TableHead className='text-right'>Valor Hosp.</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {formacao.logistica.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell>{item.formadorNome}</TableCell>
                                <TableCell>{item.hotel || 'N/A'}</TableCell>
                                <TableCell>
                                    {formatDate(item.checkin, {dateStyle: 'short'})} - {formatDate(item.checkout, {dateStyle: 'short'})}
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(item.valorHospedagem)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>
        )}
        
         {despesas.length > 0 && (
            <section>
                <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Relatório de Despesas</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Formador</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className='text-right'>Valor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {despesas.map((despesa) => (
                            <TableRow key={despesa.id}>
                                <TableCell>{formatDate(despesa.data, {dateStyle: 'short'})}</TableCell>
                                <TableCell>{despesa.formadorNome}</TableCell>
                                <TableCell>{despesa.tipo}</TableCell>
                                <TableCell>{despesa.descricao}</TableCell>
                                <TableCell className="text-right">{formatCurrency(despesa.valor)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="text-right mt-2 font-bold pr-4">Total Despesas: {formatCurrency(totalDespesas)}</div>
            </section>
        )}

        
        <section className="break-before-page">
          <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Resumo das Avaliações</h3>
           {avaliacoes.length > 0 && summary ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total de Respostas</CardTitle>
                                <Users className="h-4 w-4 text-gray-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{summary.total}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Média Formador</CardTitle>
                                <User className="h-4 w-4 text-gray-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{summary.mediaFormador > 0 ? summary.mediaFormador.toFixed(1) : 'N/A'}</div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Média Editora (1-5)</CardTitle>
                                <Star className="h-4 w-4 text-gray-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{summary.mediaEditora.toFixed(1)}</div>
                            </CardContent>
                        </Card>
                    </div>
                    
                    <Card>
                        <CardHeader><CardTitle className="text-base">Respostas Quantitativas</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-6 text-sm">
                           <QuestionSummary title="Modalidade" data={summary.modalidade} total={summary.total}/>
                           <QuestionSummary title="Função Pedagógica" data={summary.funcao} total={summary.total}/>
                           <QuestionSummary title="Etapa de Ensino" data={summary.etapaEnsino} total={summary.total}/>
                           <QuestionSummary title="Assuntos Abordados" data={summary.assuntos} total={summary.total}/>
                           <QuestionSummary title="Organização do Encontro" data={summary.organizacao} total={summary.total}/>
                           <QuestionSummary title="Relevância para Prática" data={summary.relevancia} total={summary.total}/>
                           <QuestionSummary title="Material Atende Expectativas" data={summary.material} total={summary.total}/>
                           {summary.avaliacaoFormador && Object.keys(summary.avaliacaoFormador).length > 0 && (
                               <QuestionSummary title="Avaliação do Formador (1-5)" data={summary.avaliacaoFormador} total={summary.total}/>
                           )}
                           <QuestionSummary title="Avaliação da Editora (1-5)" data={summary.avaliacaoEditora} total={summary.total}/>
                        </CardContent>
                    </Card>
                    
                    {summary.respostasAbertas && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Respostas Abertas</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                               <OpenEndedResponses title="Motivos (Material não atende)" responses={summary.respostasAbertas.motivos} />
                               <OpenEndedResponses title="Principais Interesses na Formação" responses={summary.respostasAbertas.interesses} />
                               <OpenEndedResponses title="Observações e Sugestões" responses={summary.respostasAbertas.observacoes} />
                            </CardContent>
                        </Card>
                    )}
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

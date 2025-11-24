
import type { Formacao, Formador, Anexo, Despesa, Avaliacao } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import AppLogo from '../AppLogo';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Star, Users, File as FileIcon, FileType, FileText, User } from 'lucide-react';
import { Progress } from '../ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

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


export function RelatorioFormacaoCompletoPrint({ formacao, formadores, anexos, despesas, avaliacoes, summary }: RelatorioProps) {
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

  const isIndividualReport = formadores.length === 1;

  return (
    <div className="bg-white text-black font-sans p-8 rounded-lg shadow-lg border">
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
        <AppLogo textClassName='text-3xl' iconClassName='h-10 w-10' />
        <div className='text-right'>
            <h2 className="text-2xl font-bold">Relatório Completo de Formação</h2>
            <p className="text-sm text-gray-500">Data de Emissão: {dataEmissao}</p>
        </div>
      </header>

      <main className="mt-8 space-y-10">
        {/* Detalhes da Formação */}
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

        {/* ... (outras seções como anexos, despesas) ... */}

        {/* Avaliações */}
        <section className="break-before-page">
          <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Avaliações Detalhadas</h3>
           {avaliacoes.length > 0 && summary ? (
                <div className="space-y-6">
                    <div className='mb-8'>
                      <h4 className="font-semibold text-lg mb-4">Resumo Geral</h4>
                       {/* Componente de resumo aqui... */}
                    </div>
                    
                    <h4 className="font-semibold text-lg mb-4">Respostas Individuais</h4>
                    <div className="space-y-4">
                        {avaliacoes.map(avaliacao => (
                            <div key={avaliacao.id} className="border rounded-md break-inside-avoid-page">
                                <div className='p-4 bg-gray-50 rounded-t-md'>
                                    <h5 className="font-semibold">{avaliacao.nomeCompleto}</h5>
                                    <p className="text-xs text-gray-600">{avaliacao.email}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Enviado em: {formatDate(avaliacao.dataCriacao, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="text-sm space-y-3 p-4">
                                  <p><strong>Função:</strong> {avaliacao.funcao}</p>
                                  <p><strong>Etapa de Ensino:</strong> {avaliacao.etapaEnsino}</p>
                                  <p><strong>Assuntos:</strong> <Badge variant="outline">{avaliacao.avaliacaoAssuntos}</Badge></p>
                                  <p><strong>Organização:</strong> <Badge variant="outline">{avaliacao.avaliacaoOrganizacao}</Badge></p>
                                  <p><strong>Relevância:</strong> <Badge variant="outline">{avaliacao.avaliacaoRelevancia}</Badge></p>
                                  <p><strong>Material Atende:</strong> <Badge variant="outline">{avaliacao.materialAtendeExpectativa}</Badge></p>
                                  {avaliacao.avaliacaoFormador && (
                                      <div>
                                          <strong>Avaliação do Formador:</strong>
                                          <div className='flex items-center gap-1 mt-1'>
                                              {[...Array(5)].map((_, i) => (
                                              <Star key={i} className={`h-4 w-4 ${i < Number(avaliacao.avaliacaoFormador) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}/>
                                              ))}
                                          </div>
                                      </div>
                                  )}
                                  <div>
                                      <strong>Avaliação da Editora:</strong>
                                      <div className='flex items-center gap-1 mt-1'>
                                          {[...Array(5)].map((_, i) => (
                                          <Star key={i} className={`h-4 w-4 ${i < Number(avaliacao.avaliacaoEditora) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}/>
                                          ))}
                                      </div>
                                  </div>
                                  {avaliacao.interesseFormacao && (
                                    <div>
                                      <strong>Interesse:</strong>
                                      <p className='text-gray-600 pl-2 border-l-2 ml-1 italic'>"{avaliacao.interesseFormacao}"</p>
                                    </div>
                                  )}
                                  {avaliacao.observacoes && (
                                    <div>
                                      <strong>Observações:</strong>
                                      <p className='text-gray-600 pl-2 border-l-2 ml-1 italic'>"{avaliacao.observacoes}"</p>
                                    </div>
                                  )}
                                </div>
                            </div>
                        ))}
                    </div>
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

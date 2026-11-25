
'use client';

import type { ProjetoImplatancao, Anexo } from '@/lib/types';
import { montarLinhaDoTempo, type TipoMarco } from '@/lib/projetos/linha-do-tempo';
import AppLogo from '../AppLogo';
import { Badge } from '../ui/badge';
import { Calendar, CheckCircle, Flag, Milestone, Target, UploadCloud, Image as ImageIcon, Star, Shield, DownloadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { linhasCompra } from '@/lib/projetos/compra-material';


const ICONE_DO_MARCO: Record<TipoMarco, React.ElementType> = {
  migracao: UploadCloud,
  implantacao: Milestone,
  diagnostica: Target,
  simulado: Target,
  devolutiva: Flag,
  evento: Star,
  dossie: DownloadCloud,
  concluido: CheckCircle,
};

interface RelatorioProps {
  projeto: ProjetoImplatancao;
  anexos: Anexo[];
}

const MilestoneCard = ({
    icon,
    title,
    date,
    description,
    anexos,
    isComplete,
    isFirst = false,
    isLast = false
}: {
    icon: React.ElementType,
    title: string,
    date?: string,
    description?: { formadores: string; detalhes: string; },
    anexos?: Anexo[],
    isComplete: boolean,
    isFirst?: boolean,
    isLast?: boolean
}) => {
    const Icon = icon;
    return (
         <div className="flex justify-center relative">
            {/* Linha da timeline */}
            {!isLast && 
                <div className={cn(
                    "w-0.5 h-full absolute top-12",
                    isComplete ? 'bg-primary' : 'bg-border'
                )}></div>
            }

            {/* Conteúdo */}
            <div className="flex w-full items-start">
                {/* Lado Esquerdo: Título e Imagem */}
                <div className="w-1/2 pr-8 text-right">
                    <h4 className="font-bold text-lg mt-3">{title}</h4>
                     {date && <p className="text-xs text-gray-500 mt-1">{date}</p>}
                     {anexos && anexos.length > 0 && (
                        <div className="mt-4 space-y-2">
                           {anexos.map((anexo, index) => (
                             <div key={index} className="border rounded-lg p-2 bg-gray-50">
                                <img 
                                    src={anexo.url}
                                    alt={`Anexo para ${title} ${index + 1}`}
                                    className="w-full rounded-md object-contain max-h-60"
                                />
                            </div>
                           ))}
                        </div>
                     )}
                </div>
                
                {/* Centro: Ícone */}
                <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full z-10 shrink-0",
                    isComplete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                    <Icon className="w-6 h-6" />
                </div>
                
                {/* Lado Direito: Data e Descrição */}
                <div className="w-1/2 pl-8">
                     <div className='mt-3'>
                        
                        {description && (
                            <div className="text-sm text-gray-600 mt-1">
                                {description.formadores && <p>{description.formadores}</p>}
                                {description.detalhes && <p className="whitespace-pre-wrap">{description.detalhes}</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
};


export function RelatorioProjetoPrint({ projeto, anexos }: RelatorioProps) {
  const dataEmissao = new Date().toLocaleDateString('pt-BR');

  const brasaoAnexo = anexos.find(a => a.id === projeto.brasaoId);

  // A regra de quais marcos entram e em que ordem mora em src/lib/projetos/linha-do-tempo.ts
  // (testada); aqui só se desenha.
  const sortedMilestones = montarLinhaDoTempo(projeto, anexos).map((m) => ({
    icon: ICONE_DO_MARCO[m.tipo],
    title: m.titulo,
    date: m.data,
    description: m.descricao,
    anexos: m.anexos,
    isComplete: m.concluido,
    dossieUrl: m.dossieUrl,
  }));

  return (
    <div className="bg-white text-black font-sans p-8 rounded-lg shadow-lg border">
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
        <AppLogo textClassName='text-3xl' iconClassName='h-10 w-10' />
        <div className='text-right'>
            <h2 className="text-2xl font-bold">Linha do Tempo</h2>
            <p className="text-sm text-gray-500">Data de Emissão: {dataEmissao}</p>
        </div>
      </header>

      <main className="mt-8 space-y-10">
        <section>
          <h3 className="text-xl font-semibold mb-3 pb-2 border-b">Detalhes do Projeto</h3>
           <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                     {brasaoAnexo ? (
                        <img src={brasaoAnexo.url} alt="Brasão do Município" className="h-20 w-auto object-contain"/>
                    ) : null}
                    <div>
                        <p className="text-lg font-bold">{projeto.municipio}</p>
                        <Badge variant="outline" className="text-sm">{projeto.uf}</Badge>
                    </div>
                </div>
            </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mt-4">
              <p><strong>Versão:</strong> {projeto.versao || 'N/A'}</p>
              <p><strong>Material:</strong> {projeto.material || 'N/A'}</p>
              {linhasCompra(projeto.material, projeto.materiaisComprados).length > 0 && (
                <p className="col-span-2"><strong>Comprou:</strong> {linhasCompra(projeto.material, projeto.materiaisComprados).join(' | ')}</p>
              )}
              <p><strong>Alunos:</strong> {projeto.qtdAlunos || 'N/A'}</p>
              <p><strong>Formações Pendentes:</strong> {projeto.formacoesPendentes || '0'}</p>
          </div>
        </section>
        
        <section>
             <h3 className="text-xl font-semibold mb-6 pb-2 border-b">Marcos e Atividades</h3>
             <div className='space-y-4'>
                {sortedMilestones.length > 0 ? (
                    sortedMilestones.map((milestone, index) => {
                        if (milestone.dossieUrl) {
                            return (
                                <div key={index} className="flex justify-center relative">
                                    <div className="flex w-full items-start">
                                        <div className="w-1/2 pr-8 text-right">
                                             <h4 className="font-bold text-lg mt-3">{milestone.title}</h4>
                                        </div>
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full z-10 shrink-0 bg-primary text-primary-foreground">
                                            <DownloadCloud className="w-6 h-6" />
                                        </div>
                                        <div className="w-1/2 pl-8">
                                            <div className='mt-3'>
                                                <a href={milestone.dossieUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
                                                    Clique aqui para baixar o dossiê completo
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return (
                             <MilestoneCard 
                                key={index}
                                icon={milestone.icon}
                                title={milestone.title}
                                date={milestone.date}
                                description={milestone.description}
                                anexos={milestone.anexos}
                                isComplete={milestone.isComplete}
                                isFirst={index === 0}
                                isLast={index === sortedMilestones.length - 1}
                            />
                        )
                    })
                ) : (
                    <p className="text-sm text-center text-gray-500 py-8">Nenhum marco com data definida para exibir na linha do tempo.</p>
                )}
             </div>
        </section>
      </main>

      <footer className="text-center text-xs text-gray-400 pt-8 mt-8 border-t">
        Gestão Pedagógica - Portal de Apoio Pedagógico
      </footer>
    </div>
  );
}

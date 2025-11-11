
'use client';

import type { ProjetoImplatancao, Anexo } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import AppLogo from '../AppLogo';
import { Badge } from '../ui/badge';
import { Calendar, CheckCircle, Flag, Milestone, Target, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';


interface RelatorioProps {
  projeto: ProjetoImplatancao;
  anexos: Anexo[];
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

const MilestoneCard = ({
    icon,
    title,
    date,
    description,
    anexo,
    isComplete,
    isFirst = false,
    isLast = false
}: {
    icon: React.ElementType,
    title: string,
    date?: string,
    description?: { formadores: string; detalhes: string; },
    anexo?: Anexo,
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
                     {anexo?.url && (
                        <div className="mt-4 border rounded-lg p-2 bg-gray-50">
                            <img 
                                src={anexo.url}
                                alt={`Anexo para ${title}`}
                                className="w-full rounded-md object-contain max-h-60"
                            />
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
                                {description.detalhes && <p>{description.detalhes}</p>}
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
  const anexosMap = new Map(anexos.map(anexo => [anexo.id, anexo]));

  const getDevolutivaDescription = (devolutivaKey: 'd1' | 'd2' | 'd3' | 'd4') => {
    const devolutiva = projeto.devolutivas?.[devolutivaKey];
    if (!devolutiva) return { formadores: '', detalhes: '' };

    const formadores = devolutiva.formadores && devolutiva.formadores.length > 0
      ? `Formadores: ${devolutiva.formadores.join(', ')}`
      : '';
    
    return { formadores, detalhes: devolutiva.detalhes || '' };
  }

  const allMilestones = [
    {
        icon: UploadCloud,
        title: 'Migração de Dados',
        date: formatDate(projeto.dataMigracao),
        description: { formadores: '', detalhes: '' },
        anexo: undefined,
        isComplete: !!projeto.dataMigracao,
        sortDate: projeto.dataMigracao?.toDate()
    },
    {
        icon: Milestone,
        title: 'Implantação do Sistema',
        date: formatDate(projeto.dataImplantacao),
        isComplete: !!projeto.dataImplantacao,
        anexo: projeto.implantacaoAnexoId ? anexosMap.get(projeto.implantacaoAnexoId) : undefined,
        sortDate: projeto.dataImplantacao?.toDate()
    },
    {
        icon: Target,
        title: 'Avaliação Diagnóstica',
        date: formatDate(projeto.diagnostica?.data),
        description: { formadores: '', detalhes: projeto.diagnostica?.detalhes || '' },
        anexo: projeto.diagnostica?.anexoId ? anexosMap.get(projeto.diagnostica.anexoId) : undefined,
        isComplete: !!projeto.diagnostica?.ok,
        sortDate: projeto.diagnostica?.data?.toDate()
    },
    ...([1,2,3,4] as const).map(i => ({
        icon: Target,
        title: `Simulado ${i}`,
        date: `De ${formatDate(projeto.simulados?.[`s${i}`]?.dataInicio)} a ${formatDate(projeto.simulados?.[`s${i}`]?.dataFim)}`,
        description: { formadores: '', detalhes: projeto.simulados?.[`s${i}`]?.detalhes || '' },
        anexo: projeto.simulados?.[`s${i}`]?.anexoId ? anexosMap.get(projeto.simulados?.[`s${i}`].anexoId!) : undefined,
        isComplete: !!projeto.simulados?.[`s${i}`]?.ok,
        sortDate: projeto.simulados?.[`s${i}`]?.dataInicio?.toDate()
    })),
    ...([1,2,3,4] as const).map(i => ({
        icon: Flag,
        title: `Devolutiva ${i}`,
        date: `De ${formatDate(projeto.devolutivas?.[`d${i}`]?.dataInicio)} a ${formatDate(projeto.devolutivas?.[`d${i}`]?.dataFim)}`,
        description: getDevolutivaDescription(`d${i}`),
        anexo: projeto.devolutivas?.[`d${i}`]?.anexoId ? anexosMap.get(projeto.devolutivas?.[`d${i}`].anexoId!) : undefined,
        isComplete: !!projeto.devolutivas?.[`d${i}`]?.ok,
        sortDate: projeto.devolutivas?.[`d${i}`]?.dataInicio?.toDate()
    })),
  ];

    const scheduledMilestones = allMilestones.filter(m => m.sortDate);
    const sortedMilestones = scheduledMilestones.sort((a, b) => a.sortDate!.getTime() - b.sortDate!.getTime());
    
    sortedMilestones.push({
        icon: CheckCircle,
        title: 'Projeto Concluído',
        description: { formadores: '', detalhes: 'Todas as etapas foram finalizadas com sucesso.'},
        anexo: undefined,
        isComplete: true,
        sortDate: new Date(8640000000000000) // Data máxima para garantir que seja o último
    });

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
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <p><strong>Município:</strong> {projeto.municipio}</p>
            <div><strong>UF:</strong> <Badge variant="outline" className="text-sm">{projeto.uf}</Badge></div>
            <p><strong>Versão:</strong> {projeto.versao || 'N/A'}</p>
            <p><strong>Material:</strong> {projeto.material || 'N/A'}</p>
            <p><strong>Alunos:</strong> {projeto.qtdAlunos || 'N/A'}</p>
            <p><strong>Formações Pendentes:</strong> {projeto.formacoesPendentes || '0'}</p>
          </div>
        </section>
        
        <section>
             <h3 className="text-xl font-semibold mb-6 pb-2 border-b">Marcos e Atividades</h3>
             <div className='space-y-4'>
                {sortedMilestones.length > 0 ? (
                    sortedMilestones.map((milestone, index) => (
                        <MilestoneCard 
                            key={index}
                            {...milestone}
                            isFirst={index === 0}
                            isLast={index === sortedMilestones.length - 1}
                        />
                    ))
                ) : (
                    <p className="text-sm text-center text-gray-500 py-8">Nenhum marco com data definida para exibir na linha do tempo.</p>
                )}
             </div>
        </section>
      </main>

      <footer className="text-center text-xs text-gray-400 pt-8 mt-8 border-t">
        Gestão Formadores - Portal de Apoio Pedagógico
      </footer>
    </div>
  );
}

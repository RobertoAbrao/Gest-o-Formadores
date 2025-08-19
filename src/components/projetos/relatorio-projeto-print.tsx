
import type { ProjetoImplatancao } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import AppLogo from '../AppLogo';
import { Badge } from '../ui/badge';
import { Calendar, CheckCircle, Flag, Milestone, Target, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';


interface RelatorioProps {
  projeto: ProjetoImplatancao;
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
    isComplete,
    isFirst = false,
    isLast = false
}: {
    icon: React.ElementType,
    title: string,
    date?: string,
    description?: string,
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
                {/* Lado Esquerdo: Título */}
                <div className="w-1/2 pr-8 text-right">
                    <h4 className="font-bold text-lg mt-3">{title}</h4>
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
                        <p className="text-xs text-gray-500">{date}</p>
                        {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
                    </div>
                </div>
            </div>
        </div>
    )
};


export function RelatorioProjetoPrint({ projeto }: RelatorioProps) {
  const dataEmissao = new Date().toLocaleDateString('pt-BR');

  const milestones = [
    {
        icon: UploadCloud,
        title: 'Migração de Dados',
        date: formatDate(projeto.dataMigracao),
        isComplete: !!projeto.dataMigracao,
    },
    {
        icon: Milestone,
        title: 'Implantação do Sistema',
        date: formatDate(projeto.dataImplantacao),
        isComplete: !!projeto.dataImplantacao,
    },
    {
        icon: Target,
        title: 'Avaliação Diagnóstica',
        date: formatDate(projeto.diagnostica?.data),
        isComplete: !!projeto.diagnostica?.ok,
    },
    {
        icon: Target,
        title: 'Simulado 1',
        date: `De ${formatDate(projeto.simulados?.s1?.dataInicio)} a ${formatDate(projeto.simulados?.s1?.dataFim)}`,
        isComplete: !!projeto.simulados?.s1?.ok,
    },
     {
        icon: Flag,
        title: 'Devolutiva 1',
        description: `Formador: ${projeto.devolutivas?.d1?.formador || 'N/A'}`,
        isComplete: !!projeto.devolutivas?.d1?.ok,
    },
    {
        icon: Target,
        title: 'Simulado 2',
        date: `De ${formatDate(projeto.simulados?.s2?.dataInicio)} a ${formatDate(projeto.simulados?.s2?.dataFim)}`,
        isComplete: !!projeto.simulados?.s2?.ok,
    },
     {
        icon: Flag,
        title: 'Devolutiva 2',
        description: `Formador: ${projeto.devolutivas?.d2?.formador || 'N/A'}`,
        isComplete: !!projeto.devolutivas?.d2?.ok,
    },
    {
        icon: Target,
        title: 'Simulado 3',
        date: `De ${formatDate(projeto.simulados?.s3?.dataInicio)} a ${formatDate(projeto.simulados?.s3?.dataFim)}`,
        isComplete: !!projeto.simulados?.s3?.ok,
    },
     {
        icon: Flag,
        title: 'Devolutiva 3',
        description: `Formador: ${projeto.devolutivas?.d3?.formador || 'N/A'}`,
        isComplete: !!projeto.devolutivas?.d3?.ok,
    },
     {
        icon: Target,
        title: 'Simulado 4',
        date: `De ${formatDate(projeto.simulados?.s4?.dataInicio)} a ${formatDate(projeto.simulados?.s4?.dataFim)}`,
        isComplete: !!projeto.simulados?.s4?.ok,
    },
     {
        icon: Flag,
        title: 'Devolutiva 4',
        description: `Formador: ${projeto.devolutivas?.d4?.formador || 'N/A'}`,
        isComplete: !!projeto.devolutivas?.d4?.ok,
    },
     {
        icon: CheckCircle,
        title: 'Projeto Concluído',
        description: 'Todas as etapas foram finalizadas com sucesso.',
        isComplete: true,
    },
  ].filter(m => m.date || m.description || m.title === 'Projeto Concluído');

  return (
    <div className="bg-white text-black font-sans p-8 rounded-lg shadow-lg border">
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
        <AppLogo textClassName='text-3xl' iconClassName='h-10 w-10' />
        <div className='text-right'>
            <h2 className="text-2xl font-bold">Linha do Tempo do Projeto</h2>
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
                {milestones.map((milestone, index) => (
                    <MilestoneCard 
                        key={index}
                        {...milestone}
                        isFirst={index === 0}
                        isLast={index === milestones.length - 1}
                    />
                ))}
             </div>
        </section>
      </main>

      <footer className="text-center text-xs text-gray-400 pt-8 mt-8 border-t">
        Gestão Formadores - Portal de Apoio Pedagógico
      </footer>
    </div>
  );
}

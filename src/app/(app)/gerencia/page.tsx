'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProjetoImplatancao, Demanda, Formacao, Formador } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Clock, ListTodo, KanbanSquare, ClipboardList, Calendar, Users, Target, Flag, Milestone, UserCog } from 'lucide-react';
import { format, isBefore, startOfToday, addDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DetalhesProjetoModal } from '@/components/gerencia/detalhes-projeto-modal';
import { ScrollArea } from '@/components/ui/scroll-area';

// Helper function to calculate project progress
const calculateProgress = (projeto: ProjetoImplatancao): number => {
    const milestones = [
        projeto.diagnostica,
        ...Object.values(projeto.simulados || {}),
        ...Object.values(projeto.devolutivas || {}),
    ];
    const total = milestones.length;
    if (total === 0) return 0;
    const completed = milestones.filter(m => m?.ok).length;
    return (completed / total) * 100;
};

// Helper function to find the next milestone
const getNextMilestone = (projeto: ProjetoImplatancao): { nome: string; data: Date } | null => {
    const today = startOfToday();
    const milestones: { nome: string; data: Date }[] = [];

    if (projeto.dataImplantacao) {
        milestones.push({ nome: 'Implantação', data: projeto.dataImplantacao.toDate() });
    }
    if (projeto.diagnostica?.data && !projeto.diagnostica.ok) {
        milestones.push({ nome: 'Avaliação Diagnóstica', data: projeto.diagnostica.data.toDate() });
    }
    Object.entries(projeto.simulados || {}).forEach(([key, value]) => {
        if (value?.dataInicio && !value.ok) {
            milestones.push({ nome: `Simulado ${key.replace('s', '')}`, data: value.dataInicio.toDate() });
        }
    });
    Object.entries(projeto.devolutivas || {}).forEach(([key, value]) => {
        if (value?.dataInicio && !value.ok) {
            milestones.push({ nome: `Devolutiva ${key.replace('d', '')}`, data: value.dataInicio.toDate() });
        }
    });
    
    const upcoming = milestones
        .filter(m => m.data >= today)
        .sort((a, b) => a.data.getTime() - b.data.getTime());

    return upcoming[0] || null;
};

export default function GerenciaPage() {
    const [loading, setLoading] = useState(true);
    const [projetos, setProjetos] = useState<ProjetoImplatancao[]>([]);
    const [demandas, setDemandas] = useState<Demanda[]>([]);
    const [formacoes, setFormacoes] = useState<Formacao[]>([]);
    const [allFormadores, setAllFormadores] = useState<Formador[]>([]);
    
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedProjeto, setSelectedProjeto] = useState<any | null>(null);


    useEffect(() => {
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

        const qProjetos = query(
            collection(db, "projetos"),
            where("dataCriacao", ">=", startOfYear),
            where("dataCriacao", "<=", endOfYear)
        );
        const qDemandas = query(collection(db, 'demandas'), where('status', '!=', 'Concluída'));
        const qFormacoes = query(collection(db, 'formacoes'));
        const qFormadores = query(collection(db, 'formadores'));

        const unsubProjetos = onSnapshot(qProjetos, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjetoImplatancao));
            setProjetos(data);
            setLoading(false);
        });

        const unsubDemandas = onSnapshot(qDemandas, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Demanda));
            setDemandas(data);
        });
        
        const unsubFormacoes = onSnapshot(qFormacoes, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formacao));
            setFormacoes(data);
        });
        
        const unsubFormadores = onSnapshot(qFormadores, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
            setAllFormadores(data);
        });


        return () => {
            unsubProjetos();
            unsubDemandas();
            unsubFormacoes();
            unsubFormadores();
        };
    }, []);

    const stats = useMemo(() => ({
        demandasPendentes: demandas.length,
        formacoesAtivas: formacoes.filter(f => f.status === 'em-formacao').length,
        projetosAtivos: projetos.length,
    }), [demandas, formacoes, projetos]);
    
    const projetosComDados = useMemo(() => {
        return projetos.map(projeto => {
            const demandasDoProjeto = demandas.filter(d => d.projetoOrigemId === projeto.id);
            const demandasUrgentes = demandasDoProjeto.filter(d => d.prioridade === 'Urgente').length;
            const demandasAtrasadas = demandasDoProjeto.filter(d => d.prazo && isBefore(d.prazo.toDate(), startOfToday())).length;
            
            const etapasDoProjeto = new Set<string>();
            if (projeto.dataImplantacao) etapasDoProjeto.add('implantacao');
            if (projeto.diagnostica?.data) etapasDoProjeto.add('diagnostica');
            if (projeto.simulados) Object.keys(projeto.simulados).forEach(key => etapasDoProjeto.add(`simulado_${key}`));
            if (projeto.devolutivas) Object.keys(projeto.devolutivas).forEach(key => etapasDoProjeto.add(`devolutiva_${key}`));

            const demandasDeMarco: Demanda[] = [];
            const demandasGerais: Demanda[] = [];

            demandasDoProjeto.forEach(demanda => {
                if (demanda.etapaProjeto && etapasDoProjeto.has(demanda.etapaProjeto)) {
                    demandasDeMarco.push(demanda);
                } else {
                    demandasGerais.push(demanda);
                }
            });

            const atividades: any[] = [];
            if (projeto.dataImplantacao) {
                atividades.push({ nome: 'Implantação', ok: true, startDate: projeto.dataImplantacao.toDate(), demandas: demandasDeMarco.filter(d => d.etapaProjeto === 'implantacao') });
            }
            if (projeto.diagnostica?.data) {
                atividades.push({ nome: 'Avaliação Diagnóstica', ...projeto.diagnostica, startDate: projeto.diagnostica.data.toDate(), demandas: demandasDeMarco.filter(d => d.etapaProjeto === 'diagnostica') });
            }
            Object.entries(projeto.simulados || {}).forEach(([key, value]) => {
                if (value?.dataInicio) {
                    atividades.push({ nome: `Simulado ${key.replace('s', '')}`, ...value, startDate: value.dataInicio.toDate(), demandas: demandasDeMarco.filter(d => d.etapaProjeto === `simulado_${key}`) });
                }
            });
            Object.entries(projeto.devolutivas || {}).forEach(([key, value]) => {
                const dataInicio = (value as any)?.data?.toDate() || value?.dataInicio?.toDate();
                if (dataInicio) {
                    atividades.push({ nome: `Devolutiva ${key.replace('d', '')}`, ...value, startDate: dataInicio, demandas: demandasDeMarco.filter(d => d.etapaProjeto === `devolutiva_${key}`) });
                }
            });

            return {
                ...projeto,
                progress: calculateProgress(projeto),
                nextMilestone: getNextMilestone(projeto),
                demandasCount: demandasDoProjeto.length,
                demandasUrgentes,
                demandasAtrasadas,
                atividades: atividades.sort((a, b) => (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0)),
                demandasGerais
            };
        }).sort((a,b) => (b.demandasUrgentes + b.demandasAtrasadas) - (a.demandasUrgentes + a.demandasAtrasadas));
    }, [projetos, demandas]);

    const demandasCriticas = useMemo(() => {
        const urgentes = demandas
            .filter(d => d.prioridade === 'Urgente')
            .sort((a, b) => (a.prazo?.toMillis() || Infinity) - (b.prazo?.toMillis() || Infinity))
            .slice(0, 5);
        
        const atrasadas = demandas
            .filter(d => d.prazo && isBefore(d.prazo.toDate(), startOfToday()) && d.prioridade !== 'Urgente')
            .sort((a, b) => (a.prazo!.toMillis()) - (b.prazo!.toMillis()))
            .slice(0, 5);

        return { urgentes, atrasadas };
    }, [demandas]);
    
    const agendaDaSemana = useMemo(() => {
        const today = startOfToday();
        const nextSevenDays = addDays(today, 7);
        
        const eventos: { date: Date, title: string, type: 'formacao' | 'projeto' }[] = [];

        formacoes.forEach(f => {
            if (f.dataInicio && f.dataInicio.toDate() >= today && f.dataInicio.toDate() <= nextSevenDays) {
                eventos.push({ date: f.dataInicio.toDate(), title: `Início: ${f.titulo}`, type: 'formacao' });
            }
        });

        projetos.forEach(p => {
            const nextMilestone = getNextMilestone(p);
            if (nextMilestone && nextMilestone.data >= today && nextMilestone.data <= nextSevenDays) {
                 eventos.push({ date: nextMilestone.data, title: `${nextMilestone.nome}: ${p.municipio}`, type: 'projeto' });
            }
        });
        
        return eventos.sort((a, b) => a.date.getTime() - b.date.getTime());

    }, [formacoes, projetos]);

    const handleOpenDetails = (projeto: any) => {
        setSelectedProjeto(projeto);
        setIsDetailOpen(true);
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    const iconMapping = {
        'Avaliação Diagnóstica': Target,
        'Simulado': Target,
        'Devolutiva': Flag,
        'Implantação': Milestone,
    } as const;

    return (
        <>
            <div className="flex flex-col gap-8 py-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline text-slate-900">Visão Gerencial</h1>
                    <p className="text-slate-500">Um panorama em tempo real das operações pedagógicas.</p>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="border-none shadow-sm bg-white">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Demandas em Aberto</CardTitle>
                            <ListTodo className="h-5 w-5 text-rose-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900">{stats.demandasPendentes}</div>
                            <p className="text-xs text-slate-400 mt-1">Total acumulado no diário</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-white">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Formações Ativas</CardTitle>
                            <KanbanSquare className="h-5 w-5 text-indigo-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900">{stats.formacoesAtivas}</div>
                            <p className="text-xs text-slate-400 mt-1">Atividades em curso no quadro</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-white">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Projetos Ativos</CardTitle>
                            <ClipboardList className="h-5 w-5 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900">{stats.projetosAtivos}</div>
                            <p className="text-xs text-slate-400 mt-1">Hospedados no ciclo {new Date().getFullYear()}</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Flag className="h-5 w-5 text-primary" />
                            Status dos Projetos
                        </h2>
                        {projetosComDados.length === 0 ? (
                            <p className="text-muted-foreground text-sm">Nenhum projeto para exibir.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {projetosComDados.map(p => (
                                    <Card key={p.id} className="flex flex-col cursor-pointer hover:shadow-md transition-all border-none bg-white group" onClick={() => handleOpenDetails(p)}>
                                        <CardHeader className='pb-3'>
                                            <div className="flex justify-between items-start mb-2">
                                                <CardTitle className="text-lg text-slate-900 group-hover:text-primary transition-colors">{p.municipio} - {p.uf}</CardTitle>
                                                {p.responsavelNome && (
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium border-none py-1">
                                                        <UserCog className="h-3 w-3 mr-1.5 opacity-70" />
                                                        {p.responsavelNome.split(' ')[0]}
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                                                {p.demandasCount > 0 && 
                                                    <Badge variant="outline" className="flex items-center gap-1.5 text-[10px] font-bold uppercase border-slate-200 text-slate-500">
                                                        <ListTodo className="h-3 w-3"/>{p.demandasCount}
                                                    </Badge>
                                                }
                                                {p.demandasAtrasadas > 0 && 
                                                    <Badge variant="destructive" className="flex items-center gap-1.5 text-[10px] font-bold uppercase bg-rose-50 text-rose-600 border-rose-100">
                                                        <Clock className="h-3 w-3"/>{p.demandasAtrasadas} Atraso
                                                    </Badge>
                                                }
                                                {p.demandasUrgentes > 0 &&
                                                    <Badge variant="destructive" className="flex items-center gap-1.5 text-[10px] font-bold uppercase bg-orange-50 text-orange-600 border-orange-100">
                                                        <AlertTriangle className="h-3 w-3"/>{p.demandasUrgentes} Crítico
                                                    </Badge>
                                                }
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-grow space-y-4">
                                            <div className='bg-slate-50 p-3 rounded-lg'>
                                                <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                                                    <span>Progresso</span>
                                                    <span>{p.progress.toFixed(0)}%</span>
                                                </div>
                                                <Progress value={p.progress} className='h-2' />
                                            </div>
                                            {p.nextMilestone && (
                                                <div className="text-xs text-slate-500 bg-indigo-50/50 p-2.5 rounded-md flex items-center gap-2">
                                                    <Clock className='h-3.5 w-3.5 text-indigo-500 shrink-0' />
                                                    <p>
                                                        <span className='font-bold text-slate-700 uppercase mr-1'>Próximo:</span> 
                                                        {p.nextMilestone.nome} • {format(p.nextMilestone.data, 'dd/MM/yyyy')}
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="lg:col-span-1 space-y-8">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-rose-500" />
                                Demandas Críticas
                            </h2>
                            <div className="space-y-4">
                                <Card className='border-none shadow-sm'>
                                    <CardHeader className='pb-2 pt-4 px-4'>
                                        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-orange-600">
                                            Urgentes do Portal
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className='px-4 pb-4'>
                                        {demandasCriticas.urgentes.length === 0 ? <p className="text-sm text-slate-400 italic py-2">Nenhuma demanda urgente.</p> : (
                                            <ul className="space-y-3">
                                                {demandasCriticas.urgentes.map(d => (
                                                    <li key={d.id} className="text-sm border-b border-slate-50 last:border-0 pb-2">
                                                        <p className="font-semibold text-slate-800 truncate">{d.demanda}</p>
                                                        <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                            <span className='font-bold text-primary'>{d.municipio}</span>
                                                            <span className='opacity-50'>•</span>
                                                            <span className='flex items-center gap-1'><UserCog className='h-3 w-3'/> {d.responsavelNome.split(' ')[0]}</span>
                                                            {d.prazo && (
                                                                <>
                                                                    <span className='opacity-50'>•</span>
                                                                    <span className='font-medium text-rose-500'>{format(d.prazo.toDate(), 'dd/MM')}</span>
                                                                </>
                                                            )}
                                                        </p>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className='border-none shadow-sm'>
                                    <CardHeader className='pb-2 pt-4 px-4'>
                                        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-rose-600">
                                            Atrasadas
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className='px-4 pb-4'>
                                        {demandasCriticas.atrasadas.length === 0 ? <p className="text-sm text-slate-400 italic py-2">Nenhuma demanda atrasada.</p> : (
                                            <ul className="space-y-3">
                                                {demandasCriticas.atrasadas.map(d => (
                                                    <li key={d.id} className="text-sm border-b border-slate-50 last:border-0 pb-2">
                                                        <p className="font-semibold text-slate-800 truncate">{d.demanda}</p>
                                                        <p className="text-[11px] text-rose-500 font-medium mt-0.5">
                                                            {d.municipio} • Venceu {formatDistanceToNow(d.prazo!.toDate(), { addSuffix: true, locale: ptBR })}
                                                        </p>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-indigo-500" />
                                Agenda da Semana
                            </h2>
                            <Card className='border-none shadow-sm'>
                                <CardContent className='pt-6 px-4 pb-4'>
                                    {agendaDaSemana.length === 0 ? <p className="text-sm text-slate-400 italic text-center py-4">Nenhum evento importante para os próximos 7 dias.</p> : (
                                        <ul className="space-y-4">
                                            {agendaDaSemana.map((evento, index) => {
                                                const Icon = evento.type === 'formacao' ? KanbanSquare : (Object.entries(iconMapping).find(([key]) => evento.title.includes(key))?.[1] || Milestone);
                                                return (
                                                    <li key={index} className="flex items-start gap-4">
                                                        <div className="flex-shrink-0 text-center bg-slate-100 rounded-md py-1.5 px-2.5 min-w-[45px]">
                                                            <div className='text-sm font-bold text-primary leading-tight'>{format(evento.date, 'dd')}</div>
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase">{format(evento.date, 'MMM', { locale: ptBR })}</div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0"/>
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{evento.type === 'formacao' ? 'Formação' : 'Marco Projeto'}</span>
                                                            </div>
                                                            <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{evento.title}</p>
                                                        </div>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-2xl border-none">
                    {selectedProjeto && (
                        <>
                            <DialogHeader>
                                <div className='flex items-center gap-3'>
                                    <div className='p-2 bg-primary/10 rounded-lg'>
                                        <ClipboardList className='h-6 w-6 text-primary' />
                                    </div>
                                    <div>
                                        <DialogTitle className='text-xl font-bold text-slate-900'>{selectedProjeto.municipio} - {selectedProjeto.uf}</DialogTitle>
                                        <DialogDescription className='text-slate-500'>Visão detalhada e cronograma do projeto</DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh] px-1">
                                <DetalhesProjetoModal
                                    projeto={selectedProjeto}
                                    demandas={demandas}
                                    formadores={allFormadores.filter(f => selectedProjeto.formadoresIds?.includes(f.id))}
                                />
                            </ScrollArea>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProjetoImplatancao, Demanda, Formacao } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Clock, ListTodo, KanbanSquare, ClipboardList, Calendar, Users, Target, Flag, Milestone } from 'lucide-react';
import { format, isBefore, startOfToday, addDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

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

        return () => {
            unsubProjetos();
            unsubDemandas();
            unsubFormacoes();
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
            
            return {
                ...projeto,
                progress: calculateProgress(projeto),
                nextMilestone: getNextMilestone(projeto),
                demandasCount: demandasDoProjeto.length,
                demandasUrgentes,
                demandasAtrasadas,
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
        <div className="flex flex-col gap-8 py-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Visão Gerencial</h1>
                <p className="text-muted-foreground">Um panorama em tempo real das operações pedagógicas.</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Demandas em Aberto</CardTitle>
                        <ListTodo className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.demandasPendentes}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Formações Ativas</CardTitle>
                        <KanbanSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.formacoesAtivas}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projetos em Andamento ({new Date().getFullYear()})</CardTitle>
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.projetosAtivos}</div></CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-semibold">Status dos Projetos ({new Date().getFullYear()})</h2>
                    {projetosComDados.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Nenhum projeto para exibir.</p>
                    ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {projetosComDados.map(p => (
                                <Card key={p.id} className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{p.municipio} - {p.uf}</CardTitle>
                                        <CardDescription className="flex items-center gap-4 pt-2">
                                            {p.demandasCount > 0 && 
                                                <Badge variant="outline" className="flex items-center gap-1">
                                                    <ListTodo className="h-3 w-3"/>{p.demandasCount} {p.demandasCount === 1 ? 'demanda' : 'demandas'}
                                                </Badge>
                                            }
                                            {p.demandasAtrasadas > 0 && 
                                                <Badge variant="destructive" className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3"/>{p.demandasAtrasadas} {p.demandasAtrasadas === 1 ? 'atrasada' : 'atrasadas'}
                                                </Badge>
                                            }
                                            {p.demandasUrgentes > 0 &&
                                                 <Badge variant="destructive" className="flex items-center gap-1 bg-orange-500 text-white">
                                                    <AlertTriangle className="h-3 w-3"/>{p.demandasUrgentes} {p.demandasUrgentes === 1 ? 'urgente' : 'urgentes'}
                                                </Badge>
                                            }
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow space-y-3">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium">Progresso</span>
                                                <span className="text-muted-foreground">{p.progress.toFixed(0)}%</span>
                                            </div>
                                            <Progress value={p.progress} />
                                        </div>
                                        {p.nextMilestone && (
                                            <div className="text-sm text-muted-foreground">
                                                <strong>Próximo Marco:</strong> {p.nextMilestone.nome} em {format(p.nextMilestone.data, 'dd/MM/yyyy')}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                             ))}
                         </div>
                    )}
                </div>
                <div className="lg:col-span-1 space-y-6">
                     <div>
                        <h2 className="text-xl font-semibold mb-4">Demandas Críticas</h2>
                        <Card>
                            <CardHeader className='pb-2'>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-orange-500"/>
                                    Urgentes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {demandasCriticas.urgentes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma demanda urgente.</p> : (
                                    <ul className="space-y-2">
                                        {demandasCriticas.urgentes.map(d => (
                                            <li key={d.id} className="text-sm">
                                                <p className="font-medium truncate">{d.demanda}</p>
                                                <p className="text-xs text-muted-foreground">{d.municipio} • Resp: {d.responsavelNome}</p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="mt-4">
                            <CardHeader className='pb-2'>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-red-500"/>
                                    Atrasadas
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {demandasCriticas.atrasadas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma demanda atrasada.</p> : (
                                    <ul className="space-y-2">
                                        {demandasCriticas.atrasadas.map(d => (
                                            <li key={d.id} className="text-sm">
                                                <p className="font-medium truncate">{d.demanda}</p>
                                                <p className="text-xs text-muted-foreground">{d.municipio} • Venceu {formatDistanceToNow(d.prazo!.toDate(), { addSuffix: true, locale: ptBR })}</p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                     <div>
                        <h2 className="text-xl font-semibold mb-4">Agenda da Semana</h2>
                         <Card>
                             <CardContent className='pt-6'>
                                 {agendaDaSemana.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento importante para os próximos 7 dias.</p> : (
                                     <ul className="space-y-3">
                                         {agendaDaSemana.map((evento, index) => {
                                             const Icon = evento.type === 'formacao' ? KanbanSquare : (Object.entries(iconMapping).find(([key]) => evento.title.includes(key))?.[1] || Milestone);
                                             return (
                                                <li key={index} className="flex items-start gap-3 text-sm">
                                                     <div className="flex-shrink-0 text-center font-semibold text-primary">
                                                         <div>{format(evento.date, 'dd')}</div>
                                                         <div className="text-xs">{format(evento.date, 'MMM', { locale: ptBR })}</div>
                                                     </div>
                                                     <div className="flex items-center gap-2">
                                                        <Icon className="h-4 w-4 text-muted-foreground"/>
                                                        <span className="font-medium">{evento.title}</span>
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
    );
    
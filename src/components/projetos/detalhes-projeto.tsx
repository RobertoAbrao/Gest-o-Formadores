
'use client';

import type { ProjetoImplatancao, Material, Formador, Formacao } from '@/lib/types';
import { Timestamp, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Calendar, CheckCircle2, ClipboardList, BookOpen, Users, UserCheck, Milestone, Waypoints, Target, Flag, XCircle, Link as LinkIcon, Users2, Loader2, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface DetalhesProjetoProps {
  projeto: ProjetoImplatancao;
}

const formatDate = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('pt-BR');
};

const StatusIcon = ({ ok }: { ok?: boolean }) => {
    return ok ? (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
        <XCircle className="h-5 w-5 text-muted-foreground" />
    );
};

const DevolutivaCard = ({ numero, devolutiva, formacao }: { numero: number, devolutiva: any, formacao: Formacao | null }) => {
    
    const dataInicio = formacao?.dataInicio;
    const dataFim = formacao?.dataFim;
    const formador = formacao ? (formacao.formadoresNomes || []).join(', ') : devolutiva.formador;


    return (
        <div className="p-3 rounded-md border">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold">Devolutiva {numero}</h4>
                <StatusIcon ok={devolutiva?.ok} />
            </div>
            <Separator className='my-2' />
                <div className="space-y-2 text-sm">
                    <p><strong>Formador:</strong> {formador || 'N/A'}</p>
                    <p><strong>Início:</strong> {formatDate(dataInicio)}</p>
                    <p><strong>Fim:</strong> {formatDate(dataFim)}</p>
                    {devolutiva?.detalhes && <p className="text-xs text-muted-foreground pt-1">{devolutiva.detalhes}</p>}
                </div>
            {devolutiva?.formacaoId && (
                <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Formação associada:</p>
                    <Link href={`/quadro`} className="text-primary hover:underline text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {devolutiva.formacaoTitulo}
                    </Link>
                </div>
            )}
        </div>
    );
};


export function DetalhesProjeto({ projeto }: DetalhesProjetoProps) {
    const [formadores, setFormadores] = useState<Formador[]>([]);
    const [formacoes, setFormacoes] = useState<Map<string, Formacao>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const fetchPromises: Promise<any>[] = [];

                // Fetch Formadores
                if (projeto.formadoresIds && projeto.formadoresIds.length > 0) {
                    const qFormadores = query(collection(db, 'formadores'), where('__name__', 'in', projeto.formadoresIds));
                    fetchPromises.push(getDocs(qFormadores));
                } else {
                    fetchPromises.push(Promise.resolve(null));
                }

                // Fetch Formações from Devolutivas
                const formacaoIds = Object.values(projeto.devolutivas || {})
                    .map(d => d.formacaoId)
                    .filter((id): id is string => !!id);

                if (formacaoIds.length > 0) {
                     const qFormacoes = query(collection(db, 'formacoes'), where('__name__', 'in', formacaoIds));
                    fetchPromises.push(getDocs(qFormacoes));
                } else {
                    fetchPromises.push(Promise.resolve(null));
                }
                
                const [formadoresSnap, formacoesSnap] = await Promise.all(fetchPromises);

                if (formadoresSnap) {
                     setFormadores(formadoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador)));
                }

                if (formacoesSnap) {
                    const formacoesMap = new Map<string, Formacao>();
                    formacoesSnap.docs.forEach(doc => {
                        formacoesMap.set(doc.id, { id: doc.id, ...doc.data() } as Formacao);
                    });
                    setFormacoes(formacoesMap);
                }
                

            } catch (error) {
                console.error("Failed to fetch project details:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projeto]);

    if (loading) {
        return (
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                        <ClipboardList className="h-6 w-6"/>
                        {projeto.municipio} - {projeto.uf}
                    </CardTitle>
                    <CardDescription>
                        Versão: {projeto.versao || 'N/A'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Material</p>
                            <p className="text-muted-foreground">{projeto.material || 'N/A'}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Alunos</p>
                            <p className="text-muted-foreground">{projeto.qtdAlunos || 'N/A'}</p>
                        </div>
                    </div>
                     <div className="flex items-start gap-3 col-span-full">
                        <UserCheck className="h-5 w-5 text-muted-foreground mt-1" />
                        <div>
                            <p className="font-medium">Formadores</p>
                            {formadores.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {formadores.map(f => <Badge key={f.id} variant="secondary">{f.nomeCompleto}</Badge>)}
                                </div>
                            ) : <p className="text-muted-foreground">N/A</p>}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Milestone className="h-5 w-5 text-muted-foreground" />
                        Datas Importantes
                    </CardTitle>
                </CardHeader>
                 <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Migração de Dados</p>
                            <p className="text-muted-foreground">{formatDate(projeto.dataMigracao)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Implantação</p>
                            <p className="text-muted-foreground">{formatDate(projeto.dataImplantacao)}</p>
                        </div>
                    </div>
                 </CardContent>
            </Card>

            {projeto.reunioes && projeto.reunioes.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users2 className="h-5 w-5 text-muted-foreground" />
                            Reuniões Agendadas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {projeto.reunioes.map((reuniao, reuniaoIndex) => (
                            <div key={reuniaoIndex} className="p-3 border rounded-lg">
                                <div className="flex items-center gap-3 mb-3">
                                    <Calendar className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">Data da Reunião {reuniaoIndex + 1}</p>
                                        <p className="text-muted-foreground text-sm">{formatDate(reuniao.data)}</p>
                                    </div>
                                </div>
                                {reuniao.links && reuniao.links.length > 0 && (
                                    <div className='space-y-2 text-sm'>
                                        <p className="font-medium">Links da Reunião</p>
                                        {reuniao.links.map((link, index) => (
                                            link.url && (
                                                <div key={index} className="flex items-center gap-2 text-primary">
                                                    <LinkIcon className='h-4 w-4' />
                                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                                        {link.descricao || `Link ${index + 1}`}
                                                    </a>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
            
            <Card>
                 <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-muted-foreground" />
                        Avaliações e Simulados
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <span className="font-medium text-sm">Avaliação Diagnóstica</span>
                        <div className='flex items-center gap-2'>
                            <span className="text-sm text-muted-foreground">{formatDate(projeto.diagnostica?.data)}</span>
                            <StatusIcon ok={projeto.diagnostica?.ok} />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {([1, 2, 3, 4] as const).map(i => (
                             <div key={`s${i}`} className="p-3 rounded-md border">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm">Simulado {i}</h4>
                                    <StatusIcon ok={projeto.simulados?.[`s${i}`]?.ok} />
                                </div>
                                <Separator className="my-2" />
                                <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs">
                                     <p><strong className="text-muted-foreground">Início:</strong> {formatDate(projeto.simulados?.[`s${i}`]?.dataInicio)}</p>
                                     <p><strong className="text-muted-foreground">Fim:</strong> {formatDate(projeto.simulados?.[`s${i}`]?.dataFim)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Flag className="h-5 w-5 text-muted-foreground" />
                        Cronograma de Devolutivas
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     {([1, 2, 3, 4] as const).map(i => {
                         const devolutiva = projeto.devolutivas?.[`d${i}`];
                         const formacao = devolutiva?.formacaoId ? formacoes.get(devolutiva.formacaoId) : null;
                         return (
                            <DevolutivaCard key={`d${i}`} numero={i} devolutiva={devolutiva} formacao={formacao || null} />
                         )
                    })}
                </CardContent>
            </Card>
        </div>
    );
}

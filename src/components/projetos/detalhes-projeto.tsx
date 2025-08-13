
'use client';

import type { ProjetoImplatancao, Material } from '@/lib/types';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Calendar, CheckCircle2, ClipboardList, BookOpen, Users, UserCheck, Milestone, Waypoints, Target, Flag, XCircle, Link as LinkIcon, Users2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';

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

export function DetalhesProjeto({ projeto }: DetalhesProjetoProps) {
    const [material, setMaterial] = useState<Material | null>(null);
    const [loadingMaterial, setLoadingMaterial] = useState(false);

    useEffect(() => {
        const fetchMaterial = async () => {
            if (!projeto.materialId) return;
            setLoadingMaterial(true);
            try {
                const materialRef = doc(db, 'materiais', projeto.materialId);
                const materialSnap = await getDoc(materialRef);
                if (materialSnap.exists()) {
                    setMaterial({ id: materialSnap.id, ...materialSnap.data() } as Material);
                }
            } catch (error) {
                console.error("Failed to fetch material details:", error);
            } finally {
                setLoadingMaterial(false);
            }
        };

        fetchMaterial();
    }, [projeto.materialId]);

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
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Material</p>
                            {loadingMaterial ? <Loader2 className="h-4 w-4 animate-spin"/> : <p className="text-muted-foreground">{material?.titulo || 'N/A'}</p>}
                        </div>
                    </div>
                     <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Alunos</p>
                            <p className="text-muted-foreground">{projeto.qtdAlunos || 'N/A'}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-3">
                        <UserCheck className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Formadores</p>
                            <p className="text-muted-foreground">{projeto.qtdFormadores || 'N/A'}</p>
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
                             <div key={`s${i}`} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                <span className="font-medium text-sm">Simulado {i}</span>
                                <div className='flex items-center gap-2'>
                                    <span className="text-sm text-muted-foreground">{formatDate(projeto.simulados?.[`s${i}`]?.data)}</span>
                                    <StatusIcon ok={projeto.simulados?.[`s${i}`]?.ok} />
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
                         const isD4 = i === 4;
                         return (
                            <div key={`d${i}`} className="p-3 rounded-md border">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold">Devolutiva {i}</h4>
                                    <StatusIcon ok={devolutiva?.ok} />
                                </div>
                                <Separator className="my-2" />
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <p><strong className="text-muted-foreground">Formador:</strong> {devolutiva?.formador || 'N/A'}</p>
                                    {isD4 ? (
                                         <p><strong className="text-muted-foreground">Data:</strong> {formatDate((devolutiva as any)?.data)}</p>
                                    ) : (
                                        <>
                                            <p><strong className="text-muted-foreground">Início:</strong> {formatDate(devolutiva?.dataInicio)}</p>
                                            <p><strong className="text-muted-foreground">Fim:</strong> {formatDate(devolutiva?.dataFim)}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                         )
                    })}
                </CardContent>
            </Card>
        </div>
    );
}

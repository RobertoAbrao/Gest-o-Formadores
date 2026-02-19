
'use client';

import type { ProjetoImplatancao, Demanda, Formador } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { CheckCircle2, XCircle, ListTodo, AlertTriangle, Clock, User } from 'lucide-react';
import { format, isBefore, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// This will receive a single enriched project object
interface DetalhesProjetoModalProps {
  projeto: (ProjetoImplatancao & { progress: number; nextMilestone: { nome: string; data: Date } | null; demandasCount: number; demandasUrgentes: number; demandasAtrasadas: number; atividades: any[]; demandasGerais: Demanda[]; });
  demandas: Demanda[];
  formadores: Formador[];
}

const formatDate = (date: Date | null | undefined): string => {
    if (!date) return 'N/A';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
};

const StatusIcon = ({ ok }: { ok?: boolean }) => {
    return ok ? (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
        <XCircle className="h-5 w-5 text-muted-foreground" />
    );
};


export function DetalhesProjetoModal({ projeto, demandas, formadores }: DetalhesProjetoModalProps) {
  return (
    <div className="space-y-6 p-1">
      <Card>
        <CardHeader>
          <CardTitle>Progresso Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">Conclusão das Etapas</span>
            <span className="text-muted-foreground">{projeto.progress.toFixed(0)}%</span>
          </div>
          <Progress value={projeto.progress} />
          {projeto.nextMilestone && (
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Próximo Marco:</strong> {projeto.nextMilestone.nome} em {format(projeto.nextMilestone.data, 'dd/MM/yyyy')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cronograma de Atividades e Demandas</CardTitle>
          <CardDescription>Acompanhe o status de cada etapa e as tarefas do Diário de Bordo vinculadas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projeto.atividades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum marco definido para este projeto.</p>
          ) : (
            projeto.atividades.map((atividade, index) => (
              <div key={index} className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{atividade.nome}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(atividade.startDate)}</span>
                    <StatusIcon ok={atividade.ok} />
                  </div>
                </div>
                {atividade.demandas.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {atividade.demandas.map((demanda: Demanda) => (
                      <div key={demanda.id} className="text-sm p-2 rounded-md bg-background/50">
                        <p className="font-medium flex items-center gap-2">
                          {demanda.prioridade === 'Urgente' && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                          {demanda.prazo && isBefore(demanda.prazo.toDate(), startOfToday()) && <Clock className="h-4 w-4 text-red-500" />}
                          {demanda.demanda}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Responsável: {demanda.responsavelNome} • Status: {demanda.status}
                            {demanda.prazo && ` • Prazo: ${format(demanda.prazo.toDate(), 'dd/MM/yyyy')}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {projeto.demandasGerais && projeto.demandasGerais.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demandas Gerais do Projeto</CardTitle>
            <CardDescription>Tarefas que não estão vinculadas a uma etapa específica do cronograma.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {projeto.demandasGerais.map((demanda: Demanda) => (
              <div key={demanda.id} className="text-sm p-2 rounded-md bg-muted/30">
                <p className="font-medium flex items-center gap-2">
                  {demanda.prioridade === 'Urgente' && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                  {demanda.prazo && isBefore(demanda.prazo.toDate(), startOfToday()) && <Clock className="h-4 w-4 text-red-500" />}
                  {demanda.demanda}
                </p>
                <p className="text-xs text-muted-foreground">
                    Responsável: {demanda.responsavelNome} • Status: {demanda.status}
                    {demanda.prazo && ` • Prazo: ${format(demanda.prazo.toDate(), 'dd/MM/yyyy')}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
            <CardTitle>Responsáveis</CardTitle>
        </CardHeader>
        <CardContent>
            {formadores.length > 0 ? (
                <ul className="space-y-2">
                    {formadores.map(formador => (
                        <li key={formador.id} className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground"/>
                            <span>{formador.nomeCompleto}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">Nenhum formador associado.</p>
            )}
        </CardContent>
      </Card>
    </div>
  )
}


'use client';

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Formacao, Lembrete, ProjetoImplatancao } from "@/lib/types";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { ptBR } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { startOfDay, subDays } from "date-fns";
import { Loader2 } from "lucide-react";

type CalendarEvent = {
    date: Date;
    type: 'formacao' | 'projeto-marco' | 'projeto-acompanhamento' | 'lembrete';
}

export default function CalendarioPage() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const formacoesCol = collection(db, 'formacoes');
                const projetosCol = collection(db, 'projetos');
                const lembretesCol = collection(db, 'lembretes');

                const activeFormacoesQuery = query(formacoesCol, where('status', '!=', 'arquivado'));
                
                const [formacoesSnap, projetosSnap, lembretesSnap] = await Promise.all([
                    getDocs(activeFormacoesQuery),
                    getDocs(projetosCol),
                    getDocs(query(lembretesCol, where('concluido', '==', false)))
                ]);

                const allEvents: CalendarEvent[] = [];

                formacoesSnap.forEach(doc => {
                    const formacao = { id: doc.id, ...doc.data() } as Formacao;
                    if (formacao.dataInicio) allEvents.push({ date: formacao.dataInicio.toDate(), type: 'formacao' });
                    if (formacao.dataFim) allEvents.push({ date: formacao.dataFim.toDate(), type: 'formacao' });
                    if(formacao.logistica) {
                        formacao.logistica.forEach(item => {
                            if(item.alertaLembrete && item.diasLembrete && item.checkin) {
                               const alertDate = subDays(item.checkin.toDate(), item.diasLembrete);
                               allEvents.push({ date: alertDate, type: 'lembrete' });
                            }
                        })
                    }
                });

                projetosSnap.forEach(doc => {
                    const projeto = { id: doc.id, ...doc.data() } as ProjetoImplatancao;
                    if (projeto.dataMigracao) allEvents.push({ date: projeto.dataMigracao.toDate(), type: 'projeto-marco' });
                    if (projeto.dataImplantacao) allEvents.push({ date: projeto.dataImplantacao.toDate(), type: 'projeto-marco' });
                    if (projeto.simulados) {
                        Object.values(projeto.simulados).forEach(simulado => {
                            if (simulado?.dataInicio) allEvents.push({ date: (simulado.dataInicio as Timestamp).toDate(), type: 'projeto-acompanhamento' });
                            if (simulado?.dataFim) allEvents.push({ date: (simulado.dataFim as Timestamp).toDate(), type: 'projeto-acompanhamento' });
                        });
                    }
                    if (projeto.devolutivas) {
                        Object.values(projeto.devolutivas).forEach(devolutiva => {
                             if (devolutiva && (devolutiva as any).data) { // For d4
                                allEvents.push({ date: (devolutiva as any).data.toDate(), type: 'projeto-acompanhamento' });
                            } else if (devolutiva) { // For d1, d2, d3
                                if (devolutiva.dataInicio) allEvents.push({ date: devolutiva.dataInicio.toDate(), type: 'projeto-acompanhamento' });
                                if (devolutiva.dataFim) allEvents.push({ date: devolutiva.dataFim.toDate(), type: 'projeto-acompanhamento' });
                            }
                        });
                    }
                });

                lembretesSnap.forEach(doc => {
                    const lembrete = { id: doc.id, ...doc.data() } as Lembrete;
                    allEvents.push({ date: lembrete.data.toDate(), type: 'lembrete' });
                });
                
                setEvents(allEvents);

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const eventDaysByType = useMemo(() => {
        return events.reduce((acc, event) => {
            const eventType = event.type;
            if (!acc[eventType]) {
                acc[eventType] = [];
            }
            acc[eventType].push(startOfDay(event.date));
            return acc;
        }, {} as Record<CalendarEvent['type'], Date[]>);
      }, [events]);

    const modifiers = {
        formacao: eventDaysByType['formacao'] || [],
        'projeto-marco': eventDaysByType['projeto-marco'] || [],
        'projeto-acompanhamento': eventDaysByType['projeto-acompanhamento'] || [],
        lembrete: eventDaysByType['lembrete'] || [],
    };

    const modifiersStyles = {
        formacao: { backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' },
        'projeto-marco': { backgroundColor: 'hsl(var(--accent) / 0.1)', color: 'hsl(var(--accent-foreground))' },
        'projeto-acompanhamento': { backgroundColor: 'hsl(var(--chart-4) / 0.1)', color: 'hsl(var(--chart-4))' },
        lembrete: { backgroundColor: 'hsl(var(--chart-3) / 0.1)', color: 'hsl(var(--chart-3))' },
    };
    
    if (loading) {
        return (
          <div className="flex h-[80vh] w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 py-6 h-full">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Calendário Anual - {currentYear}</h1>
                <p className="text-muted-foreground">Visão geral de todos os eventos registrados no sistema.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {months.map(month => (
                    <Card key={month}>
                        <CardHeader>
                            <CardTitle>
                                {new Date(currentYear, month).toLocaleString('pt-BR', { month: 'long' })}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Calendar
                                month={new Date(currentYear, month)}
                                mode="single"
                                locale={ptBR}
                                modifiers={modifiers}
                                modifiersStyles={modifiersStyles}
                                className="p-0"
                                classNames={{
                                    day_selected: "hidden", // We don't want selection behavior
                                    day: "h-8 w-8",
                                    head_cell: "w-8"
                                }}
                            />
                        </CardContent>
                    </Card>
                ))}
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Legenda</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="w-full space-y-2 text-sm p-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: modifiersStyles.formacao.backgroundColor, border: `1px solid ${modifiersStyles.formacao.color}` }} />
                            <span className="text-muted-foreground">Formações</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: modifiersStyles['projeto-marco'].backgroundColor, border: `1px solid ${modifiersStyles['projeto-marco'].color}` }}/>
                            <span className="text-muted-foreground">Marcos de Projeto</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: modifiersStyles['projeto-acompanhamento'].backgroundColor, border: `1px solid ${modifiersStyles['projeto-acompanhamento'].color}` }}/>
                            <span className="text-muted-foreground">Acompanhamentos</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: modifiersStyles.lembrete.backgroundColor, border: `1px solid ${modifiersStyles.lembrete.color}` }}/>
                            <span className="text-muted-foreground">Lembretes</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

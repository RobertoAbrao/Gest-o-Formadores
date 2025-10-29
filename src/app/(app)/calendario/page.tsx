
'use client';

import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

export default function CalendarioPage() {
  const year = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => i);
  const [selectedDays, setSelectedDays] = useState<Date[]>([]);

  const handleDayClick = (day: Date) => {
    const isSelected = selectedDays.some(selectedDay => 
        selectedDay.getDate() === day.getDate() &&
        selectedDay.getMonth() === day.getMonth() &&
        selectedDay.getFullYear() === day.getFullYear()
    );

    if (isSelected) {
      setSelectedDays(selectedDays.filter(selectedDay => 
          !(selectedDay.getDate() === day.getDate() &&
            selectedDay.getMonth() === day.getMonth() &&
            selectedDay.getFullYear() === day.getFullYear())
      ));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Calendário Anual {year}</h1>
          <p className="text-muted-foreground">
            Visão completa de todos os meses do ano. Clique em um dia para selecioná-lo.
          </p>
        </div>
      </div>
      
      <Card className='p-4'>
            <CardHeader className='p-2'>
                <CardTitle className='text-lg'>Legenda</CardTitle>
            </CardHeader>
            <CardContent className='p-2'>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-200"></div>Estudo e Planejamento</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-200"></div>Feriado</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-indigo-200"></div>Recesso escolar</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-yellow-200"></div>Conselho de Classe</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-orange-200 border-2 border-orange-300"></div>Avaliação Trimestral</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-200"></div>Simulado</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-purple-200"></div>Devolutiva</div>
                    <div className="flex items-center gap-2"><span className="font-bold underline">__</span>Início/Término</div>
                </div>
            </CardContent>
        </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {months.map(month => {
          const monthDate = new Date(year, month);
          const monthName = monthDate.toLocaleString('pt-BR', { month: 'long' });

          return (
            <Card key={month}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-center capitalize">{monthName}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  month={monthDate}
                  className="p-0"
                  classNames={{
                    day: "h-8 w-8",
                    head_cell: "w-8",
                  }}
                  locale={ptBR}
                  selected={selectedDays}
                  onDayClick={handleDayClick}
                  modifiersStyles={{
                    selected: { 
                      backgroundColor: 'hsl(var(--primary))', 
                      color: 'hsl(var(--primary-foreground))' 
                    }
                  }}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  );
}

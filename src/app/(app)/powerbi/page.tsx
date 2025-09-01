
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";

export default function PowerBIPage() {
  return (
    <div className="flex flex-col gap-4 py-6 h-full">
       <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Relatórios Power BI</h1>
            <p className="text-muted-foreground">Visualize seus dashboards interativos.</p>
        </div>
      </div>

      <Card className="h-full min-h-[70vh]">
        <CardHeader>
            <CardTitle>Dashboard Interativo</CardTitle>
            <CardDescription>
                Esta é uma área reservada para a incorporação de um relatório do Power BI.
            </CardDescription>
        </CardHeader>
        <CardContent className="h-full">
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed rounded-lg p-8 text-center">
                <BarChart2 className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Espaço para Relatório do Power BI</h3>
                <p className="text-sm text-muted-foreground mt-2">
                    Para exibir seu relatório aqui, você precisará obter o código de incorporação (iframe) do Power BI e colá-lo neste arquivo.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

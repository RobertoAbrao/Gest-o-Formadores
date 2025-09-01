
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PowerBIPage() {
  return (
    <div className="flex flex-col gap-4 py-6 h-full">
       <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Relatórios Power BI</h1>
            <p className="text-muted-foreground">Visualize seus dashboards interativos.</p>
        </div>
      </div>

      <Card className="h-full min-h-[80vh] flex flex-col">
        <CardHeader>
            <CardTitle>Duque de Caxias - Resultados</CardTitle>
            <CardDescription>
                Dashboard interativo incorporado do Power BI.
            </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-0">
            <iframe 
                title="Duque de Caxias - Resultados" 
                width="100%" 
                height="100%" 
                src="https://app.powerbi.com/reportEmbed?reportId=d344eeef-1a02-4680-a68b-aef2f280654f&autoAuth=true&ctid=3923eeac-37fc-448a-96b0-374510edd804" 
                frameBorder="0" 
                allowFullScreen={true}
                className="border-none rounded-b-lg"
            ></iframe>
        </CardContent>
      </Card>
    </div>
  );
}

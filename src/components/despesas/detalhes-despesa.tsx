
'use client';

import type { Despesa } from '@/lib/types';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Calendar, DollarSign, Grip, Link as LinkIcon, FileText, Utensils, Car, Building, Book } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface DetalhesDespesaProps {
  despesa: Despesa;
}

const typeIcons = {
  'Alimentação': Utensils,
  'Transporte': Car,
  'Hospedagem': Building,
  'Material Didático': Book,
  'Outros': Grip,
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};


export function DetalhesDespesa({ despesa }: DetalhesDespesaProps) {
    const Icon = typeIcons[despesa.tipo] || FileText;

    return (
        <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 p-4">
                <div className="space-y-4">
                    <h4 className="font-semibold text-lg">{despesa.descricao}</h4>
                    <Separator />
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center gap-3">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Valor</p>
                                <p className="font-medium text-primary text-lg">{formatCurrency(despesa.valor)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Tipo</p>
                                <Badge variant="outline">{despesa.tipo}</Badge>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Data</p>
                                <p className="font-medium">{despesa.data.toDate().toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {despesa.comprovanteUrl && (
                    <div className="space-y-4 pt-4 border-t">
                        <h4 className="font-semibold text-lg">Comprovante</h4>
                        <div className="flex items-center gap-3 p-2 border rounded-md">
                           <LinkIcon className="h-5 w-5 text-primary" />
                            <a 
                                href={despesa.comprovanteUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm text-primary hover:underline truncate"
                            >
                                {despesa.comprovanteUrl}
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}


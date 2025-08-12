
'use client';

import type { Formador } from '@/lib/types';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { User, Mail, Building, BookText, BookMark, Phone, CreditCard, Banknote } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

interface DetalhesFormadorProps {
  formador: Formador;
}

const formatCPF = (cpf: string) => {
    if (!cpf) return 'N/A';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

const formatTelefone = (telefone: string) => {
    if (!telefone) return 'N/A';
    if (telefone.length === 11) {
        return telefone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return telefone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
}

export function DetalhesFormador({ formador }: DetalhesFormadorProps) {
    return (
        <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 p-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <User className="h-6 w-6"/>
                            {formador.nomeCompleto}
                        </CardTitle>
                        <CardDescription>
                            {formador.disciplina ? (
                                <Badge variant="outline">{formador.disciplina}</Badge>
                             ) : "Formador(a)"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                            <span>{formador.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                            <span>CPF: {formatCPF(formador.cpf)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-5 w-5 text-muted-foreground" />
                            <span>Telefone: {formatTelefone(formador.telefone)}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                             <Building className="h-5 w-5 text-muted-foreground" />
                            Responsabilidades
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm font-medium mb-2">Municípios de Responsabilidade ({formador.uf})</p>
                        <div className="flex flex-wrap gap-2">
                            {formador.municipiosResponsaveis.map((municipio) => (
                                <Badge key={municipio} variant="secondary">
                                {municipio}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {formador.curriculo && (
                  <Card>
                    <CardHeader>
                         <CardTitle className="text-lg flex items-center gap-2">
                            <BookText className="h-5 w-5 text-muted-foreground" />
                            Currículo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {formador.curriculo}
                        </p>
                    </CardContent>
                  </Card>
                )}
                
                {(formador.banco || formador.pix) && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Banknote className="h-5 w-5 text-muted-foreground" />
                                Dados Bancários
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {formador.banco && formador.agencia && formador.conta && (
                                <div>
                                    <p><strong>Banco:</strong> {formador.banco}</p>
                                    <p><strong>Agência:</strong> {formador.agencia}</p>
                                    <p><strong>Conta:</strong> {formador.conta}</p>
                                </div>
                            )}
                            {formador.pix && (
                                <div>
                                    <p><strong>PIX:</strong> {formador.pix}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </ScrollArea>
    );
}

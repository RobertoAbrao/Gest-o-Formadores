
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  getDocs,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import * as React from 'react';
import { format } from "date-fns"
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { useState, useEffect, useMemo } from 'react';
import { Loader2, Check, ChevronsUpDown, CalendarIcon, X, User, Plane, Hotel, HandCoins, Info } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import type { Formacao, Formador, LogisticaViagem } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ComboboxMateriais } from '../materiais/combobox-materiais';
import { Calendar } from '../ui/calendar';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const logisticaSchema = z.object({
    formadorId: z.string(),
    formadorNome: z.string(),
    cpf: z.string().optional(),
    rg: z.string().optional(),
    dataNascimento: z.date().optional().nullable(),
    pix: z.string().optional(),

    valorPassagem: z.preprocess(
      (a) => a ? parseFloat(String(a).replace(",", ".")) : undefined,
      z.number().optional()
    ),
    trecho: z.string().optional(),

    hotel: z.string().optional(),
    checkin: z.date().optional().nullable(),
    checkout: z.date().optional().nullable(),
    valorDiaria: z.preprocess(
      (a) => a ? parseFloat(String(a).replace(",", ".")) : undefined,
      z.number().optional()
    ),
    
    adiantamento: z.preprocess(
      (a) => a ? parseFloat(String(a).replace(",", ".")) : undefined,
      z.number().optional()
    ),
    custosExtras: z.preprocess(
      (a) => a ? parseFloat(String(a).replace(",", ".")) : undefined,
      z.number().optional()
    ),
});

const formSchema = z.object({
  titulo: z
    .string()
    .min(3, { message: 'O título deve ter pelo menos 3 caracteres.' }),
  descricao: z
    .string()
    .min(10, { message: 'A descrição deve ter pelo menos 10 caracteres.' }),
  formadoresIds: z.array(z.string()).min(1, { message: 'Selecione ao menos um formador.'}),
  municipio: z.string().min(1, { message: 'Selecione um município.' }),
  uf: z.string().optional(),
  participantes: z.preprocess(
    (val) => Number(val),
    z.number().min(1, { message: 'Deve haver pelo menos 1 participante.' })
  ).optional(),
  materiaisIds: z.array(z.string()).optional(),
  dataInicio: z.date().optional(),
  dataFim: z.date().optional(),
  logistica: z.array(logisticaSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FormFormacaoProps {
  formacao?: Formacao | null;
  onSuccess: () => void;
}

const generateFormationCode = (municipio: string) => {
    const municipioPart = municipio.substring(0, 4).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${municipioPart}-${randomPart}`;
};

const toDate = (timestamp: Timestamp | null | undefined): Date | undefined => {
    if (!timestamp) return undefined;
    return timestamp.toDate();
};

const toNullableDate = (timestamp: Timestamp | null | undefined): Date | null | undefined => {
    if (timestamp === undefined) return undefined;
    if (timestamp === null) return null;
    return timestamp.toDate();
};

export function FormFormacao({ formacao, onSuccess }: FormFormacaoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [open, setOpen] = React.useState(false);
  
  const isEditMode = !!formacao;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      formadoresIds: [],
      municipio: '',
      uf: '',
      participantes: 1,
      materiaisIds: [],
      dataInicio: undefined,
      dataFim: undefined,
      logistica: [],
    },
  });

  const { fields: logisticaFields, replace: replaceLogistica } = useFieldArray({
    control: form.control,
    name: "logistica",
  });

  useEffect(() => {
    const fetchFormadores = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'formadores'));
            const formadoresData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
            setFormadores(formadoresData);
        } catch (error) {
            console.error("Failed to fetch formadores", error);
        } finally {
            setLoading(false);
        }
    };
    fetchFormadores();
  }, []);

  const selectedFormadoresIds = form.watch('formadoresIds');

  const availableMunicipios = useMemo(() => {
    if (formadores.length === 0) return [];
    
    const selected = formadores.filter(f => selectedFormadoresIds.includes(f.id));
    const allMunicipios = selected.flatMap(f => f.municipiosResponsaveis);
    
    if (isEditMode && formacao?.municipio && !allMunicipios.includes(formacao.municipio)) {
      allMunicipios.push(formacao.municipio);
    }
    
    return [...new Set(allMunicipios)].sort();
  }, [selectedFormadoresIds, formadores, isEditMode, formacao]);

  useEffect(() => {
    if (formacao && formadores.length > 0) {
      form.reset({
        titulo: formacao.titulo || '',
        descricao: formacao.descricao || '',
        formadoresIds: formacao.formadoresIds || [],
        municipio: formacao.municipio || '',
        uf: formacao.uf || '',
        participantes: formacao.participantes || 1,
        materiaisIds: formacao.materiaisIds || [],
        dataInicio: toDate(formacao.dataInicio),
        dataFim: toDate(formacao.dataFim),
        logistica: formacao.logistica?.map(l => ({
            ...l,
            checkin: toNullableDate(l.checkin),
            checkout: toNullableDate(l.checkout),
            valorDiaria: l.valorDiaria || undefined,
            valorPassagem: l.valorPassagem || undefined,
            adiantamento: l.adiantamento || undefined,
            custosExtras: l.custosExtras || undefined,
            dataNascimento: toNullableDate(l.dataNascimento),
        })) || [],
      });
    }
  }, [formacao, formadores, form]);
  
  useEffect(() => {
    if (formadores.length > 0) {
      const selected = formadores.filter(f => selectedFormadoresIds.includes(f.id));

      if (selected.length > 0 && selected[0].uf) {
        form.setValue('uf', selected[0].uf);
      } else if (selected.length === 0) {
        form.setValue('uf', '');
      }

      const currentLogistica = form.getValues('logistica') || [];
      const newLogistica = selected.map(formador => {
        const existing = currentLogistica.find(l => l.formadorId === formador.id);
        return existing || {
          formadorId: formador.id,
          formadorNome: formador.nomeCompleto,
          cpf: formador.cpf,
          pix: formador.pix,
          rg: '',
          dataNascimento: null,
          valorPassagem: undefined,
          trecho: '',
          hotel: '',
          checkin: null,
          checkout: null,
          valorDiaria: undefined,
          adiantamento: undefined,
          custosExtras: undefined,
        };
      });
      replaceLogistica(newLogistica);
    }
  }, [selectedFormadoresIds, formadores, form, replaceLogistica]);


  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      
      const formadoresNomes = formadores
        .filter(f => values.formadoresIds.includes(f.id))
        .map(f => f.nomeCompleto);

      const dataToSave = {
          ...values,
          formadoresNomes,
          dataInicio: values.dataInicio ? Timestamp.fromDate(values.dataInicio) : null,
          dataFim: values.dataFim ? Timestamp.fromDate(values.dataFim) : null,
          logistica: values.logistica?.map(l => ({
            ...l,
            checkin: l.checkin ? Timestamp.fromDate(l.checkin) : null,
            checkout: l.checkout ? Timestamp.fromDate(l.checkout) : null,
            valorDiaria: l.valorDiaria || null,
            valorPassagem: l.valorPassagem || null,
            adiantamento: l.adiantamento || null,
            custosExtras: l.custosExtras || null,
            dataNascimento: l.dataNascimento ? Timestamp.fromDate(l.dataNascimento) : null,
          }))
      };

      if (isEditMode && formacao) {
         await updateDoc(doc(db, 'formacoes', formacao.id), dataToSave as any);
         toast({ title: 'Sucesso!', description: 'Formação atualizada com sucesso.' });
      } else {
        const newDocRef = doc(collection(db, 'formacoes'));
        await setDoc(newDocRef, {
            ...dataToSave,
            id: newDocRef.id,
            codigo: generateFormationCode(values.municipio),
            status: 'preparacao',
            avaliacoesAbertas: false,
            dataCriacao: serverTimestamp(),
        } as any);
        toast({ title: 'Sucesso!', description: 'Formação criada com sucesso.' });
      }
      onSuccess();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao criar a formação.',
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedFormadores = formadores.filter(f => form.watch('formadoresIds').includes(f.id));

  const handleSelectFormador = (formadorId: string) => {
    const currentIds = form.getValues('formadoresIds') || [];

    const newIds = currentIds.includes(formadorId)
      ? currentIds.filter(id => id !== formadorId)
      : [...currentIds, formadorId];
      
    form.setValue('formadoresIds', newIds, { shouldValidate: true });

    const currentMunicipio = form.getValues('municipio');
    if (!newIds.some(id => formadores.find(f => f.id === id)?.municipiosResponsaveis.includes(currentMunicipio))) {
      form.setValue('municipio', '');
    }
  };

  const handleMunicipioChange = (municipio: string) => {
    form.setValue('municipio', municipio, { shouldValidate: true });
    if (!isEditMode && municipio) {
        const title = `Formação ${municipio}`;
        const desc = `Acompanhamento pedagógico para o município de ${municipio}.`;
        form.setValue('titulo', title, { shouldValidate: true });
        form.setValue('descricao', desc, { shouldValidate: true });
    }
  }
  
  const getTriggerText = () => {
    if (selectedFormadores.length === 0) return "Selecione formadores...";
    if (selectedFormadores.length === 1) return selectedFormadores[0].nomeCompleto;
    return `${selectedFormadores.length} formadores selecionados`;
  };

  const calculateTotalCost = (logisticaItem: any) => {
    const passagem = logisticaItem.valorPassagem || 0;
    const adiantamento = logisticaItem.adiantamento || 0;
    const extras = logisticaItem.custosExtras || 0;

    const checkin = logisticaItem.checkin;
    const checkout = logisticaItem.checkout;
    const valorDiaria = logisticaItem.valorDiaria || 0;

    let hospedagemTotal = 0;
    if (checkin && checkout && valorDiaria > 0) {
      const diffTime = checkout.getTime() - checkin.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        hospedagemTotal = diffDays * valorDiaria;
      }
    }
    
    return passagem + adiantamento + extras + hospedagemTotal;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <FormField
          control={form.control}
          name="formadoresIds"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Formadores</FormLabel>
                <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        <span className="truncate">{getTriggerText()}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar formador..." />
                        <CommandList>
                            <CommandEmpty>Nenhum formador encontrado.</CommandEmpty>
                            <CommandGroup>
                                {formadores.map((formador) => (
                                    <CommandItem
                                        key={formador.id}
                                        value={formador.nomeCompleto}
                                        onSelect={() => handleSelectFormador(formador.id)}
                                    >
                                        <Check
                                            className={cn(
                                                'mr-2 h-4 w-4',
                                                field.value.includes(formador.id) ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                        {formador.nomeCompleto}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {selectedFormadores.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-1">
                {selectedFormadores.map(formador => (
                  <Badge key={formador.id} variant="secondary">
                    {formador.nomeCompleto}
                    <button
                      type="button"
                      className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onClick={() => handleSelectFormador(formador.id)}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="municipio"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Município</FormLabel>
                    <Select 
                        onValueChange={handleMunicipioChange} 
                        value={field.value}
                        disabled={availableMunicipios.length === 0}
                    >
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o município" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {availableMunicipios.map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
                control={form.control}
                name="participantes"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nº de Participantes</FormLabel>
                    <FormControl>
                        <Input type="number" min="1" placeholder="Ex: 25" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
          control={form.control}
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título da Formação</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Formação Inicial 2024" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva o objetivo da formação"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <FormField
                control={form.control}
                name="dataInicio"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Data de Início</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP", { locale: ptBR })
                            ) : (
                                <span>Selecione uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            locale={ptBR}
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={form.control}
                name="dataFim"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Data de Fim</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP", { locale: ptBR })
                            ) : (
                                <span>Selecione uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            locale={ptBR}
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
        </div>


        <FormField
          control={form.control}
          name="materiaisIds"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Materiais de Apoio</FormLabel>
              <ComboboxMateriais
                selected={field.value ?? []}
                onChange={field.onChange}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {logisticaFields.length > 0 && (
             <div className='space-y-4 pt-4'>
                <Separator />
                <div>
                    <h3 className='font-medium text-lg'>Controle Financeiro e Logístico por Formador</h3>
                    <p className='text-sm text-muted-foreground'>Preencha os detalhes para cada formador participante.</p>
                </div>
                <div className='space-y-6'>
                    {logisticaFields.map((field, index) => {
                      const totalCusto = calculateTotalCost(form.watch(`logistica.${index}`));
                      return (
                        <Card key={field.id} className="bg-muted/30">
                            <CardHeader>
                                <CardTitle className="flex justify-between items-center">
                                    <span className="flex items-center gap-2"><User className="h-5 w-5" />{field.formadorNome}</span>
                                    <Badge variant={totalCusto > 0 ? "default" : "outline"} className="text-base">
                                      Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCusto)}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                             <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-md">Dados Pessoais</h4>
                                     <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                        <FormField control={form.control} name={`logistica.${index}.rg`} render={({ field }) => (
                                        <FormItem><FormLabel>RG</FormLabel><FormControl><Input placeholder="00.000.000-0" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name={`logistica.${index}.dataNascimento`} render={({ field }) => (
                                            <FormItem className="flex flex-col"><FormLabel>Data de Nascimento</FormLabel>
                                                <Popover><PopoverTrigger asChild><FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={1950} toYear={new Date().getFullYear()} initialFocus locale={ptBR}/>
                                                </PopoverContent></Popover><FormMessage />
                                            </FormItem>
                                        )}/>
                                        <div className="md:col-span-2">
                                            <p className="text-sm font-medium text-muted-foreground">CPF: <span className="font-mono text-foreground">{field.cpf || 'N/A'}</span></p>
                                            <p className="text-sm font-medium text-muted-foreground">PIX: <span className="font-mono text-foreground">{field.pix || 'N/A'}</span></p>
                                        </div>
                                    </div>
                                </div>
                                <Separator/>
                                <div className="space-y-4">
                                     <h4 className="font-semibold text-md">Transporte</h4>
                                     <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                        <FormField control={form.control} name={`logistica.${index}.valorPassagem`} render={({ field }) => (
                                            <FormItem><FormLabel>Valor da Passagem (R$)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Ex: 550,00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name={`logistica.${index}.trecho`} render={({ field }) => (
                                            <FormItem><FormLabel>Trecho</FormLabel><FormControl><Input placeholder="Ex: Curitiba, PR - Barreiras, BA" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>
                                        )}/>
                                    </div>
                                </div>
                                 <Separator/>
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-md">Hospedagem</h4>
                                    <FormField control={form.control} name={`logistica.${index}.hotel`} render={({ field }) => (
                                        <FormItem><FormLabel>Hotel</FormLabel><FormControl><Input placeholder="Nome do Hotel" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                                        <FormField control={form.control} name={`logistica.${index}.checkin`} render={({ field }) => (
                                            <FormItem className="flex flex-col"><FormLabel>Check-in</FormLabel>
                                                <Popover><PopoverTrigger asChild><FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                                </PopoverContent></Popover><FormMessage />
                                            </FormItem>
                                        )}/>
                                            <FormField control={form.control} name={`logistica.${index}.checkout`} render={({ field }) => (
                                            <FormItem className="flex flex-col"><FormLabel>Check-out</FormLabel>
                                                <Popover><PopoverTrigger asChild><FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                                </PopoverContent></Popover><FormMessage />
                                            </FormItem>
                                        )}/>
                                            <FormField control={form.control} name={`logistica.${index}.valorDiaria`} render={({ field }) => (
                                            <FormItem><FormLabel>Valor da Diária (R$)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Ex: 350,50" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                    </div>
                                </div>
                                <Separator/>
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-md">Remuneração</h4>
                                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                        <FormField control={form.control} name={`logistica.${index}.adiantamento`} render={({ field }) => (
                                            <FormItem><FormLabel>Adiantamento (Ajuda de Custo)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Ex: 1000,00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name={`logistica.${index}.custosExtras`} render={({ field }) => (
                                            <FormItem><FormLabel>Custos Extras</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Ex: 150,00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                    </div>
                                </div>
                             </CardContent>
                        </Card>
                      )
                    })}
                </div>
            </div>
        )}

        <Button type="submit" className="w-full !mt-6" disabled={loading}>
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            isEditMode ? 'Salvar Alterações' : 'Criar Formação'
          )}
        </Button>
      </form>
    </Form>
  );
}

    
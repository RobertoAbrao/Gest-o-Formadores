
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
import { useState, useEffect } from 'react';
import { Loader2, Check, ChevronsUpDown, CalendarIcon, X } from 'lucide-react';
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

const logisticaSchema = z.object({
    formadorId: z.string(),
    formadorNome: z.string(),
    localPartida: z.string().optional(),
    dataIda: z.date().optional().nullable(),
    dataVolta: z.date().optional().nullable(),
    hotel: z.string().optional(),
    checkin: z.date().optional().nullable(),
    checkout: z.date().optional().nullable(),
    valorHospedagem: z.preprocess(
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
  formadoresNomes: z.array(z.string()).min(1, { message: 'Nomes dos formadores são necessários.'}),
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
  const [availableMunicipios, setAvailableMunicipios] = useState<string[]>([]);
  
  const isEditMode = !!formacao;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      formadoresIds: [],
      formadoresNomes: [],
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

  useEffect(() => {
    if (formadores.length > 0) {
      const selected = formadores.filter(f => selectedFormadoresIds.includes(f.id));
      const allMunicipios = selected.flatMap(f => f.municipiosResponsaveis);
      const uniqueMunicipios = [...new Set(allMunicipios)].sort();
      setAvailableMunicipios(uniqueMunicipios);

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
          localPartida: '',
          dataIda: null,
          dataVolta: null,
          hotel: '',
          checkin: null,
          checkout: null,
          valorHospedagem: undefined,
        };
      });
      replaceLogistica(newLogistica);
    }
  }, [selectedFormadoresIds, formadores, form, replaceLogistica]);

  useEffect(() => {
    if (formacao && formadores.length > 0) {
      form.reset({
        titulo: formacao.titulo || '',
        descricao: formacao.descricao || '',
        formadoresIds: formacao.formadoresIds || [],
        formadoresNomes: formacao.formadoresNomes || [],
        municipio: formacao.municipio || '',
        uf: formacao.uf || '',
        participantes: formacao.participantes || 1,
        materiaisIds: formacao.materiaisIds || [],
        dataInicio: toDate(formacao.dataInicio),
        dataFim: toDate(formacao.dataFim),
        logistica: formacao.logistica?.map(l => ({
            ...l,
            dataIda: toNullableDate(l.dataIda),
            dataVolta: toNullableDate(l.dataVolta),
            checkin: toNullableDate(l.checkin),
            checkout: toNullableDate(l.checkout),
            valorHospedagem: l.valorHospedagem || undefined,
        })) || [],
      });
    } else {
        form.reset({
            titulo: '',
            descricao: '',
            formadoresIds: [],
            formadoresNomes: [],
            municipio: '',
            uf: '',
            participantes: 1,
            materiaisIds: [],
            dataInicio: undefined,
            dataFim: undefined,
            logistica: [],
        });
    }
  }, [formacao, form, formadores]);


  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const dataToSave = {
          ...values,
          dataInicio: values.dataInicio ? Timestamp.fromDate(values.dataInicio) : null,
          dataFim: values.dataFim ? Timestamp.fromDate(values.dataFim) : null,
          logistica: values.logistica?.map(l => ({
            ...l,
            dataIda: l.dataIda ? Timestamp.fromDate(l.dataIda) : null,
            dataVolta: l.dataVolta ? Timestamp.fromDate(l.dataVolta) : null,
            checkin: l.checkin ? Timestamp.fromDate(l.checkin) : null,
            checkout: l.checkout ? Timestamp.fromDate(l.checkout) : null,
            valorHospedagem: l.valorHospedagem || null,
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
    const formador = formadores.find(f => f.id === formadorId)!;

    const newIds = currentIds.includes(formadorId)
      ? currentIds.filter(id => id !== formadorId)
      : [...currentIds, formadorId];
      
    const newNomes = formadores
        .filter(f => newIds.includes(f.id))
        .map(f => f.nomeCompleto);

    form.setValue('formadoresIds', newIds, { shouldValidate: true });
    form.setValue('formadoresNomes', newNomes, { shouldValidate: true });

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
                    <h3 className='font-medium text-lg'>Logística de Viagem</h3>
                    <p className='text-sm text-muted-foreground'>Preencha os detalhes de viagem e hospedagem para cada formador.</p>
                </div>
                <div className='space-y-6'>
                    {logisticaFields.map((field, index) => (
                        <div key={field.id} className="p-4 border rounded-lg space-y-4">
                             <h4 className='font-semibold'>{field.formadorNome}</h4>
                             <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <FormField
                                    control={form.control}
                                    name={`logistica.${index}.localPartida`}
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Local de Partida</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Cidade - UF" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`logistica.${index}.hotel`}
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Hotel</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Nome do Hotel" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`logistica.${index}.dataIda`}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                        <FormLabel>Data de Ida</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`logistica.${index}.dataVolta`}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                        <FormLabel>Data de Volta</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name={`logistica.${index}.checkin`}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                        <FormLabel>Check-in</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name={`logistica.${index}.checkout`}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                        <FormLabel>Check-out</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`logistica.${index}.valorHospedagem`}
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Valor Hospedagem (R$)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="Ex: 350,50" {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                             </div>
                        </div>
                    ))}
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

    
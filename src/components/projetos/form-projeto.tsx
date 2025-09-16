
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  query,
  where,
  addDoc,
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
import { Loader2, CalendarIcon, Info, PlusCircle, Trash2, ChevronsUpDown, Check, X } from 'lucide-react';
import type { ProjetoImplatancao, Formador, Formacao } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { generateFormationCode } from '@/lib/utils';

const etapaStatusSchema = z.object({
  data: z.date().nullable().optional(),
  ok: z.boolean().optional(),
  detalhes: z.string().optional(),
});

const periodoStatusSchema = z.object({
  dataInicio: z.date().nullable().optional(),
  dataFim: z.date().nullable().optional(),
  ok: z.boolean().optional(),
  detalhes: z.string().optional(),
});

const devolutivaLinkSchema = z.object({
  formacaoId: z.string().optional(),
  formacaoTitulo: z.string().optional(),
  dataInicio: z.date().nullable().optional(),
  dataFim: z.date().nullable().optional(),
  formador: z.string().optional(),
  ok: z.boolean().optional(),
  detalhes: z.string().optional(),
});

const linkReuniaoSchema = z.object({
    url: z.string().url("Por favor, insira uma URL válida.").optional().or(z.literal('')),
    descricao: z.string().optional(),
});

const reuniaoSchema = z.object({
    data: z.date().nullable().optional(),
    links: z.array(linkReuniaoSchema).optional(),
});


const formSchema = z.object({
  municipio: z.string().min(1, { message: 'O município é obrigatório.' }),
  uf: z.string().min(2, { message: 'O estado é obrigatório.'}),
  versao: z.string().optional(),
  material: z.string().optional(),
  dataMigracao: z.date().nullable(),
  dataImplantacao: z.date().nullable(),
  qtdAlunos: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
    z.number().min(0).optional()
  ),
  formacoesPendentes: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
    z.number().min(0).optional()
  ),
  formadoresIds: z.array(z.string()).optional(),
  diagnostica: etapaStatusSchema,
  simulados: z.object({
    s1: periodoStatusSchema,
    s2: periodoStatusSchema,
    s3: periodoStatusSchema,
    s4: periodoStatusSchema,
  }),
  devolutivas: z.object({
    d1: devolutivaLinkSchema,
    d2: devolutivaLinkSchema,
    d3: devolutivaLinkSchema,
    d4: devolutivaLinkSchema,
  }),
  reunioes: z.array(reuniaoSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FormProjetoProps {
  projeto?: ProjetoImplatancao | null;
  onSuccess: () => void;
}

interface Estado {
    id: number;
    sigla: string;
    nome: string;
}

interface Municipio {
    id: number;
    nome: string;
}

const toDate = (timestamp: Timestamp | null | undefined): Date | null => {
    if (!timestamp) return null;
    return timestamp.toDate();
};

const timestampOrNull = (date: Date | null | undefined): Timestamp | null => {
  return date ? Timestamp.fromDate(date) : null;
};

const cleanObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date || obj instanceof Timestamp) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(cleanObject);
    }
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (value !== undefined) {
          newObj[key] = cleanObject(value);
        }
      }
    }
    return newObj;
};

export function FormProjeto({ projeto, onSuccess }: FormProjetoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [allFormadores, setAllFormadores] = useState<Formador[]>([]);
  const [formadorPopoverOpen, setFormadorPopoverOpen] = useState(false);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  
  const isEditMode = !!projeto;

  useEffect(() => {
    const fetchFormadoresAndEstados = async () => {
        setLoading(true);
        try {
            const [formadoresSnap, estadosResponse] = await Promise.all([
                getDocs(collection(db, 'formadores')),
                fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
            ]);
            
            const formadoresData = formadoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
            setAllFormadores(formadoresData);

            const estadosData = await estadosResponse.json();
            setEstados(estadosData);

        } catch (error) {
            console.error("Failed to fetch initial data", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados necessários.' });
        } finally {
            setLoading(false);
        }
    };
    fetchFormadoresAndEstados();
  }, [toast]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      municipio: projeto?.municipio || '',
      uf: projeto?.uf || '',
      versao: projeto?.versao || '',
      material: projeto?.material || '',
      dataMigracao: toDate(projeto?.dataMigracao),
      dataImplantacao: toDate(projeto?.dataImplantacao),
      qtdAlunos: projeto?.qtdAlunos || undefined,
      formacoesPendentes: projeto?.formacoesPendentes || undefined,
      formadoresIds: projeto?.formadoresIds || [],
      diagnostica: { data: toDate(projeto?.diagnostica?.data), ok: projeto?.diagnostica?.ok || false, detalhes: projeto?.diagnostica?.detalhes || '' },
      simulados: {
        s1: { dataInicio: toDate(projeto?.simulados?.s1?.dataInicio), dataFim: toDate(projeto?.simulados?.s1?.dataFim), ok: projeto?.simulados?.s1?.ok || false, detalhes: projeto?.simulados?.s1?.detalhes || '' },
        s2: { dataInicio: toDate(projeto?.simulados?.s2?.dataInicio), dataFim: toDate(projeto?.simulados?.s2?.dataFim), ok: projeto?.simulados?.s2?.ok || false, detalhes: projeto?.simulados?.s2?.detalhes || '' },
        s3: { dataInicio: toDate(projeto?.simulados?.s3?.dataInicio), dataFim: toDate(projeto?.simulados?.s3?.dataFim), ok: projeto?.simulados?.s3?.ok || false, detalhes: projeto?.simulados?.s3?.detalhes || '' },
        s4: { dataInicio: toDate(projeto?.simulados?.s4?.dataInicio), dataFim: toDate(projeto?.simulados?.s4?.dataFim), ok: projeto?.simulados?.s4?.ok || false, detalhes: projeto?.simulados?.s4?.detalhes || '' },
      },
      devolutivas: {
        d1: { ...projeto?.devolutivas?.d1, dataInicio: toDate(projeto?.devolutivas?.d1?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d1?.dataFim) },
        d2: { ...projeto?.devolutivas?.d2, dataInicio: toDate(projeto?.devolutivas?.d2?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d2?.dataFim) },
        d3: { ...projeto?.devolutivas?.d3, dataInicio: toDate(projeto?.devolutivas?.d3?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d3?.dataFim) },
        d4: { ...projeto?.devolutivas?.d4, dataInicio: toDate(projeto?.devolutivas?.d4?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d4?.dataFim) },
      },
      reunioes: projeto?.reunioes?.map(r => ({
          data: toDate(r.data),
          links: r.links ? [...r.links, ...Array(4 - r.links.length).fill({ url: '', descricao: '' })].slice(0, 4) : Array(4).fill({ url: '', descricao: '' }),
      })) || [],
    },
  });

  const selectedUf = form.watch('uf');

  useEffect(() => {
    if (!selectedUf) {
      setMunicipios([]);
      return;
    }
    const fetchMunicipios = async () => {
        setLoadingMunicipios(true);
        try {
            const response = await fetch(`/api/municipios/${selectedUf}`);
            const data = await response.json();
            if (response.ok) {
                setMunicipios(data);
            } else {
                throw new Error(data.error || 'Erro ao buscar municípios');
            }
        } catch (error) {
            console.error('Failed to fetch municipios', error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os municípios." });
        } finally {
            setLoadingMunicipios(false);
        }
    };
    fetchMunicipios();
  }, [selectedUf, toast]);


  const availableFormadores = useMemo(() => {
      if (!selectedUf) return [];
      return allFormadores.filter(f => f.uf === selectedUf);
  }, [selectedUf, allFormadores]);


  const { fields: reuniaoFields, append: appendReuniao, remove: removeReuniao } = useFieldArray({
    control: form.control,
    name: "reunioes",
  });
  
  const selectedFormadores = allFormadores.filter(f => form.watch('formadoresIds')?.includes(f.id));

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const dataToSave = {
          ...values,
          dataMigracao: timestampOrNull(values.dataMigracao),
          dataImplantacao: timestampOrNull(values.dataImplantacao),
          diagnostica: {
            data: timestampOrNull(values.diagnostica.data),
            ok: values.diagnostica.ok,
            detalhes: values.diagnostica.detalhes,
          },
          simulados: {
            s1: { dataInicio: timestampOrNull(values.simulados.s1.dataInicio), dataFim: timestampOrNull(values.simulados.s1.dataFim), ok: values.simulados.s1.ok, detalhes: values.simulados.s1.detalhes },
            s2: { dataInicio: timestampOrNull(values.simulados.s2.dataInicio), dataFim: timestampOrNull(values.simulados.s2.dataFim), ok: values.simulados.s2.ok, detalhes: values.simulados.s2.detalhes },
            s3: { dataInicio: timestampOrNull(values.simulados.s3.dataInicio), dataFim: timestampOrNull(values.simulados.s3.dataFim), ok: values.simulados.s3.ok, detalhes: values.simulados.s3.detalhes },
            s4: { dataInicio: timestampOrNull(values.simulados.s4.dataInicio), dataFim: timestampOrNull(values.simulados.s4.dataFim), ok: values.simulados.s4.ok, detalhes: values.simulados.s4.detalhes },
          },
           devolutivas: {
            d1: { ...values.devolutivas.d1, dataInicio: timestampOrNull(values.devolutivas.d1.dataInicio), dataFim: timestampOrNull(values.devolutivas.d1.dataFim) },
            d2: { ...values.devolutivas.d2, dataInicio: timestampOrNull(values.devolutivas.d2.dataInicio), dataFim: timestampOrNull(values.devolutivas.d2.dataFim) },
            d3: { ...values.devolutivas.d3, dataInicio: timestampOrNull(values.devolutivas.d3.dataInicio), dataFim: timestampOrNull(values.devolutivas.d3.dataFim) },
            d4: { ...values.devolutivas.d4, dataInicio: timestampOrNull(values.devolutivas.d4.dataInicio), dataFim: timestampOrNull(values.devolutivas.d4.dataFim) },
          },
          reunioes: values.reunioes?.map(reuniao => ({
            data: timestampOrNull(reuniao.data),
            links: reuniao.links?.filter(link => link && link.url) || []
          })),
      };

      const cleanedData = cleanObject(dataToSave);

      if (isEditMode && projeto) {
         await updateDoc(doc(db, 'projetos', projeto.id), cleanedData);
         toast({ title: 'Sucesso!', description: 'Projeto atualizado com sucesso.' });
      } else {
        const newDocRef = doc(collection(db, 'projetos'));
        await setDoc(newDocRef, {
            ...cleanedData,
            id: newDocRef.id,
            dataCriacao: serverTimestamp(),
        });
        toast({ title: 'Sucesso!', description: 'Projeto criado com sucesso.' });
      }
      onSuccess();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao salvar o projeto. Verifique os campos e tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  }
  
  const handleCreateDevolutivaFormation = async (devolutivaNumber: 1 | 2 | 3 | 4) => {
    const { municipio, uf, formadoresIds } = form.getValues();
    if (!municipio || !uf) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um município e UF para o projeto primeiro.' });
      return;
    }
    
    setLoading(true);
    try {
      const title = `Devolutiva ${devolutivaNumber}: ${municipio}`;
      const newFormationData: Omit<Formacao, 'id'> = {
        titulo: title,
        descricao: `Devolutiva referente ao projeto de implantação em ${municipio}.`,
        status: 'preparacao',
        municipio,
        uf,
        codigo: generateFormationCode(municipio),
        formadoresIds: formadoresIds || [],
        materiaisIds: [],
        avaliacoesAbertas: false,
        dataInicio: null,
        dataFim: null,
      };
      
      const docRef = await addDoc(collection(db, "formacoes"), {
          ...newFormationData,
          dataCriacao: serverTimestamp(),
      });
      
      form.setValue(`devolutivas.d${devolutivaNumber}.formacaoId`, docRef.id);
      form.setValue(`devolutivas.d${devolutivaNumber}.formacaoTitulo`, title);
      
      toast({ title: 'Sucesso!', description: `Formação para a Devolutiva ${devolutivaNumber} criada.` });

    } catch (error) {
      console.error("Error creating devolutiva formation:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar a formação para a devolutiva.' });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* DADOS GERAIS */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold text-lg">Dados Gerais</h3>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="uf" render={({ field }) => (
                  <FormItem><FormLabel>UF</FormLabel>
                      <Select onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('municipio', '');
                          form.setValue('formadoresIds', []);
                      }} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o estado" />
                            </SelectTrigger>
                        </FormControl>
                          <SelectContent>{estados.map(uf => (<SelectItem key={uf.id} value={uf.sigla}>{uf.nome}</SelectItem>))}</SelectContent>
                      </Select><FormMessage />
                  </FormItem>
              )}/>
               <FormField control={form.control} name="municipio" render={({ field }) => (
                  <FormItem><FormLabel>Município</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedUf || loadingMunicipios}>
                          <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder={loadingMunicipios ? "Carregando..." : "Selecione o município"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {municipios.map(m => <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)}
                          </SelectContent>
                      </Select><FormMessage />
                  </FormItem>
              )}/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="versao" render={({ field }) => (
              <FormItem><FormLabel>Versão</FormLabel><FormControl><Input placeholder="Ex: 1.0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="material" render={({ field }) => (
                <FormItem>
                    <FormLabel>Material</FormLabel>
                    <FormControl>
                        <Input placeholder="Descreva os materiais do projeto" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}/>
          </div>
        </div>

        {/* IMPLEMENTAÇÃO E MÉTRICAS */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold text-lg">Implementação e Métricas</h3>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="dataMigracao" render={({ field }) => (
              <FormItem className="flex flex-col"><FormLabel>Data de Migração</FormLabel>
                <Popover><PopoverTrigger asChild><FormControl>
                  <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                </PopoverContent></Popover><FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="dataImplantacao" render={({ field }) => (
              <FormItem className="flex flex-col"><FormLabel>Data de Implantação</FormLabel>
                <Popover><PopoverTrigger asChild><FormControl>
                  <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                </PopoverContent></Popover><FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="qtdAlunos" render={({ field }) => (
              <FormItem><FormLabel>Quantidade de Alunos</FormLabel><FormControl><Input type="number" min="0" placeholder="Ex: 500" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="formacoesPendentes" render={({ field }) => (
              <FormItem><FormLabel>Formações Pendentes</FormLabel><FormControl><Input type="number" min="0" placeholder="Ex: 2" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField
                control={form.control}
                name="formadoresIds"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Formadores</FormLabel>
                        <Popover open={formadorPopoverOpen} onOpenChange={setFormadorPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between" disabled={!selectedUf}>
                                    <span className="truncate">
                                        {selectedFormadores.length > 0 ? `${selectedFormadores.length} selecionado(s)`: 'Selecione formadores...'}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar formador..." />
                                    <CommandList>
                                        <CommandEmpty>Nenhum formador encontrado para este UF.</CommandEmpty>
                                        <CommandGroup>
                                            {availableFormadores.map((formador) => (
                                                <CommandItem
                                                    key={formador.id}
                                                    value={formador.nomeCompleto}
                                                    onSelect={() => {
                                                        const currentIds = field.value || [];
                                                        const newIds = currentIds.includes(formador.id)
                                                            ? currentIds.filter(id => id !== formador.id)
                                                            : [...currentIds, formador.id];
                                                        field.onChange(newIds);
                                                    }}
                                                >
                                                    <Check className={cn('mr-2 h-4 w-4', field.value?.includes(formador.id) ? 'opacity-100' : 'opacity-0')} />
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
                                    onClick={() => field.onChange(field.value?.filter(id => id !== formador.id))}
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
          </div>
        </div>
        
        {/* Agendamento de Reunião */}
        <div className="space-y-4 p-4 border rounded-lg">
            <div className='flex justify-between items-center'>
                <h3 className="font-semibold text-lg">Agendamento de Reuniões</h3>
                <Button type="button" size="sm" variant="outline" onClick={() => appendReuniao({ data: null, links: Array(4).fill({ url: '', descricao: '' }) })}>
                    <PlusCircle className='mr-2 h-4 w-4'/> Adicionar Reunião
                </Button>
            </div>
            <Separator />
            {reuniaoFields.map((field, index) => (
                 <div key={field.id} className="space-y-4 p-4 border rounded-lg relative">
                    <div className='flex justify-between items-center'>
                        <h4 className='font-semibold text-base'>Reunião {index + 1}</h4>
                        <Button type="button" size="icon" variant="ghost" className='h-7 w-7 text-destructive' onClick={() => removeReuniao(index)}>
                            <Trash2 className='h-4 w-4'/>
                        </Button>
                    </div>
                    <FormField control={form.control} name={`reunioes.${index}.data`} render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Data da Reunião</FormLabel>
                            <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                            </PopoverContent></Popover><FormMessage />
                        </FormItem>
                    )}/>
                    <div className="space-y-4">
                        {Array.from({ length: 4 }).map((_, linkIndex) => (
                            <div key={linkIndex} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name={`reunioes.${index}.links.${linkIndex}.url`} render={({ field }) => (
                                    <FormItem><FormLabel>Link {linkIndex + 1}</FormLabel><FormControl><Input placeholder="https://exemplo.com" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name={`reunioes.${index}.links.${linkIndex}.descricao`} render={({ field }) => (
                                    <FormItem><FormLabel>Descrição do Link {linkIndex + 1}</FormLabel><FormControl><Input placeholder="Ex: Gravação da reunião" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>


        {/* AVALIAÇÕES E SIMULADOS */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold text-lg">Avaliações e Simulados</h3>
          <Separator />
            {/* Diagnóstica */}
            <div className='flex flex-col gap-4 p-2 rounded-md border'>
              <div className='flex flex-wrap items-end gap-4'>
                <FormField control={form.control} name="diagnostica.data" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Avaliação Diagnóstica</FormLabel>
                    <Popover><PopoverTrigger asChild><FormControl>
                      <Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                    </PopoverContent></Popover><FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="diagnostica.ok" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 h-10"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>OK?</FormLabel></FormItem>
                )}/>
              </div>
              <FormField control={form.control} name="diagnostica.detalhes" render={({ field }) => (
                  <FormItem><FormLabel>Detalhes</FormLabel><FormControl><Textarea placeholder="Detalhes sobre a avaliação diagnóstica..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            {/* Simulados */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {([1, 2, 3, 4] as const).map(i => (
                <div key={`s${i}`} className='p-2 rounded-md border space-y-3'>
                  <h4 className='font-medium'>Simulado {i}</h4>
                  <FormField control={form.control} name={`simulados.s${i}.dataInicio`} render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Data Início</FormLabel>
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
                  <FormField control={form.control} name={`simulados.s${i}.dataFim`} render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Data Fim</FormLabel>
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
                   <FormField control={form.control} name={`simulados.s${i}.ok`} render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 pt-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>OK?</FormLabel></FormItem>
                  )}/>
                  <FormField control={form.control} name={`simulados.s${i}.detalhes`} render={({ field }) => (
                    <FormItem><FormLabel>Detalhes</FormLabel><FormControl><Textarea placeholder="Detalhes sobre o simulado..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>
              ))}
            </div>
        </div>
        
        {/* DEVOLUTIVAS */}
        <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold text-lg">Cronograma de Devolutivas</h3>
            <p className="text-sm text-muted-foreground">
              Você pode agendar as devolutivas aqui ou criar uma formação completa para elas, para um gerenciamento mais detalhado.
            </p>
            <Separator />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {([1, 2, 3, 4] as const).map(i => {
                    const devolutiva = form.watch(`devolutivas.d${i}`);
                    return (
                        <div key={`d${i}`} className='p-3 rounded-md border space-y-3'>
                            <div className="flex justify-between items-start">
                              <h4 className='font-medium'>Devolutiva {i}</h4>
                              <FormField control={form.control} name={`devolutivas.d${i}.ok`} render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>OK?</FormLabel></FormItem>
                              )}/>
                            </div>
                            <FormField control={form.control} name={`devolutivas.d${i}.dataInicio`} render={({ field }) => (
                              <FormItem className="flex flex-col"><FormLabel>Data Início</FormLabel>
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
                             <FormField control={form.control} name={`devolutivas.d${i}.dataFim`} render={({ field }) => (
                              <FormItem className="flex flex-col"><FormLabel>Data Fim</FormLabel>
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
                            <FormField control={form.control} name={`devolutivas.d${i}.formador`} render={({ field }) => (
                              <FormItem><FormLabel>Formador</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value} disabled={availableFormadores.length === 0}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um formador" />
                                        </SelectTrigger>
                                    </FormControl>
                                      <SelectContent>{availableFormadores.map(f => (<SelectItem key={f.id} value={f.nomeCompleto}>{f.nomeCompleto}</SelectItem>))}</SelectContent>
                                  </Select><FormMessage />
                              </FormItem>
                            )}/>
                            <FormField control={form.control} name={`devolutivas.d${i}.detalhes`} render={({ field }) => (
                              <FormItem><FormLabel>Detalhes</FormLabel><FormControl><Textarea placeholder="Detalhes sobre a devolutiva..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <Separator className="!my-4"/>
                            {devolutiva?.formacaoId ? (
                                <div className="space-y-2">
                                  <p className="text-sm text-muted-foreground">
                                      Formação criada: <span className="font-semibold text-foreground">{devolutiva.formacaoTitulo}</span>
                                  </p>
                                  <Button variant="outline" size="sm" asChild>
                                      <a href={`/quadro`} target="_blank">Ver no Quadro</a>
                                  </Button>
                                </div>
                            ) : (
                                <Button 
                                  type="button" 
                                  variant="secondary" 
                                  onClick={() => handleCreateDevolutivaFormation(i)}
                                  disabled={loading}
                                >
                                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                  Criar Formação para Devolutiva
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        <Button type="submit" className="w-full !mt-8" disabled={loading}>
          {loading ? (<Loader2 className="animate-spin" />) : (isEditMode ? 'Salvar Alterações' : 'Criar Projeto')}
        </Button>
      </form>
    </Form>
  );
}

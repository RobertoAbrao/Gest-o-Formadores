
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
import { useState } from 'react';
import { Loader2, CalendarIcon, Info, PlusCircle, Trash2 } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import type { ProjetoImplatancao } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const etapaStatusSchema = z.object({
  data: z.date().nullable().optional(),
  ok: z.boolean().optional(),
});

const devolutivaStatusSchema = z.object({
  dataInicio: z.date().nullable().optional(),
  dataFim: z.date().nullable().optional(),
  formador: z.string().optional(),
  ok: z.boolean().optional(),
});

const devolutiva4Schema = devolutivaStatusSchema.extend({
  data: z.date().nullable().optional(),
}).omit({ dataInicio: true, dataFim: true });

const linkReuniaoSchema = z.object({
    url: z.string().url({ message: "Por favor, insira uma URL válida." }).or(z.literal('')),
    descricao: z.string(),
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
  qtdFormadores: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
    z.number().min(0).optional()
  ),
  formadoresOk: z.boolean().optional(),
  diagnostica: etapaStatusSchema,
  simulados: z.object({
    s1: etapaStatusSchema,
    s2: etapaStatusSchema,
    s3: etapaStatusSchema,
    s4: etapaStatusSchema,
  }),
  devolutivas: z.object({
    d1: devolutivaStatusSchema,
    d2: devolutivaStatusSchema,
    d3: devolutivaStatusSchema,
    d4: devolutiva4Schema,
  }),
  reunioes: z.array(reuniaoSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FormProjetoProps {
  projeto?: ProjetoImplatancao | null;
  onSuccess: () => void;
}

const toDate = (timestamp: Timestamp | null | undefined): Date | null => {
    if (!timestamp) return null;
    return timestamp.toDate();
};

const ufs = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const timestampOrNull = (date: Date | null | undefined): Timestamp | null => {
  return date ? Timestamp.fromDate(date) : null;
};

// Function to remove undefined properties from an object
const removeUndefinedProps = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefinedProps);
    if (typeof obj !== 'object' || obj instanceof Date || obj instanceof Timestamp) return obj;

    const newObj: any = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (value !== undefined) {
                newObj[key] = removeUndefinedProps(value);
            }
        }
    }
    return newObj;
};

export function FormProjeto({ projeto, onSuccess }: FormProjetoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const isEditMode = !!projeto;

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
      qtdFormadores: projeto?.qtdFormadores || undefined,
      formadoresOk: projeto?.formadoresOk || false,
      diagnostica: { data: toDate(projeto?.diagnostica?.data), ok: projeto?.diagnostica?.ok || false },
      simulados: {
        s1: { data: toDate(projeto?.simulados?.s1?.data), ok: projeto?.simulados?.s1?.ok || false },
        s2: { data: toDate(projeto?.simulados?.s2?.data), ok: projeto?.simulados?.s2?.ok || false },
        s3: { data: toDate(projeto?.simulados?.s3?.data), ok: projeto?.simulados?.s3?.ok || false },
        s4: { data: toDate(projeto?.simulados?.s4?.data), ok: projeto?.simulados?.s4?.ok || false },
      },
      devolutivas: {
        d1: { dataInicio: toDate(projeto?.devolutivas?.d1?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d1?.dataFim), formador: projeto?.devolutivas?.d1?.formador || '', ok: projeto?.devolutivas?.d1?.ok || false },
        d2: { dataInicio: toDate(projeto?.devolutivas?.d2?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d2?.dataFim), formador: projeto?.devolutivas?.d2?.formador || '', ok: projeto?.devolutivas?.d2?.ok || false },
        d3: { dataInicio: toDate(projeto?.devolutivas?.d3?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d3?.dataFim), formador: projeto?.devolutivas?.d3?.formador || '', ok: projeto?.devolutivas?.d3?.ok || false },
        d4: { data: toDate(projeto?.devolutivas?.d4?.data), formador: projeto?.devolutivas?.d4?.formador || '', ok: projeto?.devolutivas?.d4?.ok || false },
      },
      reunioes: projeto?.reunioes?.map(r => ({
          data: toDate(r.data),
          links: r.links || Array(4).fill({ url: '', descricao: '' }),
      })) || [],
    },
  });

  const { fields: reuniaoFields, append: appendReuniao, remove: removeReuniao } = useFieldArray({
    control: form.control,
    name: "reunioes",
  });
  

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
          },
          simulados: {
            s1: { data: timestampOrNull(values.simulados.s1.data), ok: values.simulados.s1.ok },
            s2: { data: timestampOrNull(values.simulados.s2.data), ok: values.simulados.s2.ok },
            s3: { data: timestampOrNull(values.simulados.s3.data), ok: values.simulados.s3.ok },
            s4: { data: timestampOrNull(values.simulados.s4.data), ok: values.simulados.s4.ok },
          },
          devolutivas: {
            d1: { dataInicio: timestampOrNull(values.devolutivas.d1.dataInicio), dataFim: timestampOrNull(values.devolutivas.d1.dataFim), formador: values.devolutivas.d1.formador, ok: values.devolutivas.d1.ok },
            d2: { dataInicio: timestampOrNull(values.devolutivas.d2.dataInicio), dataFim: timestampOrNull(values.devolutivas.d2.dataFim), formador: values.devolutivas.d2.formador, ok: values.devolutivas.d2.ok },
            d3: { dataInicio: timestampOrNull(values.devolutivas.d3.dataInicio), dataFim: timestampOrNull(values.devolutivas.d3.dataFim), formador: values.devolutivas.d3.formador, ok: values.devolutivas.d3.ok },
            d4: { data: timestampOrNull(values.devolutivas.d4.data), formador: values.devolutivas.d4.formador, ok: values.devolutivas.d4.ok },
          },
          reunioes: values.reunioes?.map(reuniao => ({
            data: timestampOrNull(reuniao.data),
            links: reuniao.links?.filter(link => link.url) || []
          }))
      };

      const cleanedData = removeUndefinedProps(dataToSave);

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* DADOS GERAIS */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold text-lg">Dados Gerais</h3>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="municipio" render={({ field }) => (
                  <FormItem><FormLabel>Município</FormLabel><FormControl><Input placeholder="Nome do município" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="uf" render={({ field }) => (
                  <FormItem><FormLabel>UF</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger></FormControl>
                          <SelectContent>{ufs.map(uf => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}</SelectContent>
                      </Select><FormMessage />
                  </FormItem>
              )}/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="versao" render={({ field }) => (
              <FormItem><FormLabel>Versão</FormLabel><FormControl><Input placeholder="Ex: 1.0" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="material" render={({ field }) => (
              <FormItem><FormLabel>Material</FormLabel><FormControl><Input placeholder="LP, MAT, CN, CH..." {...field} /></FormControl><FormMessage /></FormItem>
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
            <FormField control={form.control} name="qtdFormadores" render={({ field }) => (
              <FormItem><FormLabel>Quantidade de Formadores</FormLabel><FormControl><Input type="number" min="0" placeholder="Ex: 4" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="formadoresOk" render={({ field }) => (
              <FormItem className="flex flex-row items-end space-x-2 pb-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Formadores OK?</FormLabel></FormItem>
            )}/>
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
                                    <FormItem><FormLabel>Link {linkIndex + 1}</FormLabel><FormControl><Input placeholder="https://exemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name={`reunioes.${index}.links.${linkIndex}.descricao`} render={({ field }) => (
                                    <FormItem><FormLabel>Descrição do Link {linkIndex + 1}</FormLabel><FormControl><Input placeholder="Ex: Gravação da reunião" {...field} /></FormControl><FormMessage /></FormItem>
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
            <div className='flex flex-wrap items-end gap-4 p-2 rounded-md border'>
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
            {/* Simulados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([1, 2, 3, 4] as const).map(i => (
                <div key={`s${i}`} className='flex flex-wrap items-end gap-4 p-2 rounded-md border'>
                  <FormField control={form.control} name={`simulados.s${i}.data`} render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Simulado {i}</FormLabel>
                      <Popover><PopoverTrigger asChild><FormControl>
                        <Button variant={"outline"} className={cn("w-[200px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                      </PopoverContent></Popover><FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name={`simulados.s${i}.ok`} render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 h-10"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>OK?</FormLabel></FormItem>
                  )}/>
                </div>
              ))}
            </div>
        </div>
        
        {/* DEVOLUTIVAS */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold text-lg">Cronograma de Devolutivas</h3>
          <Separator />
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {([1, 2, 3] as const).map(i => (
                <div key={`d${i}`} className='p-2 rounded-md border space-y-3'>
                  <h4 className='font-medium'>Devolutiva {i}</h4>
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
                    <FormItem><FormLabel>Formador</FormLabel><FormControl><Input placeholder="Nome do formador" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                   <FormField control={form.control} name={`devolutivas.d${i}.ok`} render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 pt-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>OK?</FormLabel></FormItem>
                  )}/>
                </div>
              ))}
                <div key="d4" className='p-2 rounded-md border space-y-3'>
                  <h4 className='font-medium'>Devolutiva 4</h4>
                  <FormField control={form.control} name="devolutivas.d4.data" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Data</FormLabel>
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
                  <FormField control={form.control} name="devolutivas.d4.formador" render={({ field }) => (
                    <FormItem><FormLabel>Formador</FormLabel><FormControl><Input placeholder="Nome do formador" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                   <FormField control={form.control} name="devolutivas.d4.ok" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 pt-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>OK?</FormLabel></FormItem>
                  )}/>
                </div>
            </div>
        </div>

        <Button type="submit" className="w-full !mt-8" disabled={loading}>
          {loading ? (<Loader2 className="animate-spin" />) : (isEditMode ? 'Salvar Alterações' : 'Criar Projeto')}
        </Button>
      </form>
    </Form>
  );
}

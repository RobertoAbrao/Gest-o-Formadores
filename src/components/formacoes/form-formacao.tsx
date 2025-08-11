
'use client';

import { useForm } from 'react-hook-form';
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
import type { Formacao, Formador } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ComboboxMateriais } from '../materiais/combobox-materiais';
import { Calendar } from '../ui/calendar';
import { Badge } from '../ui/badge';

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

export function FormFormacao({ formacao, onSuccess }: FormFormacaoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [open, setOpen] = React.useState(false);
  const [availableMunicipios, setAvailableMunicipios] = useState<string[]>([]);
  
  const isEditMode = !!formacao;

  const toDate = (timestamp: Timestamp | null | undefined): Date | undefined => {
    return timestamp ? timestamp.toDate() : undefined;
  };

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
    },
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

      // Set UF based on the first selected formador
      if (selected.length > 0 && selected[0].uf) {
        form.setValue('uf', selected[0].uf);
      } else if (selected.length === 0) {
        form.setValue('uf', '');
      }
    }
  }, [selectedFormadoresIds, formadores, form]);

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
      });
    } else {
        form.reset({
            titulo: '',
            descricao: '',
            formadoresIds: [],
            municipio: '',
            uf: '',
            participantes: 1,
            materiaisIds: [],
            dataInicio: undefined,
            dataFim: undefined,
        });
    }
  }, [formacao, form, formadores]);


  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const dataToSave: Partial<Formacao> & Omit<FormValues, 'dataInicio' | 'dataFim'> & { dataInicio?: Timestamp | null; dataFim?: Timestamp | null } = {
          ...values,
          dataInicio: values.dataInicio ? Timestamp.fromDate(values.dataInicio) : null,
          dataFim: values.dataFim ? Timestamp.fromDate(values.dataFim) : null,
      };

      if (isEditMode && formacao) {
         await updateDoc(doc(db, 'formacoes', formacao.id), dataToSave);
         toast({ title: 'Sucesso!', description: 'Formação atualizada com sucesso.' });
      } else {
        const newDocRef = doc(collection(db, 'formacoes'));
        await setDoc(newDocRef, {
            ...dataToSave,
            id: newDocRef.id,
            codigo: generateFormationCode(values.municipio),
            status: 'preparacao',
            dataCriacao: serverTimestamp(),
        });
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

    // When deselecting the last formador for a specific municipality, reset it
    const formador = formadores.find(f => f.id === formadorId)!;
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

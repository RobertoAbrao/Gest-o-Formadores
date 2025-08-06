
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
} from 'firebase/firestore';
import * as React from 'react';

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
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import type { Formacao, Formador } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ComboboxMateriais } from '../materiais/combobox-materiais';

const formSchema = z.object({
  titulo: z
    .string()
    .min(3, { message: 'O título deve ter pelo menos 3 caracteres.' }),
  descricao: z
    .string()
    .min(10, { message: 'A descrição deve ter pelo menos 10 caracteres.' }),
  formadoresIds: z.array(z.string()).min(1, { message: 'Selecione ao menos um formador.'}),
  municipio: z.string().min(1, { message: 'Selecione um município.' }),
  materiaisIds: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FormFormacaoProps {
  formacao?: Formacao | null;
  onSuccess: () => void;
}

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
      municipio: '',
      materiaisIds: [],
    },
  });

  useEffect(() => {
    const fetchFormadores = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'formadores'));
            const formadoresData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
            setFormadores(formadoresData);

            if (formacao && formacao.formadoresIds.length > 0) {
              const mainFormadorId = formacao.formadoresIds[0];
              const formador = formadoresData.find(f => f.id === mainFormadorId);
              if (formador) {
                setAvailableMunicipios(formador.municipiosResponsaveis || []);
              }
            }
        } catch (error) {
            console.error("Failed to fetch formadores", error);
        }
    };
    fetchFormadores();
  }, [formacao]);


  useEffect(() => {
    if (formacao) {
      form.reset({
        titulo: formacao.titulo || '',
        descricao: formacao.descricao || '',
        formadoresIds: formacao.formadoresIds || [],
        municipio: formacao.municipio || '',
        materiaisIds: formacao.materiaisIds || [],
      });
    } else {
        form.reset({
            titulo: '',
            descricao: '',
            formadoresIds: [],
            municipio: '',
            materiaisIds: [],
        });
    }
  }, [formacao, form]);


  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      if (isEditMode && formacao) {
         await updateDoc(doc(db, 'formacoes', formacao.id), {
            ...values,
         });
         toast({ title: 'Sucesso!', description: 'Formação atualizada com sucesso.' });
      } else {
        const newDocRef = doc(collection(db, 'formacoes'));
        await setDoc(newDocRef, {
            ...values,
            status: 'preparacao',
            dataInicio: null,
            dataFim: null,
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

  const handleSelect = (formadorId: string) => {
    const currentIds = form.getValues('formadoresIds');
    const newIds = [formadorId];
    form.setValue('formadoresIds', newIds, { shouldValidate: true });
    
    const formador = formadores.find(f => f.id === formadorId);
    if (formador) {
        if (!isEditMode) {
          form.setValue('titulo', `Formação para ${formador.nomeCompleto}`, { shouldValidate: true });
          form.setValue('descricao', '', { shouldValidate: true });
        }
        form.setValue('municipio', '', { shouldValidate: true });
        setAvailableMunicipios(formador.municipiosResponsaveis || []);
    } else {
         setAvailableMunicipios([]);
    }
    setOpen(false);
  }

  const handleMunicipioChange = (municipio: string) => {
    form.setValue('municipio', municipio, { shouldValidate: true });
    if (!isEditMode) {
        const desc = `Acompanhamento pedagógico para o município de ${municipio}`;
        form.setValue('descricao', desc, { shouldValidate: true });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <FormField
          control={form.control}
          name="formadoresIds"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Formador</FormLabel>
                <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        {selectedFormadores.length > 0 ? selectedFormadores[0].nomeCompleto : "Selecione um formador..."}
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
                                        onSelect={() => handleSelect(formador.id)}
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
              <FormMessage />
            </FormItem>
          )}
        />
        
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
                            <SelectValue placeholder="Selecione o município da formação" />
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

        <div className="pt-4">
          <p className="text-sm text-muted-foreground">
            Em breve: agendamento de datas.
          </p>
        </div>

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

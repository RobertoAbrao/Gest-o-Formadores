
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
import type { Formador } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

const formSchema = z.object({
  titulo: z
    .string()
    .min(3, { message: 'O título deve ter pelo menos 3 caracteres.' }),
  descricao: z
    .string()
    .min(10, { message: 'A descrição deve ter pelo menos 10 caracteres.' }),
  formadoresIds: z.array(z.string()).min(1, { message: 'Selecione ao menos um formador.'}),
});

type FormValues = z.infer<typeof formSchema>;

interface FormFormacaoProps {
  onSuccess: () => void;
}

export function FormFormacao({ onSuccess }: FormFormacaoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [open, setOpen] = React.useState(false);


  useEffect(() => {
    const fetchFormadores = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'formadores'));
            const formadoresData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
            setFormadores(formadoresData);
        } catch (error) {
            console.error("Failed to fetch formadores", error);
        }
    };
    fetchFormadores();
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      formadoresIds: [],
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const newDocRef = doc(collection(db, 'formacoes'));
      await setDoc(newDocRef, {
        ...values,
        status: 'preparacao',
        dataInicio: null,
        dataFim: null,
        materiaisIds: [],
        dataCriacao: serverTimestamp(),
      });
      toast({
        title: 'Sucesso!',
        description: 'Formação criada com sucesso.',
      });
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
    const isSelected = currentIds.includes(formadorId);
    
    let newIds: string[];
    if (isSelected) {
        newIds = currentIds.filter(id => id !== formadorId);
    } else {
        newIds = [...currentIds, formadorId];
    }
    form.setValue('formadoresIds', newIds);

    // Auto-fill logic
    if (newIds.length > 0) {
        const lastSelectedId = newIds[newIds.length - 1];
        const formador = formadores.find(f => f.id === lastSelectedId);
        if (formador) {
            form.setValue('titulo', `Formação para ${formador.nomeCompleto}`, { shouldValidate: true });
            const desc = formador.municipiosResponsaveis.length > 0 
                ? `Acompanhamento pedagógico para o município de ${formador.municipiosResponsaveis[0]}`
                : 'Formador sem município responsável definido.';
            form.setValue('descricao', desc, { shouldValidate: true });
        }
    } else {
        // Clear fields if no formador is selected
        form.setValue('titulo', '', { shouldValidate: true });
        form.setValue('descricao', '', { shouldValidate: true });
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
              <FormLabel>Formadores</FormLabel>
                <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        {selectedFormadores.length > 0 ? `${selectedFormadores.length} selecionado(s)` : "Selecione formadores..."}
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
             <div className='pt-2 flex flex-wrap gap-2'>
                {selectedFormadores.map(f => <Badge key={f.id} variant="secondary">{f.nomeCompleto}</Badge>)}
             </div>
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

        <div className="pt-4">
          <p className="text-sm text-muted-foreground">
            Em breve: seleção de materiais e agendamento de datas.
          </p>
        </div>

        <Button type="submit" className="w-full !mt-6" disabled={loading}>
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            'Criar Formação'
          )}
        </Button>
      </form>
    </Form>
  );
}

    
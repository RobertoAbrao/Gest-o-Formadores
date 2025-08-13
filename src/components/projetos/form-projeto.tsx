
'use client';

import { useForm } from 'react-hook-form';
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
import { Loader2, CalendarIcon } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import type { ProjetoImplatancao } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';

const formSchema = z.object({
  municipio: z.string().min(1, { message: 'O município é obrigatório.' }),
  uf: z.string().min(2, { message: 'O estado é obrigatório.'}),
  detalhesMaterial: z.string().optional(),
  formadoresNomes: z.string().optional(),
  dataMigracao: z.date().nullable(),
  dataImplantacao: z.date().nullable(),
  qtdAlunos: z.preprocess(
    (val) => val ? Number(val) : undefined,
    z.number().min(0).optional()
  ),
  formacoesPendentes: z.preprocess(
    (val) => val ? Number(val) : undefined,
    z.number().min(0).optional()
  ),
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

export function FormProjeto({ projeto, onSuccess }: FormProjetoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const isEditMode = !!projeto;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      municipio: projeto?.municipio || '',
      uf: projeto?.uf || '',
      detalhesMaterial: projeto?.detalhesMaterial || '',
      formadoresNomes: projeto?.formadoresNomes || '',
      dataMigracao: toDate(projeto?.dataMigracao),
      dataImplantacao: toDate(projeto?.dataImplantacao),
      qtdAlunos: projeto?.qtdAlunos || undefined,
      formacoesPendentes: projeto?.formacoesPendentes || undefined,
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const dataToSave = {
          ...values,
          dataMigracao: values.dataMigracao ? Timestamp.fromDate(values.dataMigracao) : null,
          dataImplantacao: values.dataImplantacao ? Timestamp.fromDate(values.dataImplantacao) : null,
      };

      if (isEditMode && projeto) {
         await updateDoc(doc(db, 'projetos', projeto.id), dataToSave as any);
         toast({ title: 'Sucesso!', description: 'Projeto atualizado com sucesso.' });
      } else {
        const newDocRef = doc(collection(db, 'projetos'));
        await setDoc(newDocRef, {
            ...dataToSave,
            id: newDocRef.id,
            dataCriacao: serverTimestamp(),
        } as any);
        toast({ title: 'Sucesso!', description: 'Projeto criado com sucesso.' });
      }
      onSuccess();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao salvar o projeto.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="municipio"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Município</FormLabel>
                <FormControl>
                    <Input placeholder="Nome do município" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="uf"
            render={({ field }) => (
                <FormItem>
                <FormLabel>UF</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o estado" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {ufs.map(uf => (
                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <FormField
          control={form.control}
          name="detalhesMaterial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Detalhes do Material</FormLabel>
              <FormControl>
                <Textarea placeholder="Anos, componentes (LP, MAT), etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="formadoresNomes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Formadores Responsáveis</FormLabel>
              <FormControl>
                <Textarea placeholder="Nomes dos formadores" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="dataImplantacao"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Data de Implantação</FormLabel>
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
                            selected={field.value ?? undefined}
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
                name="dataMigracao"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Data de Migração</FormLabel>
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
                            selected={field.value ?? undefined}
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <FormField
                control={form.control}
                name="qtdAlunos"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Quantidade de Alunos</FormLabel>
                    <FormControl>
                        <Input type="number" min="0" placeholder="Ex: 500" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="formacoesPendentes"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Formações Pendentes</FormLabel>
                    <FormControl>
                        <Input type="number" min="0" placeholder="Ex: 2" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <Button type="submit" className="w-full !mt-6" disabled={loading}>
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            isEditMode ? 'Salvar Alterações' : 'Criar Projeto'
          )}
        </Button>
      </form>
    </Form>
  );
}


'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { db } from '@/lib/firebase';

const formSchema = z.object({
  titulo: z.string().min(3, { message: 'O título deve ter pelo menos 3 caracteres.' }),
  descricao: z.string().min(10, { message: 'A descrição deve ter pelo menos 10 caracteres.' }),
});

type FormValues = z.infer<typeof formSchema>;

interface FormFormacaoProps {
    onSuccess: () => void;
}

export function FormFormacao({ onSuccess }: FormFormacaoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
    },
  });


  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
        await addDoc(collection(db, "formacoes"), {
            ...values,
            status: 'preparacao', // Default status
            // The other fields will be added later
            dataInicio: null,
            dataFim: null,
            formadoresIds: [],
            materiaisIds: [],
        });
        toast({
            title: 'Sucesso!',
            description: 'A nova formação foi criada na coluna "Preparação".',
        });
        onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar formação',
        description: 'Ocorreu um erro desconhecido.',
      });
    } finally {
        setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título da Formação</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Formação em Novas Tecnologias" {...field} />
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
                <Textarea placeholder="Descreva os objetivos e o público-alvo da formação." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <p className="text-sm text-muted-foreground pt-4">
            Em breve: seleção de formadores, materiais e agendamento de datas.
        </p>

        <Button type="submit" className="w-full !mt-6" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : 'Criar Formação'}
        </Button>
      </form>
    </Form>
  );
}


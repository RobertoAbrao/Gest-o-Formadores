
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Demanda, StatusDemanda } from '@/lib/types';
import { useState } from 'react';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';

const ufs = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const statusOptions: StatusDemanda[] = ['Pendente', 'Em andamento', 'Concluída', 'Aguardando retorno'];

const formSchema = z.object({
  municipio: z.string().min(2, { message: 'O município é obrigatório.' }),
  uf: z.string().min(2, { message: 'O estado (UF) é obrigatório.' }),
  demanda: z.string().min(10, { message: 'Descreva a demanda com pelo menos 10 caracteres.' }),
  status: z.enum(statusOptions, { required_error: 'Selecione um status.' }),
  prazo: z.date().optional().nullable(),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FormDemandaProps {
  demanda?: Demanda | null;
  onSuccess: () => void;
}

const toDate = (timestamp: Timestamp | null | undefined): Date | undefined => {
  return timestamp ? timestamp.toDate() : undefined;
};

export function FormDemanda({ demanda, onSuccess }: FormDemandaProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!demanda;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      municipio: demanda?.municipio || '',
      uf: demanda?.uf || '',
      demanda: demanda?.demanda || '',
      status: demanda?.status || 'Pendente',
      prazo: toDate(demanda?.prazo),
      observacoes: demanda?.observacoes || '',
    },
  });

  async function onSubmit(values: FormValues) {
    if (!user) {
      toast({ variant: 'destructive', title: 'Erro de autenticação' });
      return;
    }
    setLoading(true);

    try {
      const dataToSave = {
        ...values,
        municipio: values.municipio.trim(),
        uf: values.uf,
        demanda: values.demanda.trim(),
        observacoes: values.observacoes?.trim(),
        prazo: values.prazo ? Timestamp.fromDate(values.prazo) : null,
        dataAtualizacao: serverTimestamp(),
      };

      if (isEditMode && demanda) {
        await updateDoc(doc(db, 'demandas', demanda.id), dataToSave);
        toast({ title: 'Sucesso!', description: 'Demanda atualizada com sucesso.' });
      } else {
        const newDocRef = doc(collection(db, 'demandas'));
        await setDoc(newDocRef, {
          ...dataToSave,
          id: newDocRef.id,
          responsavelId: user.uid,
          responsavelNome: user.nome || 'N/A',
          dataCriacao: serverTimestamp(),
        });
        toast({ title: 'Sucesso!', description: 'Nova demanda registrada.' });
      }
      onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar demanda',
        description: 'Ocorreu um erro. Tente novamente.',
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
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ufs.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="demanda"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Demanda Recebida</FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva claramente o que foi solicitado..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="prazo"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Prazo (Opcional)</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>Selecione uma data</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações Importantes</FormLabel>
              <FormControl>
                <Textarea placeholder="Dificuldades, atrasos, decisões tomadas, etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full !mt-6" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Salvar Alterações' : 'Registrar Demanda')}
        </Button>
      </form>
    </Form>
  );
}

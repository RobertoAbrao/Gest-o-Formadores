
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CurrencyInput from 'react-currency-input-field';

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
import type { Despesa, TipoDespesa } from '@/lib/types';
import { useState } from 'react';
import { Loader2, CalendarIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';

const despesaTypes: TipoDespesa[] = ['Alimentação', 'Transporte', 'Hospedagem', 'Material Didático', 'Outros'];

const formSchema = z.object({
  data: z.date({ required_error: 'A data é obrigatória.' }),
  tipo: z.enum(despesaTypes, { required_error: 'Selecione um tipo de despesa.' }),
  descricao: z.string().min(3, { message: 'A descrição deve ter pelo menos 3 caracteres.' }),
  valor: z
    .any()
    .refine((val) => val !== undefined && val !== null && val !== '', { message: 'O valor é obrigatório.' })
    .transform((val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const cleanedVal = val.replace(/\./g, '').replace(',', '.');
            const num = parseFloat(cleanedVal);
            return isNaN(num) ? undefined : num;
        }
        return undefined;
    })
    .refine((val) => val !== undefined && val > 0, { message: 'O valor deve ser maior que zero.' }),
  comprovanteUrl: z.string().url({ message: 'Por favor, insira uma URL válida para o comprovante.' }).optional().or(z.literal('')),
});


type FormValues = z.infer<typeof formSchema>;

interface FormDespesaProps {
    despesa?: Despesa | null;
    onSuccess: () => void;
}

export function FormDespesa({ despesa, onSuccess }: FormDespesaProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const isEditMode = !!despesa;

  const toDate = (timestamp: Timestamp | null | undefined): Date | undefined => {
    return timestamp ? timestamp.toDate() : undefined;
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      data: toDate(despesa?.data) || new Date(),
      tipo: despesa?.tipo,
      descricao: despesa?.descricao || '',
      valor: despesa?.valor || undefined,
      comprovanteUrl: despesa?.comprovanteUrl || '',
    },
  });

  async function onSubmit(values: FormValues) {
    if (!user) {
        toast({ variant: 'destructive', title: 'Erro de autenticação', description: 'Usuário não encontrado.' });
        return;
    }
    setLoading(true);
    
    try {
        const dataToSave = {
            ...values,
            formadorId: user.uid,
            data: Timestamp.fromDate(values.data),
            valor: values.valor, 
        };

        if(isEditMode && despesa) {
            await updateDoc(doc(db, 'despesas', despesa.id), dataToSave);
            toast({ title: 'Sucesso!', description: 'Despesa atualizada com sucesso.' });
        } else {
            const newDocRef = doc(collection(db, 'despesas'));
            await setDoc(newDocRef, dataToSave);
            toast({ title: 'Sucesso!', description: 'Despesa criada com sucesso.' });
        }
        onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar despesa',
        description: 'Ocorreu um erro ao salvar. Tente novamente.',
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
            name="data"
            render={({ field }) => (
                <FormItem className="flex flex-col">
                <FormLabel>Data da Despesa</FormLabel>
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
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Despesa</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {despesaTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="valor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (R$)</FormLabel>
              <FormControl>
                 <CurrencyInput
                    id="valor"
                    name={field.name}
                    placeholder="R$ 0,00"
                    defaultValue={field.value}
                    decimalsLimit={2}
                    onValueChange={(value) => field.onChange(value)}
                    prefix="R$ "
                    groupSeparator="."
                    decimalSeparator=","
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                />
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
                <Textarea placeholder="Descreva brevemente a despesa..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={form.control}
            name="comprovanteUrl"
            render={({ field }) => (
                <FormItem>
                <FormLabel>URL do Comprovante</FormLabel>
                <FormControl>
                    <Input placeholder="https://exemplo.com/seu-comprovante.jpg" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

        <Button type="submit" className="w-full !mt-6" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Salvar Alterações' : 'Adicionar Despesa')}
        </Button>
      </form>
    </Form>
  );
}

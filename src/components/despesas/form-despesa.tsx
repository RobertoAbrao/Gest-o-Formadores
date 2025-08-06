
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
  FormDescription,
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
import { useState, useRef } from 'react';
import { Loader2, CalendarIcon, UploadCloud, File as FileIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';

const despesaTypes: TipoDespesa[] = ['Alimentação', 'Transporte', 'Hospedagem', 'Material Didático', 'Outros'];

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB, to be safe with Firestore document limits
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
  data: z.date({ required_error: 'A data é obrigatória.' }),
  tipo: z.enum(despesaTypes, { required_error: 'Selecione um tipo de despesa.' }),
  descricao: z.string().min(3, { message: 'A descrição deve ter pelo menos 3 caracteres.' }),
  valor: z.preprocess(
    (a) => parseFloat(String(a).replace(",", ".")),
    z.number({invalid_type_error: "O valor é obrigatório."})
    .positive({ message: 'O valor deve ser maior que zero.' })
  ),
  comprovante: z
    .custom<FileList>()
    .refine((files) => files === undefined || files.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `O tamanho máximo do arquivo é 1MB.`)
    .refine((files) => files === undefined || files.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type), "Apenas arquivos .jpg, .jpeg, .png e .webp são aceitos.")
    .optional(),
  comprovanteUrl: z.string().optional(),
});


type FormValues = z.infer<typeof formSchema>;

interface FormDespesaProps {
    despesa?: Despesa | null;
    onSuccess: () => void;
}

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
};

export function FormDespesa({ despesa, onSuccess }: FormDespesaProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const isEditMode = !!despesa;
  
  const comprovanteRef = useRef<HTMLInputElement>(null);

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
      comprovante: undefined,
      comprovanteUrl: despesa?.comprovanteUrl || '',
    },
  });
  
  const selectedFile = form.watch('comprovante');

  async function onSubmit(values: FormValues) {
    if (!user) {
        toast({ variant: 'destructive', title: 'Erro de autenticação', description: 'Usuário não encontrado.' });
        return;
    }
    setLoading(true);
    
    try {
        let fileUrl = values.comprovanteUrl;
        const file = values.comprovante?.[0];

        if (file) {
            fileUrl = await fileToDataURL(file);
        }

        const dataToSave = {
            formadorId: user.uid,
            data: Timestamp.fromDate(values.data),
            tipo: values.tipo,
            descricao: values.descricao,
            valor: values.valor, 
            comprovanteUrl: fileUrl || '',
        };

        if(isEditMode && despesa) {
            await updateDoc(doc(db, 'despesas', despesa.id), dataToSave);
            toast({ title: 'Sucesso!', description: 'Despesa atualizada com sucesso.' });
        } else {
            const newDocRef = doc(collection(db, 'despesas'));
            await setDoc(newDocRef, { ...dataToSave, dataCriacao: serverTimestamp() });
            toast({ title: 'Sucesso!', description: 'Despesa criada com sucesso.' });
        }
        onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar despesa',
        description: error.message.includes('permission-denied') 
            ? 'Você não tem permissão para salvar esta despesa.'
            : 'Ocorreu um erro ao salvar. Verifique os dados e tente novamente.',
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
                            format(field.value, 'dd/MM/yyyy', { locale: ptBR })
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
                <Input type="number" step="0.01" placeholder="Ex: 50,99" {...field} value={field.value ?? ''} />
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
            name="comprovante"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Comprovante</FormLabel>
                 <FormControl>
                   <Input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        ref={comprovanteRef}
                        onChange={(e) => field.onChange(e.target.files)}
                    />
                </FormControl>
                <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => comprovanteRef.current?.click()}
                >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    {selectedFile && selectedFile.length > 0 ? 'Alterar arquivo' : 'Selecionar arquivo'}
                </Button>
                 {selectedFile && selectedFile.length > 0 && (
                    <div className='text-sm text-muted-foreground flex items-center gap-2 pt-2'>
                        <FileIcon className='h-4 w-4' />
                        <span>{selectedFile[0].name}</span>
                    </div>
                )}
                {isEditMode && despesa?.comprovanteUrl && !selectedFile?.length && (
                    <div className='text-sm text-muted-foreground pt-2'>
                       <a href={despesa.comprovanteUrl} target='_blank' rel='noopener noreferrer' className='underline flex items-center gap-2'>
                         <FileIcon className='h-4 w-4' />
                         <span>Ver comprovante atual</span>
                       </a>
                    </div>
                )}
                <FormDescription>Envie a foto do seu comprovante. (Máx 1MB)</FormDescription>
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

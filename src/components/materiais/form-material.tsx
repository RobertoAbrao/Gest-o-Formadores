'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
import type { Material, MaterialType } from '@/lib/types';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const materialTypes: MaterialType[] = ['PDF', 'Vídeo', 'Link Externo', 'Documento Word'];

const formSchema = z.object({
  titulo: z.string().min(3, { message: 'O título deve ter pelo menos 3 caracteres.' }),
  descricao: z.string().min(10, { message: 'A descrição deve ter pelo menos 10 caracteres.' }),
  tipoMaterial: z.enum(materialTypes, { required_error: 'Selecione um tipo de material.' }),
  url: z.string().url({ message: 'Por favor, insira uma URL válida.' }),
});


type FormValues = z.infer<typeof formSchema>;

interface FormMaterialProps {
    material?: Material | null;
    onSuccess: () => void;
}

export function FormMaterial({ material, onSuccess }: FormMaterialProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isEditMode = !!material;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: material?.titulo || '',
      descricao: material?.descricao || '',
      tipoMaterial: material?.tipoMaterial,
      url: material?.url || '',
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    
    try {
        const dataToSave: Omit<Material, 'id' | 'dataUpload'> = {
            titulo: values.titulo,
            descricao: values.descricao,
            tipoMaterial: values.tipoMaterial,
            url: values.url,
        };

        if(isEditMode && material) {
            await updateDoc(doc(db, 'materiais', material.id), dataToSave);
            toast({ title: 'Sucesso!', description: 'Material atualizado com sucesso.' });
        } else {
            const newDocRef = doc(collection(db, 'materiais'));
            await setDoc(newDocRef, { ...dataToSave, dataUpload: serverTimestamp() });
            toast({ title: 'Sucesso!', description: 'Material criado com sucesso.' });
        }
        onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar material',
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
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Título do material" {...field} />
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
                <Textarea placeholder="Descreva brevemente o conteúdo do material..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tipoMaterial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Material</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {materialTypes.map(type => (
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
            name="url"
            render={({ field }) => (
                <FormItem>
                <FormLabel>URL do Material</FormLabel>
                <FormControl>
                    <Input placeholder="https://exemplo.com/seu-arquivo" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

        <Button type="submit" className="w-full !mt-6" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Salvar Alterações' : 'Criar Material')}
        </Button>
      </form>
    </Form>
  );
}

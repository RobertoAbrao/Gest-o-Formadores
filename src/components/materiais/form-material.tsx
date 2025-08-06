'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

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
import { db, storage } from '@/lib/firebase';
import type { Material, MaterialType } from '@/lib/types';
import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Progress } from '../ui/progress';

const materialTypes: MaterialType[] = ['PDF', 'Vídeo', 'Link Externo', 'Documento Word'];

const formSchema = z.object({
  titulo: z.string().min(3, { message: 'O título deve ter pelo menos 3 caracteres.' }),
  descricao: z.string().min(10, { message: 'A descrição deve ter pelo menos 10 caracteres.' }),
  tipoMaterial: z.enum(materialTypes, { required_error: 'Selecione um tipo de material.' }),
  url: z.string().min(1, { message: 'A URL é obrigatória.' }),
  arquivo: z.instanceof(File).optional(),
}).superRefine((data, ctx) => {
    if ((data.tipoMaterial === 'PDF' || data.tipoMaterial === 'Documento Word') && !data.arquivo && data.url === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['arquivo'],
          message: 'Um arquivo é obrigatório para este tipo de material.',
        });
    }
    if ((data.tipoMaterial === 'Vídeo' || data.tipoMaterial === 'Link Externo') && data.url === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['url'],
          message: 'A URL é obrigatória para este tipo de material.',
        });
    }
});


type FormValues = z.infer<typeof formSchema>;

interface FormMaterialProps {
    material?: Material | null;
    onSuccess: () => void;
}

export function FormMaterial({ material, onSuccess }: FormMaterialProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const isEditMode = !!material;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: material?.titulo || '',
      descricao: material?.descricao || '',
      tipoMaterial: material?.tipoMaterial,
      url: material?.url || '',
      arquivo: undefined,
    },
  });

  const tipoMaterial = form.watch('tipoMaterial');

  const handleFileUpload = (file: File): Promise<{ downloadURL: string, filePath: string }> => {
    return new Promise((resolve, reject) => {
        const filePath = `materiais/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                setUploadProgress(null);
                reject(error);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    setUploadProgress(null);
                    resolve({ downloadURL, filePath });
                });
            }
        );
    });
  }


  async function onSubmit(values: FormValues) {
    setLoading(true);
    let finalUrl = values.url || '';
    let filePath: string | undefined = undefined;
    
    try {
        if (values.arquivo && (values.tipoMaterial === 'PDF' || values.tipoMaterial === 'Documento Word')) {
            const uploadResult = await handleFileUpload(values.arquivo);
            finalUrl = uploadResult.downloadURL;
            filePath = uploadResult.filePath;
        }

        const dataToSave: Omit<Material, 'id' | 'dataUpload'> = {
            titulo: values.titulo,
            descricao: values.descricao,
            tipoMaterial: values.tipoMaterial,
            url: finalUrl,
            pathArquivo: filePath || material?.pathArquivo, // Mantém o path antigo se não houver novo upload
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

  const renderFieldForType = () => {
    switch(tipoMaterial) {
        case 'PDF':
        case 'Documento Word':
            return (
                <FormField
                control={form.control}
                name="arquivo"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Arquivo</FormLabel>
                        <FormControl>
                            <div className='relative'>
                                <label htmlFor='file-upload' className='flex items-center justify-center w-full h-10 px-3 py-2 text-sm border rounded-md cursor-pointer border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground'>
                                    <Upload className='w-4 h-4 mr-2' />
                                    <span>{field.value?.name || 'Selecione o arquivo'}</span>
                                </label>
                                <Input 
                                    id='file-upload'
                                    type="file" 
                                    className='hidden'
                                    accept={tipoMaterial === 'PDF' ? '.pdf' : '.doc,.docx'}
                                    onChange={(e) => field.onChange(e.target.files?.[0])}
                                />
                            </div>
                        </FormControl>
                        {isEditMode && material?.url && !field.value && (
                            <FormDescription>
                                Um arquivo já existe. Para substituí-lo, selecione um novo.
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
                />
            );
        case 'Vídeo':
        case 'Link Externo':
             return (
                <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{tipoMaterial === 'Vídeo' ? 'URL do Vídeo (YouTube, Vimeo, etc.)' : 'URL do Link'}</FormLabel>
                        <FormControl>
                            <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
             )
        default:
            return null;
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
              <Select onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue('url', ''); // Reseta a URL ao trocar o tipo
                  form.setValue('arquivo', undefined);
              }} defaultValue={field.value}>
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

        {renderFieldForType()}

        {uploadProgress !== null && (
            <Progress value={uploadProgress} className="w-full" />
        )}


        <Button type="submit" className="w-full !mt-6" disabled={loading || uploadProgress !== null}>
          {loading ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Salvar Alterações' : 'Criar Material')}
        </Button>
      </form>
    </Form>
  );
}


'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

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
import { auth, db } from '@/lib/firebase';
import type { Formador } from '@/lib/types';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ComboboxMunicipios } from './combobox-municipios';
import { Separator } from '../ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  nomeCompleto: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' }),
  email: z.string().email({ message: 'Por favor, insira um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }).optional().or(z.literal('')),
  cpf: z.string().refine(value => value.replace(/\D/g, '').length === 11, { message: 'O CPF deve ter 11 dígitos.' }),
  telefone: z.string().min(10, { message: 'O telefone deve ter pelo menos 10 dígitos.' }),
  curriculo: z.string().optional(),
  municipiosResponsaveis: z.array(z.string()).min(1, { message: 'Selecione ao menos um município.'}),
  uf: z.string().min(2, { message: 'O estado é obrigatório.'}),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  pix: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FormFormadorProps {
    formador?: Formador | null;
    onSuccess: () => void;
}

const formatCPF = (cpf: string) => {
    cpf = cpf.replace(/\D/g, '');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return cpf;
}

const formatTelefone = (telefone: string) => {
    telefone = telefone.replace(/\D/g, '');
    telefone = telefone.replace(/^(\d{2})(\d)/g, '($1) $2');
    telefone = telefone.replace(/(\d)(\d{4})$/, '$1-$2');
    return telefone;
}


async function updateFormador(id: string, data: Omit<FormValues, 'password' | 'email'>) {
    const updateData = {
        ...data,
        cpf: data.cpf.replace(/\D/g, ''), // Save only digits
        telefone: data.telefone.replace(/\D/g, ''), // Save only digits
    };

    // Update 'formadores' collection
    await updateDoc(doc(db, 'formadores', id), {
        ...updateData,
    });
    
    // Update 'usuarios' collection
    await updateDoc(doc(db, 'usuarios', id), {
      nome: data.nomeCompleto,
    });
}


export function FormFormador({ formador, onSuccess }: FormFormadorProps) {
  const { toast } = useToast();
  const { user: adminUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const isEditMode = !!formador;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nomeCompleto: formador?.nomeCompleto || '',
      email: formador?.email || '',
      password: '',
      cpf: formador?.cpf ? formatCPF(formador.cpf) : '',
      telefone: formador?.telefone ? formatTelefone(formador.telefone) : '',
      curriculo: formador?.curriculo || '',
      municipiosResponsaveis: formador?.municipiosResponsaveis || [],
      uf: formador?.uf || '',
      banco: formador?.banco || '',
      agencia: formador?.agencia || '',
      conta: formador?.conta || '',
      pix: formador?.pix || '',
    },
  });

  const createFormador = async (data: FormValues) => {
    if (!data.password) throw new Error("Senha é obrigatória para criar um novo formador.");
    if (!adminUser?.email || !adminUser?.adminPassword) {
        throw new Error("Credenciais do administrador não estão disponíveis. Faça login novamente.");
    }

    // 1. Create user in Firebase Auth. This will log in the new user.
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const newUser = userCredential.user;

    try {
        // 2. IMPORTANT: Sign the admin back in immediately.
        await signInWithEmailAndPassword(auth, adminUser.email, adminUser.adminPassword);

        // 3. With admin re-authenticated, create user profile in 'usuarios' collection
        await setDoc(doc(db, 'usuarios', newUser.uid), {
            nome: data.nomeCompleto,
            email: data.email,
            perfil: 'formador',
        });

        // 4. Create trainer details in 'formadores' collection
        const { password, ...formData } = data;
        const formadorData = {
            ...formData,
            cpf: formData.cpf.replace(/\D/g, ''),
            telefone: formData.telefone.replace(/\D/g, ''),
        };
        await setDoc(doc(db, 'formadores', newUser.uid), formadorData);

    } catch (error) {
        // If Firestore operations fail, we should ideally delete the created Auth user.
        // This is a complex operation and requires Admin SDK, but we log it for now.
        console.error("Failed to create Firestore documents for new user. Manual cleanup of Auth user may be needed.", error);
        // Re-throw the error to be caught by the onSubmit handler
        throw error;
    }
  }


  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
        if(isEditMode && formador) {
            const { password, email, ...updateData } = values;
            await updateFormador(formador.id, updateData);
            toast({
                title: 'Sucesso!',
                description: 'Formador atualizado com sucesso.',
            });
        } else {
            await createFormador(values);
            toast({
                title: 'Sucesso!',
                description: 'Formador criado com sucesso.',
            });
        }
        onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      let errorMessage = "Ocorreu um erro desconhecido.";
      if(error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este email já está em uso por outra conta.';
      } else if (error.code === 'auth/missing-password') {
        errorMessage = 'A senha é obrigatória para criar um novo formador.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar formador',
        description: errorMessage,
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
          name="nomeCompleto"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Completo</FormLabel>
              <FormControl>
                <Input placeholder="Nome do Formador" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@exemplo.com" {...field} disabled={isEditMode} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isEditMode && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Crie uma senha forte" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
                <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                    <Input 
                        placeholder="000.000.000-00" 
                        {...field}
                        onChange={(e) => {
                            const formatted = formatCPF(e.target.value);
                            field.onChange(formatted);
                        }}
                        maxLength={14}
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                    <Input 
                        placeholder="(00) 00000-0000" 
                        {...field}
                        onChange={(e) => {
                            const formatted = formatTelefone(e.target.value);
                            field.onChange(formatted);
                        }}
                        maxLength={15}
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <FormField
          control={form.control}
          name="curriculo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currículo</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva a experiência e qualificações do formador."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="municipiosResponsaveis"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Municípios Responsáveis</FormLabel>
                <ComboboxMunicipios
                    selected={field.value}
                    onChange={field.onChange}
                    onEstadoChange={(uf) => form.setValue('uf', uf, { shouldValidate: true })}
                    initialUf={form.getValues('uf')}
                />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="uf"
          render={({ field }) => (
            <FormItem className='hidden'>
              <FormLabel>UF</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='space-y-2 pt-4'>
            <Separator />
            <div>
                <h3 className='text-sm font-medium'>Dados Bancários (Opcional)</h3>
                <p className='text-sm text-muted-foreground'>Informações para pagamento.</p>
            </div>
        </div>

        <FormField
          control={form.control}
          name="banco"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Banco</FormLabel>
              <FormControl>
                <Input placeholder="Nome ou número do banco" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="agencia"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Agência</FormLabel>
                <FormControl>
                    <Input placeholder="0000" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="conta"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Conta com dígito</FormLabel>
                <FormControl>
                    <Input placeholder="00000-0" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
         <FormField
          control={form.control}
          name="pix"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chave PIX</FormLabel>
              <FormControl>
                <Input placeholder="Email, CPF, telefone, etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        <Button type="submit" className="w-full !mt-6" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Salvar Alterações' : 'Criar Formador')}
        </Button>
      </form>
    </Form>
  );
}

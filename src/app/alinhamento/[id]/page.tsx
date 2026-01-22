
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { addDoc, Timestamp, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, ClipboardCheck, CheckCircle2, ShieldOff, PlusCircle, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm, useFieldArray, Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import type { ProjetoImplatancao } from '@/lib/types';


const responsavelSchema = z.object({
  nome: z.string().min(3, 'O nome é obrigatório.'),
  funcao: z.string().min(3, 'A função é obrigatória.'),
});

const alinhamentoSchema = z.object({
  dataReuniao: z.date({ required_error: 'A data da reunião é obrigatória.' }),
  horarioReuniao: z.string().min(1, 'O horário é obrigatório.'),
  responsaveis: z.array(responsavelSchema).min(1, 'Adicione pelo menos um responsável.'),
  formatoAdocao: z.string().min(3, 'Este campo é obrigatório.'),
  duracaoProjeto: z.string().min(3, 'Este campo é obrigatório.'),
  etapasUtilizarao: z.string().min(3, 'Este campo é obrigatório.'),
  qtdAlunos: z.preprocess(
    (val) => (String(val || '').trim() === '' ? undefined : val),
    z.coerce.number({
        required_error: "A quantidade de alunos é obrigatória.",
        invalid_type_error: "Deve ser um número.",
    }).positive("A quantidade de alunos deve ser maior que zero.").optional()
  ),
  qtdProfessores: z.preprocess(
    (val) => (String(val || '').trim() === '' ? undefined : val),
    z.coerce.number({
        required_error: "A quantidade de professores é obrigatória.",
        invalid_type_error: "Deve ser um número.",
    }).positive("A quantidade de professores deve ser maior que zero.").optional()
  ),
  motivosAdocao: z.string().min(10, 'Descreva os motivos com mais detalhes.'),
  expectativas: z.string().min(10, 'Descreva as expectativas com mais detalhes.'),
  ideb: z.string().min(1, 'O IDEB é obrigatório.'),
  doresMunicipio: z.string().min(10, 'Descreva as dores com mais detalhes.'),
  sugestoesFormacao: z.string().min(10, 'Descreva as sugestões com mais detalhes.'),
});

type AlinhamentoFormValues = z.infer<typeof alinhamentoSchema>;

// Helper components defined outside the main component to prevent re-creation on re-renders
const FormRow = ({ control, name, label }: { control: Control<AlinhamentoFormValues>, name: keyof AlinhamentoFormValues, label: string }) => (
    <FormField control={control} name={name} render={({ field }) => (
        <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
                <Textarea {...field} value={field.value as string ?? ''} />
            </FormControl>
            <FormMessage />
        </FormItem>
    )}/>
);
  
const NumberRow = ({ control, name, label }: { control: Control<AlinhamentoFormValues>, name: keyof AlinhamentoFormValues, label: string }) => (
    <FormField control={control} name={name} render={({ field }) => (
        <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
                <Input type="number" {...field} value={field.value as number ?? ''} onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)} />
            </FormControl>
            <FormMessage />
        </FormItem>
    )}/>
);


export default function AlinhamentoPage() {
  const params = useParams();
  const { toast } = useToast();
  const projetoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<ProjetoImplatancao | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const form = useForm<AlinhamentoFormValues>({
    resolver: zodResolver(alinhamentoSchema),
    shouldFocusError: false,
    defaultValues: {
      dataReuniao: undefined,
      horarioReuniao: '',
      responsaveis: [{ nome: '', funcao: '' }],
      formatoAdocao: '',
      duracaoProjeto: '',
      etapasUtilizarao: '',
      qtdAlunos: undefined,
      qtdProfessores: undefined,
      motivosAdocao: '',
      expectativas: '',
      ideb: '',
      doresMunicipio: '',
      sugestoesFormacao: '',
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "responsaveis"
  });


  const fetchData = useCallback(async () => {
    if (!projetoId) return;
    setLoading(true);
    setError(null);
    try {
        const projetoRef = doc(db, 'projetos', projetoId);
        const projetoSnap = await getDoc(projetoRef);

        if (!projetoSnap.exists()) {
            throw new Error('Projeto não encontrado ou indisponível.');
        }
        
        const projetoData = { id: projetoSnap.id, ...projetoSnap.data() } as ProjetoImplatancao;
        setProjeto(projetoData);

    } catch (error: any) {
      console.error('Erro ao buscar dados do projeto:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [projetoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onInvalid = (errors: any) => {
    toast({
        variant: 'destructive',
        title: "Erro de Validação",
        description: "Por favor, verifique os campos em vermelho e tente novamente.",
    });
  }

  const onSubmit = async (data: AlinhamentoFormValues) => {
    try {
      // Usar o ID do projeto como ID do documento de alinhamento para criar um link 1-para-1
      const alinhamentoRef = doc(db, 'alinhamentos', projetoId);
      
      await setDoc(alinhamentoRef, {
        ...data,
        projetoId: projetoId,
        municipio: projeto?.municipio,
        dataEnvio: Timestamp.now(),
      });

      toast({
          title: "Formulário enviado com sucesso!",
          description: "Obrigado por preencher o alinhamento técnico.",
      });
      setIsSubmitted(true);
    } catch (error) {
       console.error("Error adding document: ", error);
       toast({
           variant: 'destructive',
           title: "Erro ao enviar formulário",
           description: "Não foi possível salvar suas informações. Tente novamente.",
       });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSubmitted) {
    return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h1 className="text-2xl font-bold">Obrigado!</h1>
            <p className="text-muted-foreground">Suas informações foram registradas com sucesso.</p>
        </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-center">
        <ShieldOff className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-destructive">Acesso Indisponível</h1>
        <p className="text-muted-foreground max-w-sm">{error}</p>
      </div>
    );
  }

  if (!projeto) {
      return null;
  }

  return (
    <div className="flex flex-col gap-4 py-6 h-full items-center bg-muted">
        <div className="w-full max-w-4xl p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-3'>
                        <ClipboardCheck className='h-7 w-7 text-primary' />
                        Reunião de Alinhamento Técnico
                    </CardTitle>
                    <CardDescription>
                        Preencha os campos abaixo para alinhar os detalhes do projeto.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
                           <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>Informações Básicas</h3>
                                <Separator />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                     <FormField control={form.control} name="dataReuniao" render={({ field }) => (
                                        <FormItem className="flex flex-col"><FormLabel>Data da Reunião</FormLabel>
                                            <Popover><PopoverTrigger asChild><FormControl>
                                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                            </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                            </PopoverContent></Popover><FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="horarioReuniao" render={({ field }) => (
                                        <FormItem><FormLabel>Horário</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormItem><FormLabel>Município</FormLabel><FormControl><Input value={projeto.municipio} disabled /></FormControl></FormItem>
                                </div>
                                <div>
                                    <FormLabel>Responsáveis pelo projeto</FormLabel>
                                    <div className="mt-2 space-y-3">
                                    {fields.map((item, index) => (
                                        <div key={item.id} className="flex gap-2 items-end p-2 border rounded-md">
                                            <FormField control={form.control} name={`responsaveis.${index}.nome`} render={({ field }) => (
                                                <FormItem className="flex-grow"><FormLabel className='text-xs'>Nome</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                            <FormField control={form.control} name={`responsaveis.${index}.funcao`} render={({ field }) => (
                                                <FormItem className="flex-grow"><FormLabel className='text-xs'>Função</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                             <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button type="button" size="sm" variant="outline" onClick={() => append({ nome: '', funcao: '' })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Responsável
                                    </Button>
                                    </div>
                                </div>
                            </div>

                             <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>Detalhes do Projeto</h3>
                                <Separator />
                                <FormRow control={form.control} name="formatoAdocao" label="Como o município pretende adotar o projeto (contraturno, uma vez na semana, etc.)?" />
                                <FormRow control={form.control} name="duracaoProjeto" label="Qual será a duração do projeto (2 meses, 1 ano, etc.)?" />
                                <FormRow control={form.control} name="etapasUtilizarao" label="Que anos/etapas utilizarão o material?" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <NumberRow control={form.control} name="qtdAlunos" label="Quantos alunos que participarão do projeto?" />
                                  <NumberRow control={form.control} name="qtdProfessores" label="Quantos professores participarão do projeto?" />
                                </div>
                            </div>
                            
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>Contexto e Expectativas</h3>
                                <Separator />
                                <FormRow control={form.control} name="motivosAdocao" label="Qual(is) os principais motivos para a adoção do material?" />
                                <FormRow control={form.control} name="expectativas" label="Qual(is) as expectativas do município em relação ao projeto?" />
                                <FormRow control={form.control} name="ideb" label="Qual o Ideb do município?" />
                                <FormRow control={form.control} name="doresMunicipio" label="Qual(is) as principais dores do município?" />
                                <FormRow control={form.control} name="sugestoesFormacao" label="O que deve conter na formação que possa atender as dificuldades apontadas?" />
                            </div>

                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enviar
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}


'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, getDocs, collection, where, addDoc, Timestamp, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, Formador } from '@/lib/types';
import { Loader2, ArrowLeft, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

const ufs = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const funcoes = [
    'Professor(a)',
    'Coordenador(a) Pedagógico',
    'Apoio técnico',
    'Diretor(a)',
];

const etapasEnsino = [
    'Educação Infantil',
    'Ensino Fundamental I - Anos Iniciais',
    'Ensino Fundamental I - Anos Finais',
    'Ensino Médio',
    'EJA',
];

const materiaisTema = [
    { id: 'sabe_brasil', label: 'Sabe Brasil' },
    { id: 'educacao_financeira', label: 'Educação Financeira' },
    { id: 'revisao_saberes', label: 'Revisão dos Saberes' },
    { id: 'educacao_transito', label: 'Educação para o trânsito' },
    { id: 'juntos_dengue', label: 'Juntos contra a Dengue' },
    { id: 'jovem_brasileiro', label: 'Jovem Brasileiro' },
    { id: 'ler_faz_bem', label: 'Ler Faz Bem' },
    { id: 'eja', label: 'EJA' },
    { id: 'robo_garden', label: 'Robo Garden' },
    { id: 'gigo_robotica', label: 'Gigo Robótica Educacional' },
    { id: 'livros_tecnicos', label: 'Livros Técnicos' },
    { id: 'conecta_enem', label: 'Conecta Enem' },
    { id: 'historia_geografia_pr', label: 'História e Geografia do Paraná' },
    { id: 'atlas_regional', label: 'Atlas Regional by Ziraldo' },
    { id: 'inteligenios', label: 'Inteligênios' },
];


const avaliacaoSchema = z.object({
    nomeCompleto: z.string().min(3, 'O nome completo é obrigatório.'),
    email: z.string().email('Por favor, insira um email válido.'),
    uf: z.string().min(2, 'O estado (UF) é obrigatório.'),
    cidade: z.string().min(2, 'A cidade é obrigatória.'),
    modalidade: z.enum(['Presencial', 'On-line'], { required_error: 'Selecione a modalidade.'}),
    funcao: z.string({ required_error: 'Selecione sua função pedagógica.'}),
    dataFormacao: z.date({ required_error: 'A data da formação é obrigatória.'}),
    etapaEnsino: z.string({ required_error: 'Selecione a etapa de ensino.'}),
    materialTema: z.array(z.string()).refine((value) => value.some((item) => item), {
        message: "Você precisa selecionar pelo menos um material.",
    }),
    avaliacaoAssuntos: z.enum(['Pouco relevantes', 'Relevantes', 'Muito relevantes', 'Fundamentais'], {
        required_error: 'Avalie os assuntos abordados.'
    }),
    avaliacaoOrganizacao: z.enum(['Ótima', 'Boa', 'Ruim'], {
        required_error: 'Avalie a organização do encontro.'
    }),
    avaliacaoRelevancia: z.enum(['Ótima', 'Boa', 'Ruim'], {
        required_error: 'Avalie a relevância da formação.'
    }),
    materialAtendeExpectativa: z.enum(['Sim', 'Não', 'Parcialmente'], {
        required_error: 'Avalie se o material atende às expectativas.'
    }),
    motivoMaterialNaoAtende: z.string().optional(),
    interesseFormacao: z.string().optional(),
    avaliacaoEditora: z.enum(['1', '2', '3', '4', '5'], {
        required_error: 'Avalie a formação da Editora LT.'
    }),
    observacoes: z.string().optional(),
});

type AvaliacaoFormValues = z.infer<typeof avaliacaoSchema>;

export default function AvaliacaoPage() {
  const params = useParams();
  const { toast } = useToast();
  const formacaoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const form = useForm<AvaliacaoFormValues>({
    resolver: zodResolver(avaliacaoSchema),
    shouldFocusError: true,
    defaultValues: {
        nomeCompleto: '',
        email: '',
        uf: '',
        cidade: '',
        materialTema: [],
        motivoMaterialNaoAtende: '',
        interesseFormacao: '',
        observacoes: '',
    }
  });

  const materialAtende = form.watch('materialAtendeExpectativa');


  const fetchData = useCallback(async () => {
    if (!formacaoId) return;
    setLoading(true);
    try {
      const formacaoRef = doc(db, 'formacoes', formacaoId);
      const formacaoSnap = await getDoc(formacaoRef);
      if (formacaoSnap.exists()) {
        const formacaoData = { id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao;
        setFormacao(formacaoData);

        // Pre-fill form with formation data
        form.reset({
            ...form.getValues(), // keep existing values
            uf: formacaoData.uf,
            cidade: formacaoData.municipio,
        });

        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
            const q = query(collection(db, 'formadores'), where('__name__', 'in', formacaoData.formadoresIds));
            const formadoresSnap = await getDocs(q);
            setFormadores(formadoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador)));
        }
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Formação não encontrada.' });
      }
    } catch (error) {
      console.error('Erro ao buscar dados da formação:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados.' });
    } finally {
      setLoading(false);
    }
  }, [formacaoId, toast, form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmit = async (data: AvaliacaoFormValues) => {
    try {
      await addDoc(collection(db, 'avaliacoes'), {
        ...data,
        formacaoId: formacaoId,
        formacaoTitulo: formacao?.titulo,
        dataCriacao: Timestamp.now(),
      });

      toast({
          title: "Avaliação enviada com sucesso!",
          description: "Obrigado pelo seu feedback.",
      });
      setIsSubmitted(true);
    } catch (error) {
       console.error("Error adding document: ", error);
       toast({
           variant: 'destructive',
           title: "Erro ao enviar avaliação",
           description: "Não foi possível salvar sua avaliação. Tente novamente.",
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
            <h1 className="text-2xl font-bold">Obrigado pela sua avaliação!</h1>
            <p className="text-muted-foreground">Seu feedback é muito importante para nós.</p>
        </div>
    );
  }

  if (!formacao) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-xl">Formação não encontrada.</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-4 py-6 h-full items-center bg-muted">
        <div className="w-full max-w-4xl p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-3'>
                        <ClipboardCheck className='h-7 w-7 text-primary' />
                        Formulário de Avaliação
                    </CardTitle>
                    <CardDescription>
                        Formação: <span className='font-semibold text-foreground'>{formacao.titulo}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>1. Identificação</h3>
                                <Separator />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <FormField control={form.control} name="nomeCompleto" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nome Completo</FormLabel>
                                            <FormControl><Input placeholder="Seu nome" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl><Input type="email" placeholder="seu.email@exemplo.com" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="uf" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>UF</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} disabled>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {ufs.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="cidade" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cidade</FormLabel>
                                            <FormControl><Input placeholder="Sua cidade" {...field} disabled /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                           
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>2. Formador(es)</h3>
                                 <Separator />
                                 <div className='p-2 bg-muted rounded-md'>
                                    {formadores.map(f => <p key={f.id}>{f.nomeCompleto}</p>)}
                                 </div>
                            </div>

                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>3. Modalidade da formação</h3>
                                 <Separator />
                                <FormField control={form.control} name="modalidade" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><RadioGroupItem value="Presencial" /></FormControl>
                                                    <FormLabel className="font-normal">Presencial</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><RadioGroupItem value="On-line" /></FormControl>
                                                    <FormLabel className="font-normal">On-line</FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>4. Minha função pedagógica</h3>
                                 <Separator />
                                <FormField control={form.control} name="funcao" render={({ field }) => (
                                    <FormItem>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione sua função" /></SelectTrigger></FormControl>
                                            <SelectContent>{funcoes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <div className="space-y-4 p-4 border rounded-lg">
                                 <h3 className='font-semibold text-lg'>5. Data da formação</h3>
                                 <Separator />
                                 <FormField control={form.control} name="dataFormacao" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            </div>
                            
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>6. Com qual etapa de ensino você trabalha?</h3>
                                 <Separator />
                                <FormField control={form.control} name="etapaEnsino" render={({ field }) => (
                                    <FormItem>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger></FormControl>
                                            <SelectContent>{etapasEnsino.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                             <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>7. Assinale o material tema da formação</h3>
                                 <Separator />
                                 <FormField
                                    control={form.control}
                                    name="materialTema"
                                    render={() => (
                                        <FormItem>
                                        {materiaisTema.map((item) => (
                                            <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="materialTema"
                                            render={({ field }) => {
                                                return (
                                                <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(item.id)}
                                                            onCheckedChange={(checked) => {
                                                                return checked
                                                                ? field.onChange([...(field.value || []), item.id])
                                                                : field.onChange(
                                                                    field.value?.filter(
                                                                        (value) => value !== item.id
                                                                    )
                                                                    )
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">{item.label}</FormLabel>
                                                </FormItem>
                                                )
                                            }}
                                            />
                                        ))}
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                            </div>
                            
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>8. Como você avalia os assuntos abordados na formação?</h3>
                                 <Separator />
                                <FormField control={form.control} name="avaliacaoAssuntos" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                {['Pouco relevantes', 'Relevantes', 'Muito relevantes', 'Fundamentais'].map(val => (
                                                    <FormItem key={val} className="flex items-center space-x-3 space-y-0">
                                                        <FormControl><RadioGroupItem value={val} /></FormControl>
                                                        <FormLabel className="font-normal">{val}</FormLabel>
                                                    </FormItem>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            </div>

                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>9. Avalie a organização do encontro</h3>
                                 <Separator />
                                <FormField control={form.control} name="avaliacaoOrganizacao" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                 {['Ótima', 'Boa', 'Ruim'].map(val => (
                                                    <FormItem key={val} className="flex items-center space-x-3 space-y-0">
                                                        <FormControl><RadioGroupItem value={val} /></FormControl>
                                                        <FormLabel className="font-normal">{val}</FormLabel>
                                                    </FormItem>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            </div>

                             <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>10. Avalie a relevância da formação para sua prática em sala de aula.</h3>
                                 <Separator />
                                <FormField control={form.control} name="avaliacaoRelevancia" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                 {['Ótima', 'Boa', 'Ruim'].map(val => (
                                                    <FormItem key={val} className="flex items-center space-x-3 space-y-0">
                                                        <FormControl><RadioGroupItem value={val} /></FormControl>
                                                        <FormLabel className="font-normal">{val}</FormLabel>
                                                    </FormItem>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            </div>

                             <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>11. O material atende às expectativas no uso em sala de aula?</h3>
                                 <Separator />
                                <FormField control={form.control} name="materialAtendeExpectativa" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                 {['Sim', 'Não', 'Parcialmente'].map(val => (
                                                    <FormItem key={val} className="flex items-center space-x-3 space-y-0">
                                                        <FormControl><RadioGroupItem value={val} /></FormControl>
                                                        <FormLabel className="font-normal">{val}</FormLabel>
                                                    </FormItem>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            </div>
                            
                            {(materialAtende === 'Não' || materialAtende === 'Parcialmente') && (
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h3 className='font-semibold text-lg'>12. De acordo com a questão anterior, se sua resposta for não ou parcialmente, escreva o motivo.</h3>
                                    <Separator />
                                    <FormField control={form.control} name="motivoMaterialNaoAtende" render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea placeholder="Descreva o motivo..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            )}

                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>13. O que mais despertou seu interesse nessa formação?</h3>
                                <Separator />
                                <FormField control={form.control} name="interesseFormacao" render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea placeholder="Seu feedback é importante..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                             <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>14. Avalie a formação da Editora LT.</h3>
                                 <Separator />
                                <FormField control={form.control} name="avaliacaoEditora" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                         <FormDescription>
                                            Numa escala de 1 a 5, sendo 1 "Muito Ruim" e 5 "Excelente".
                                        </FormDescription>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4">
                                                 {['1', '2', '3', '4', '5'].map(val => (
                                                    <FormItem key={val} className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value={val} /></FormControl>
                                                        <FormLabel className="font-normal">{val}</FormLabel>
                                                    </FormItem>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            </div>

                             <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>15. Observações.</h3>
                                <Separator />
                                <FormField control={form.control} name="observacoes" render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea placeholder="Deixe aqui suas observações, críticas ou sugestões." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>


                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enviar Avaliação
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

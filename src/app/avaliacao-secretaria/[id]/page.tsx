
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { addDoc, Timestamp, collection, doc, getDoc, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, ClipboardCheck, CheckCircle2, ShieldOff, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { Formacao, AvaliacaoSecretaria } from '@/lib/types';

const ufs = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const avaliacaoOpcoes = z.enum(['Excelente', 'Bom', 'Regular', 'Ruim', 'Péssimo']);
const tempoOpcoes = z.enum(['Insuficiente (Faltou tempo)', 'Adequado (Tempo ideal)', 'Excessivo (Sobrou tempo)']);
const simNaoParcialOpcoes = z.enum(['Sim, totalmente', 'Parcialmente', 'Não']);
const engajamentoOpcoes = z.enum(['Muito alta', 'Alta', 'Média', 'Baixa']);
const organizacaoOpcoes = z.enum(['Excelente', 'Bom', 'Regular', 'Ruim', 'Não se aplica.']);

const avaliacaoSecretariaSchema = z.object({
    nomeCompleto: z.string().min(3, 'O nome completo é obrigatório.'),
    email: z.string().email('Por favor, insira um email válido.'),
    confirmarEmail: z.string().email('A confirmação de e-mail é obrigatória.'),
    cidade: z.string().min(1, 'A cidade é obrigatória.'),
    uf: z.string().min(2, 'O estado é obrigatório.'),
    dominioConteudo: avaliacaoOpcoes,
    tempoDedicado: tempoOpcoes,
    formatoApresentacao: simNaoParcialOpcoes,
    sugestoesMaterial: z.string().optional(),
    duvidasEsclarecidas: z.enum(['Sim', 'Não', 'Parcialmente']),
    aplicabilidade: z.enum(['1', '2', '3', '4', '5']),
    percepcaoEngajamento: engajamentoOpcoes,
    principaisBeneficios: z.string().optional(),
    organizacaoGeral: organizacaoOpcoes,
    avaliacaoCoffeeBreak: organizacaoOpcoes,
    comentariosFinais: z.string().optional(),
}).refine(data => data.email === data.confirmarEmail, {
    message: "Os emails não correspondem.",
    path: ["confirmarEmail"],
});

type AvaliacaoSecretariaFormValues = z.infer<typeof avaliacaoSecretariaSchema>;


export default function AvaliacaoSecretariaPage() {
  const params = useParams();
  const { toast } = useToast();
  const formacaoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const form = useForm<AvaliacaoSecretariaFormValues>({
    resolver: zodResolver(avaliacaoSecretariaSchema),
    shouldFocusError: false,
    defaultValues: {
        nomeCompleto: '',
        email: '',
        confirmarEmail: '',
        sugestoesMaterial: '',
        principaisBeneficios: '',
        comentariosFinais: '',
    }
  });
  
  const formatoApresentacao = form.watch('formatoApresentacao');

  const fetchData = useCallback(async () => {
    if (!formacaoId) return;
    setLoading(true);
    setError(null);
    try {
        const formacaoRef = doc(db, 'formacoes', formacaoId);
        const formacaoSnap = await getDoc(formacaoRef);

        if (!formacaoSnap.exists()) {
            throw new Error('Formação não encontrada ou indisponível.');
        }
        
        const formacaoData = { id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao;
        setFormacao(formacaoData);
        
        // Verifica se já existe uma avaliação para esta formação
        const q = query(collection(db, 'avaliacoesSecretaria'), where('formacaoId', '==', formacaoId), limit(1));
        const existingEvalSnap = await getDocs(q);
        if (!existingEvalSnap.empty) {
            setError('Uma avaliação para esta formação já foi enviada.');
        }

        form.reset({
            ...form.getValues(),
            cidade: formacaoData.municipio,
            uf: formacaoData.uf,
        });

    } catch (error: any) {
      console.error('Erro ao buscar dados da formação:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [formacaoId, form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onInvalid = () => {
    toast({
        variant: 'destructive',
        title: "Erro de Validação",
        description: "Por favor, verifique todos os campos obrigatórios e tente novamente.",
    });
  }

  const onSubmit = async (data: AvaliacaoSecretariaFormValues) => {
    try {
      const { confirmarEmail, ...dataToSave } = data;
      await addDoc(collection(db, 'avaliacoesSecretaria'), {
        ...dataToSave,
        formacaoId: formacaoId,
        formacaoTitulo: formacao?.titulo,
        dataCriacao: Timestamp.now(),
      });

      toast({
          title: "Avaliação enviada com sucesso!",
          description: "Agradecemos o seu feedback.",
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
            <h1 className="text-2xl font-bold">Obrigado!</h1>
            <p className="text-muted-foreground">Sua avaliação foi registrada com sucesso.</p>
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

  if (!formacao) {
      return null;
  }

  const RadioGroupField = ({ name, label, options }: { name: any, label: string, options: readonly string[] }) => (
    <FormField control={form.control} name={name} render={({ field }) => (
        <FormItem className="space-y-3">
            <FormLabel>{label}</FormLabel>
            <FormControl>
                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                    {options.map(val => (
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
  );
  
  const StarRatingField = ({ name, label }: { name: any, label: string }) => (
      <FormField control={form.control} name={name} render={({ field }) => (
        <FormItem className="space-y-3">
            <FormLabel>{label}</FormLabel>
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
  );

  return (
    <div className="flex flex-col gap-4 py-6 h-full items-center bg-muted">
        <div className="w-full max-w-4xl p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-3'>
                        <ClipboardCheck className='h-7 w-7 text-primary' />
                        Pesquisa de Satisfação – Formação {formacao.modalidade === 'Online' ? 'On-line' : 'Presencial'}
                    </CardTitle>
                    <CardDescription>
                        Sua opinião é fundamental para aprimorarmos nossos eventos. Formação: <span className='font-semibold text-foreground'>{formacao.titulo}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-10">
                            
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>I. Informações Gerais</h3>
                                <Separator />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <FormField control={form.control} name="nomeCompleto" render={({ field }) => (
                                        <FormItem><FormLabel>Nome Completo do Responsável</FormLabel><FormControl><Input placeholder="Seu nome" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="seu.email@exemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                     <FormField control={form.control} name="confirmarEmail" render={({ field }) => (
                                        <FormItem><FormLabel>Confirmar Email</FormLabel><FormControl><Input type="email" placeholder="Confirme seu e-mail" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                     <FormField control={form.control} name="cidade" render={({ field }) => (
                                        <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="uf" render={({ field }) => (
                                        <FormItem><FormLabel>Estado (UF)</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            </div>
                           
                            <div className="space-y-6 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>II. Sobre o Conteúdo e Didática</h3>
                                <Separator />
                                <RadioGroupField name="dominioConteudo" label="2) Como você avalia o domínio do conteúdo e a clareza dos formadores?" options={avaliacaoOpcoes.options} />
                                <RadioGroupField name="tempoDedicado" label="3) O tempo dedicado às apresentações e atividades foi:" options={tempoOpcoes.options} />
                                <RadioGroupField name="formatoApresentacao" label="4) O formato da apresentação (slides, vídeos, material visual) facilitou o entendimento?" options={simNaoParcialOpcoes.options} />
                                {formatoApresentacao !== 'Sim, totalmente' && (
                                    <FormField control={form.control} name="sugestoesMaterial" render={({ field }) => (
                                        <FormItem className="pl-6"><FormLabel>Caso tenha sugestões de melhoria para o material, descreva aqui:</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                )}
                                <RadioGroupField name="duvidasEsclarecidas" label="5) As dúvidas levantadas durante a formação foram esclarecidas de forma satisfatória?" options={['Sim', 'Não', 'Parcialmente']} />
                            </div>

                             <div className="space-y-6 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>III. Impacto e Aplicabilidade</h3>
                                <Separator />
                                <StarRatingField name="aplicabilidade" label='6) Na sua visão, quão aplicável é este material na prática das escolas da sua rede? (1="Pouco aplicável", 5="Totalmente aplicável")' />
                                <RadioGroupField name="percepcaoEngajamento" label="7) Qual foi a percepção de engajamento/motivação dos professores após a apresentação?" options={engajamentoOpcoes.options} />
                                 <FormField control={form.control} name="principaisBeneficios" render={({ field }) => (
                                    <FormItem><FormLabel>8) Do ponto de vista da Secretaria de Educação, quais foram os principais benefícios desta formação?</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>

                            <div className="space-y-6 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>IV. Organização e Logística</h3>
                                <Separator />
                                <RadioGroupField name="organizacaoGeral" label="9) Como você avalia a organização geral do evento (comunicação, recepção, suporte)?" options={organizacaoOpcoes.options} />
                                <RadioGroupField name="avaliacaoCoffeeBreak" label="10) Avaliação do Coffee Break (organização, variedade e qualidade):" options={organizacaoOpcoes.options} />
                            </div>

                            <div className="space-y-6 p-4 border rounded-lg">
                                <h3 className='font-semibold text-lg'>V. Comentários Finais</h3>
                                <Separator />
                                 <FormField control={form.control} name="comentariosFinais" render={({ field }) => (
                                    <FormItem><FormLabel>11) Algum comentário adicional sobre a postura dos formadores ou sugestões gerais?</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
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

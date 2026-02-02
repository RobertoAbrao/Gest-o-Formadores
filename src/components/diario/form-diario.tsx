

'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, setDoc, updateDoc, serverTimestamp, Timestamp, query, where, getDocs, arrayUnion, addDoc, deleteDoc } from 'firebase/firestore';
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
import type { Demanda, StatusDemanda, HistoricoItem, Anexo } from '@/lib/types';
import { useState, useEffect, useRef } from 'react';
import { Loader2, Calendar as CalendarIcon, Edit3, MessageSquarePlus, User as UserIcon, Clock, UploadCloud, Trash2, ImageIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

interface Estado {
    id: number;
    sigla: string;
    nome: string;
}

interface Municipio {
    id: number;
    nome: string;
}

interface AdminUser {
    id: string;
    nome: string;
}

const statusOptions: StatusDemanda[] = ['Pendente', 'Em andamento', 'Concluída', 'Aguardando retorno'];

const formSchema = z.object({
  municipio: z.string().min(2, { message: 'O município é obrigatório.' }),
  uf: z.string().min(2, { message: 'O estado (UF) é obrigatório.' }),
  demanda: z.string().min(10, { message: 'Descreva a demanda com pelo menos 10 caracteres.' }),
  status: z.enum(statusOptions, { required_error: 'Selecione um status.' }),
  responsavelId: z.string({ required_error: 'É obrigatório selecionar um responsável.' }),
  prioridade: z.enum(['Normal', 'Urgente']).default('Normal'),
  prazo: z.date().optional().nullable(),
  anexosIds: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FormDemandaProps {
  demanda?: Demanda | null;
  onSuccess: () => void;
}

const toDate = (timestamp: Timestamp | null | undefined): Date | undefined => {
  return timestamp ? timestamp.toDate() : undefined;
};

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
};

export function FormDemanda({ demanda, onSuccess }: FormDemandaProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!demanda;

  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);

  const [comment, setComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      municipio: demanda?.municipio || '',
      uf: demanda?.uf || '',
      demanda: demanda?.demanda || '',
      status: demanda?.status || 'Pendente',
      responsavelId: demanda?.responsavelId || user?.uid || undefined,
      prioridade: demanda?.prioridade || 'Normal',
      prazo: toDate(demanda?.prazo),
      anexosIds: demanda?.anexosIds || [],
    },
  });

  const selectedUf = form.watch('uf');
  
  useEffect(() => {
    const fetchAdmins = async () => {
        try {
            const q = query(collection(db, 'usuarios'), where('perfil', '==', 'administrador'));
            const querySnapshot = await getDocs(q);
            const adminData = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome as string }));
            setAdmins(adminData);
        } catch (error) {
            console.error("Failed to fetch admins", error);
            toast({ variant: 'destructive', title: "Erro", description: "Não foi possível carregar a lista de administradores." });
        }
    };
    fetchAdmins();
  }, [toast]);

  useEffect(() => {
    const fetchEstados = async () => {
        try {
            const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
            const data = await response.json();
            setEstados(data);
        } catch (error) {
            console.error('Failed to fetch estados', error);
            toast({ variant: "destructive", title: "Erro de rede", description: "Não foi possível carregar a lista de estados." });
        }
    };
    fetchEstados();
  }, [toast]);
  
  useEffect(() => {
    const fetchAnexos = async () => {
      if (demanda?.anexosIds && demanda.anexosIds.length > 0) {
        try {
          const q = query(collection(db, 'anexos'), where('__name__', 'in', demanda.anexosIds));
          const snapshot = await getDocs(q);
          const anexosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Anexo));
          setAnexos(anexosData);
        } catch (error) {
          console.error("Error fetching anexos:", error);
        }
      }
    };
    if (isEditMode) {
      fetchAnexos();
    }
  }, [demanda, isEditMode]);


  useEffect(() => {
    if (!selectedUf) {
      setMunicipios([]);
      return;
    };
    const fetchMunicipios = async () => {
        setLoadingMunicipios(true);
        try {
            const response = await fetch(`/api/municipios/${selectedUf}`);
            const data = await response.json();
             if (response.ok) {
                setMunicipios(data);
            } else {
                throw new Error(data.error || 'Erro ao buscar municípios');
            }
        } catch (error) {
            console.error('Failed to fetch municipios', error);
            toast({ variant: 'destructive', title: "Erro de rede", description: "Não foi possível carregar os municípios." });
        } finally {
            setLoadingMunicipios(false);
        }
    };
    fetchMunicipios();
  }, [selectedUf, toast]);
  
  const handleAddComment = async () => {
    if (!comment.trim() || !user || !demanda) return;
    setIsSubmittingComment(true);
    try {
        const newCommentItem: Omit<HistoricoItem, 'id' | 'data'> = {
            autorId: user.uid,
            autorNome: user.nome || 'Usuário',
            tipo: 'comentario',
            texto: comment.trim(),
        };
        
        await updateDoc(doc(db, 'demandas', demanda.id), {
            historico: arrayUnion({
                ...newCommentItem,
                id: doc(collection(db, 'demandas')).id,
                data: Timestamp.now(),
            }),
            dataAtualizacao: serverTimestamp(),
        });
        
        setComment('');
        toast({ title: 'Sucesso', description: 'Comentário adicionado.' });
        onSuccess();
    } catch (error) {
        console.error("Error adding comment:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível adicionar o comentário." });
    } finally {
        setIsSubmittingComment(false);
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
  
    if (!isEditMode) {
      toast({ variant: "destructive", title: "Ação necessária", description: "Por favor, salve a demanda primeiro para poder anexar arquivos." });
      return;
    }
  
    setUploading(true);
    try {
      const dataUrl = await fileToDataURL(file);
      const novoAnexo: Omit<Anexo, 'id'> = {
        nome: file.name,
        url: dataUrl,
        dataUpload: Timestamp.now(),
        demandaId: demanda!.id,
        autorId: user.uid,
      };
      
      const anexoDocRef = await addDoc(collection(db, 'anexos'), novoAnexo);
      
      const currentAnexosIds = form.getValues('anexosIds') || [];
      form.setValue('anexosIds', [...currentAnexosIds, anexoDocRef.id]);
      
      setAnexos(prev => [...prev, { ...novoAnexo, id: anexoDocRef.id }]);
      
      toast({ title: "Sucesso", description: "Anexo enviado." });
    } catch (error) {
      console.error("Erro no upload do arquivo:", error);
      toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar o arquivo." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  
  const handleDeleteAnexo = async (anexoIdToDelete: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este anexo?")) return;
  
    setUploading(true); // Re-use uploading state to disable button
    try {
      await deleteDoc(doc(db, 'anexos', anexoIdToDelete));
      
      const currentAnexosIds = form.getValues('anexosIds') || [];
      form.setValue('anexosIds', currentAnexosIds.filter(id => id !== anexoIdToDelete));
      
      setAnexos(prev => prev.filter(anexo => anexo.id !== anexoIdToDelete));
      toast({ title: "Sucesso", description: "Anexo excluído." });
    } catch (error) {
      console.error("Erro ao excluir anexo:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o anexo.' });
    } finally {
      setUploading(false);
    }
  };


  async function onSubmit(values: FormValues) {
    if (!user) {
      toast({ variant: 'destructive', title: 'Erro de autenticação' });
      return;
    }
    setLoading(true);

    const selectedAdmin = admins.find(admin => admin.id === values.responsavelId);

    try {
        if (isEditMode && demanda) {
            const alteracoes: Omit<HistoricoItem, 'id' | 'data'>[] = [];
            const userNome = user.nome || 'Usuário';

            if (values.status !== demanda.status) {
                alteracoes.push({ autorId: user.uid, autorNome: userNome, tipo: 'alteracao', texto: `Status alterado de "${demanda.status}" para "${values.status}".` });
            }
            if (values.responsavelId !== demanda.responsavelId) {
                alteracoes.push({ autorId: user.uid, autorNome: userNome, tipo: 'alteracao', texto: `Responsável alterado para "${selectedAdmin?.nome || 'N/A'}".` });
            }
            if (values.prioridade !== demanda.prioridade) {
                alteracoes.push({ autorId: user.uid, autorNome: userNome, tipo: 'alteracao', texto: `Prioridade alterada de "${demanda.prioridade}" para "${values.prioridade}".` });
            }
             const prazoAntigo = toDate(demanda.prazo)?.getTime();
             const prazoNovo = values.prazo?.getTime();
             if (prazoAntigo !== prazoNovo) {
                 const textoPrazo = `Prazo alterado para ${values.prazo ? format(values.prazo, 'dd/MM/yyyy') : 'N/A'}.`;
                 alteracoes.push({ autorId: user.uid, autorNome: userNome, tipo: 'alteracao', texto: textoPrazo });
             }

            const dataToSave: any = {
                ...values,
                municipio: values.municipio.trim(),
                demanda: values.demanda.trim(),
                responsavelNome: selectedAdmin?.nome || 'N/A',
                prazo: values.prazo ? Timestamp.fromDate(values.prazo) : null,
                dataAtualizacao: serverTimestamp(),
            };
            
            if (alteracoes.length > 0) {
                dataToSave.historico = arrayUnion(...alteracoes.map(item => ({
                    ...item,
                    id: doc(collection(db, 'demandas')).id,
                    data: Timestamp.now()
                })));
            }
            
            await updateDoc(doc(db, 'demandas', demanda.id), dataToSave);
            toast({ title: 'Sucesso!', description: 'Demanda atualizada com sucesso.' });
        } else {
            const newDocRef = doc(collection(db, 'demandas'));
            const historicoInicial: HistoricoItem[] = [{
                id: newDocRef.id,
                data: Timestamp.now(),
                autorId: user.uid,
                autorNome: user.nome || 'Usuário',
                tipo: 'criacao',
                texto: 'Demanda criada.'
            }];

            await setDoc(newDocRef, {
                id: newDocRef.id,
                municipio: values.municipio.trim(),
                uf: values.uf,
                demanda: values.demanda.trim(),
                status: values.status,
                responsavelId: values.responsavelId,
                responsavelNome: selectedAdmin?.nome || 'N/A',
                prioridade: values.prioridade,
                prazo: values.prazo ? Timestamp.fromDate(values.prazo) : null,
                dataCriacao: serverTimestamp(),
                dataAtualizacao: serverTimestamp(),
                historico: historicoInicial,
                anexosIds: values.anexosIds || [],
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
            name="uf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <Select onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('municipio', ''); // Reset municipio when UF changes
                }} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {estados.map(estado => <SelectItem key={estado.id} value={estado.sigla}>{estado.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="municipio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Município</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedUf || loadingMunicipios}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder={loadingMunicipios ? "Carregando..." : "Selecione o município"} />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {municipios.map(m => (
                            <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                        ))}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            name="responsavelId"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Responsável</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {admins.map(admin => <SelectItem key={admin.id} value={admin.id}>{admin.nome}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
             <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Defina a prioridade" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Urgente">Urgente</SelectItem>
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
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
        
        {isEditMode && demanda && (
            <div className="space-y-4 pt-6">
                <Separator />
                <h3 className="text-base font-semibold">Histórico e Comentários</h3>
                <div className="border rounded-lg p-3 bg-muted/50 max-h-60 overflow-y-auto space-y-4">
                    {demanda.historico && demanda.historico.length > 0 ? (
                        [...demanda.historico].sort((a,b) => b.data.toMillis() - a.data.toMillis()).map(item => (
                            <div key={item.id} className="flex items-start gap-3 text-sm">
                                <div className="mt-1">
                                    {item.tipo === 'comentario' ? <MessageSquarePlus className="h-4 w-4 text-muted-foreground"/> : <Edit3 className="h-4 w-4 text-muted-foreground"/>}
                                </div>
                                <div className="flex-1">
                                    <p className={cn(item.tipo === 'comentario' ? 'text-foreground' : 'text-muted-foreground italic')}>
                                        {item.texto}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                                        <UserIcon className="h-3 w-3" />
                                        <span>{item.autorNome}</span>
                                        <Clock className="h-3 w-3 ml-2" />
                                        <span>{format(item.data.toDate(), "dd/MM/yy 'às' HH:mm")}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum histórico para esta demanda.</p>
                    )}
                </div>
                <div className="space-y-2">
                    <FormLabel htmlFor="comment">Adicionar comentário</FormLabel>
                    <Textarea 
                        id="comment"
                        placeholder="Digite seu comentário..." 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                    <Button type="button" size="sm" onClick={handleAddComment} disabled={!comment.trim() || isSubmittingComment}>
                        {isSubmittingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Enviar Comentário
                    </Button>
                </div>
            </div>
        )}

        {isEditMode && demanda && (
          <div className="space-y-4 pt-6">
            <Separator />
            <h3 className="text-base font-semibold">Anexos</h3>
            <div className="space-y-2">
              {anexos.map(anexo => (
                <div key={anexo.id} className="text-sm text-primary flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0">
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{anexo.nome}</span>
                  </a>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteAnexo(anexo.id!)} disabled={uploading}>
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </div>
              ))}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || !isEditMode}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
              Adicionar Anexo
            </Button>
            {!isEditMode && <FormDescription>Salve a demanda primeiro para poder anexar arquivos.</FormDescription>}
          </div>
        )}

        <Button type="submit" className="w-full !mt-8" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Salvar Alterações' : 'Registrar Demanda')}
        </Button>
      </form>
    </Form>
  );
}

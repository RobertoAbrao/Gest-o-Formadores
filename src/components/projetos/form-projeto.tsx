

'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
  deleteField,
} from 'firebase/firestore';
import * as React from 'react';
import { format } from "date-fns"
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
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, CalendarIcon, Info, PlusCircle, Trash2, ChevronsUpDown, Check, X, RefreshCw, UploadCloud, Image as ImageIcon, Eraser, Star, Shield, DownloadCloud } from 'lucide-react';
import type { ProjetoImplatancao, Formador, Formacao, DevolutivaLink, Anexo, HistoricoItem } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { generateFormationCode } from '@/lib/utils';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const etapaStatusSchema = z.object({
  data: z.date().nullable().optional(),
  ok: z.boolean().optional(),
  detalhes: z.string().optional(),
  anexosIds: z.array(z.string()).optional(),
});

const periodoStatusSchema = z.object({
  dataInicio: z.date().nullable().optional(),
  dataFim: z.date().nullable().optional(),
  ok: z.boolean().optional(),
  detalhes: z.string().optional(),
  anexosIds: z.array(z.string()).optional(),
});

const devolutivaLinkSchema: z.ZodType<Omit<DevolutivaLink, 'data'>> = z.object({
  formacaoId: z.string().optional(),
  formacaoTitulo: z.string().optional(),
  dataInicio: z.date().nullable().optional(),
  dataFim: z.date().nullable().optional(),
  formadores: z.array(z.string()).optional(),
  ok: z.boolean().optional(),
  detalhes: z.string().optional(),
  anexosIds: z.array(z.string()).optional(),
  responsavelId: z.string().optional(),
  responsavelNome: z.string().optional(),
});


const linkReuniaoSchema = z.object({
    url: z.string().url("Por favor, insira uma URL válida.").optional().or(z.literal('')),
    descricao: z.string().optional(),
});

const reuniaoSchema = z.object({
    data: z.date().nullable().optional(),
    links: z.array(linkReuniaoSchema).optional(),
});

const eventoAdicionalSchema = z.object({
  titulo: z.string().min(1, "O título é obrigatório."),
  data: z.date().nullable().optional(),
  detalhes: z.string().optional(),
  anexosIds: z.array(z.string()).optional(),
});


const formSchema = z.object({
  municipio: z.string().min(1, { message: 'O município é obrigatório.' }),
  uf: z.string().min(2, { message: 'O estado é obrigatório.'}),
  versao: z.string().optional(),
  material: z.string().optional(),
  brasaoId: z.string().optional(),
  dossieUrl: z.string().url("Por favor, insira uma URL válida.").optional().or(z.literal('')),
  dataMigracao: z.date().nullable(),
  anexo: z.any().optional(), // Campo legado
  dataImplantacao: z.date().nullable(),
  implantacaoAnexosIds: z.array(z.string()).optional(),
  implantacaoDetalhes: z.string().optional(),
  implantacaoFormacaoId: z.string().optional(),
  qtdAlunos: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
    z.number().min(0).optional()
  ),
  formacoesPendentes: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
    z.number().min(0).optional()
  ),
  formadoresIds: z.array(z.string()).optional(),
  diagnostica: etapaStatusSchema,
  simulados: z.object({
    s1: periodoStatusSchema,
    s2: periodoStatusSchema,
    s3: periodoStatusSchema,
    s4: periodoStatusSchema,
  }),
  devolutivas: z.object({
    d1: devolutivaLinkSchema,
    d2: devolutivaLinkSchema,
    d3: devolutivaLinkSchema,
    d4: devolutivaLinkSchema,
  }),
  reunioes: z.array(reuniaoSchema).optional(),
  eventosAdicionais: z.array(eventoAdicionalSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FormProjetoProps {
  projeto?: ProjetoImplatancao | null;
  onSuccess: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

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

const toDate = (timestamp: Timestamp | null | undefined): Date | null => {
    if (!timestamp) return null;
    return timestamp.toDate();
};

const timestampOrNull = (date: Date | null | undefined): Timestamp | null => {
  return date ? Timestamp.fromDate(date) : null;
};

const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const cleanObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date || obj instanceof Timestamp) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(cleanObject);
    }
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (value !== undefined) {
          newObj[key] = cleanObject(value);
        }
      }
    }
    return newObj;
};

type FileUploadKey = 
  | 'diagnostica' 
  | 'implantacao'
  | 'simulados.s1' 
  | 'simulados.s2' 
  | 'simulados.s3' 
  | 'simulados.s4'
  | 'devolutivas.d1'
  | 'devolutivas.d2'
  | 'devolutivas.d3'
  | 'devolutivas.d4'
  | 'brasao'
  | `eventosAdicionais.${number}`;

export function FormProjeto({ projeto, onSuccess, onDirtyChange }: FormProjetoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<FileUploadKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allFormadores, setAllFormadores] = useState<Formador[]>([]);
  const [allAnexos, setAllAnexos] = useState<Anexo[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [formadorPopoverOpen, setFormadorPopoverOpen] = useState(false);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  
  const isEditMode = !!projeto;

  const defaultValues = useMemo(() => {
    return {
      municipio: projeto?.municipio || '',
      uf: projeto?.uf || '',
      versao: projeto?.versao || '',
      material: projeto?.material || '',
      brasaoId: projeto?.brasaoId || '',
      dossieUrl: projeto?.dossieUrl || '',
      dataMigracao: toDate(projeto?.dataMigracao),
      anexo: projeto?.anexo || null,
      dataImplantacao: toDate(projeto?.dataImplantacao),
      implantacaoAnexosIds: projeto?.implantacaoAnexosIds || [],
      implantacaoDetalhes: projeto?.implantacaoDetalhes || '',
      implantacaoFormacaoId: projeto?.implantacaoFormacaoId || '',
      qtdAlunos: projeto?.qtdAlunos || undefined,
      formacoesPendentes: projeto?.formacoesPendentes || undefined,
      formadoresIds: projeto?.formadoresIds || [],
      diagnostica: { data: toDate(projeto?.diagnostica?.data), ok: projeto?.diagnostica?.ok || false, detalhes: projeto?.diagnostica?.detalhes || '', anexosIds: projeto?.diagnostica?.anexosIds || [] },
      simulados: {
        s1: { dataInicio: toDate(projeto?.simulados?.s1?.dataInicio), dataFim: toDate(projeto?.simulados?.s1?.dataFim), ok: projeto?.simulados?.s1?.ok || false, detalhes: projeto?.simulados?.s1?.detalhes || '', anexosIds: projeto?.simulados?.s1?.anexosIds || [] },
        s2: { dataInicio: toDate(projeto?.simulados?.s2?.dataInicio), dataFim: toDate(projeto?.simulados?.s2?.dataFim), ok: projeto?.simulados?.s2?.ok || false, detalhes: projeto?.simulados?.s2?.detalhes || '', anexosIds: projeto?.simulados?.s2?.anexosIds || [] },
        s3: { dataInicio: toDate(projeto?.simulados?.s3?.dataInicio), dataFim: toDate(projeto?.simulados?.s3?.dataFim), ok: projeto?.simulados?.s3?.ok || false, detalhes: projeto?.simulados?.s3?.detalhes || '', anexosIds: projeto?.simulados?.s3?.anexosIds || [] },
        s4: { dataInicio: toDate(projeto?.simulados?.s4?.dataInicio), dataFim: toDate(projeto?.simulados?.s4?.dataFim), ok: projeto?.simulados?.s4?.ok || false, detalhes: projeto?.simulados?.s4?.detalhes || '', anexosIds: projeto?.simulados?.s4?.anexosIds || [] },
      },
      devolutivas: {
        d1: { ...projeto?.devolutivas?.d1, dataInicio: toDate(projeto?.devolutivas?.d1?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d1?.dataFim), anexosIds: projeto?.devolutivas?.d1?.anexosIds || [] },
        d2: { ...projeto?.devolutivas?.d2, dataInicio: toDate(projeto?.devolutivas?.d2?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d2?.dataFim), anexosIds: projeto?.devolutivas?.d2?.anexosIds || [] },
        d3: { ...projeto?.devolutivas?.d3, dataInicio: toDate(projeto?.devolutivas?.d3?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d3?.dataFim), anexosIds: projeto?.devolutivas?.d3?.anexosIds || [] },
        d4: { ...projeto?.devolutivas?.d4, dataInicio: toDate(projeto?.devolutivas?.d4?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d4?.dataFim), anexosIds: projeto?.devolutivas?.d4?.anexosIds || [] },
      },
      reunioes: projeto?.reunioes?.map(r => ({
          data: toDate(r.data),
          links: r.links ? [...r.links, ...Array(4 - r.links.length).fill({ url: '', descricao: '' })].slice(0, 4) : Array(4).fill({ url: '', descricao: '' }),
      })) || [],
      eventosAdicionais: projeto?.eventosAdicionais?.map(e => ({
          ...e,
          data: toDate(e.data),
      })) || [],
    }
  }, [projeto]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });
  
  const { formState: { isDirty } } = form;

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);


  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);


  const selectedUf = form.watch('uf');
  const brasaoId = form.watch('brasaoId');
  const municipio = form.watch('municipio');

  useEffect(() => {
    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const adminsQuery = query(collection(db, 'usuarios'), where('perfil', '==', 'administrador'));
            const [formadoresSnap, estadosResponse, anexosSnap, adminsSnap] = await Promise.all([
                getDocs(collection(db, 'formadores')),
                fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome'),
                projeto ? getDocs(query(collection(db, 'anexos'), where('projetoId', '==', projeto.id))) : Promise.resolve(null),
                getDocs(adminsQuery)
            ]);
            
            const formadoresData = formadoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formador));
            setAllFormadores(formadoresData);
            
            const adminData = adminsSnap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome as string }));
            setAdmins(adminData);

            if (anexosSnap) {
                const anexosData = anexosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Anexo));
                setAllAnexos(anexosData);
            }

            const estadosData = await estadosResponse.json();
            setEstados(estadosData);

        } catch (error) {
            console.error("Failed to fetch initial data", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os dados necessários." });
        } finally {
            setLoading(false);
        }
    };
    fetchInitialData();
  }, [toast, projeto]);

  useEffect(() => {
    if (!selectedUf) {
      setMunicipios([]);
      return;
    }
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
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os municípios." });
        } finally {
            setLoadingMunicipios(false);
        }
    };
    fetchMunicipios();
  }, [selectedUf, toast]);


  const availableFormadores = useMemo(() => {
      if (!selectedUf) return [];
      return allFormadores.filter(f => f.uf === selectedUf);
  }, [selectedUf, allFormadores]);


  const { fields: reuniaoFields, append: appendReuniao, remove: removeReuniao } = useFieldArray({
    control: form.control,
    name: "reunioes",
  });
  
  const { fields: eventoFields, append: appendEvento, remove: removeEvento } = useFieldArray({
    control: form.control,
    name: "eventosAdicionais",
  });
  
  const selectedFormadores = allFormadores.filter(f => form.watch('formadoresIds')?.includes(f.id));

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, etapa: FileUploadKey) => {
    const file = event.target.files?.[0];
    if (!file || (!projeto && !isEditMode)) return;

    setUploading(etapa);
    try {
      const projetoId = projeto?.id;
      if (!projetoId) {
          toast({ variant: "destructive", title: "Erro", description: "Salve o projeto primeiro antes de adicionar anexos." });
          return;
      }
      
      const anexoPath = etapa === 'implantacao' ? 'implantacaoAnexosIds' : etapa === 'brasao' ? 'brasaoId' : `${etapa}.anexosIds`;
      
      const dataUrl = await fileToDataURL(file);
      const novoAnexo: Omit<Anexo, 'id'> = { 
        nome: file.name, 
        url: dataUrl,
        dataUpload: Timestamp.now(),
        projetoId: projetoId,
        etapa: etapa,
      };
      const anexoDocRef = await addDoc(collection(db, 'anexos'), novoAnexo);
  
      if (etapa === 'brasao') {
        form.setValue('brasaoId', anexoDocRef.id);
      } else {
        const currentAnexosIds = form.getValues(anexoPath as any) || [];
        form.setValue(anexoPath as any, [...currentAnexosIds, anexoDocRef.id]);
      }
      
      setAllAnexos(prev => [...prev, { ...novoAnexo, id: anexoDocRef.id }]);
      
      toast({ title: "Sucesso", description: "Anexo enviado." });
    } catch (error) {
      console.error("Erro no upload do arquivo:", error);
      toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar o arquivo." });
    } finally {
      setUploading(null);
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAnexo = async (anexoIdToDelete: string, etapa: FileUploadKey | null) => {
    if (!window.confirm("Tem certeza que deseja excluir este anexo?")) return;

    if (etapa) setUploading(etapa);
    try {
        await deleteDoc(doc(db, 'anexos', anexoIdToDelete));
        
        if (etapa) {
          const anexoPath = etapa === 'implantacao' ? 'implantacaoAnexosIds' : etapa === 'brasao' ? 'brasaoId' : `${etapa}.anexosIds`;
          if (etapa === 'brasao') {
            form.setValue('brasaoId', undefined);
          } else {
            const currentAnexosIds = form.getValues(anexoPath as any) || [];
            form.setValue(anexoPath as any, currentAnexosIds.filter((id: string) => id !== anexoIdToDelete));
          }
        }
        
        setAllAnexos(prev => prev.filter(anexo => anexo.id !== anexoIdToDelete));

        toast({ title: "Sucesso", description: "Anexo excluído." });

    } catch (error) {
        console.error("Erro ao excluir anexo:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o anexo.' });
    } finally {
        if (etapa) setUploading(null);
    }
  };

  const handleAnexoTrigger = (etapa: FileUploadKey) => {
    if (fileInputRef.current) {
        fileInputRef.current.onchange = (e) => handleFileUpload(e as any, etapa);
        fileInputRef.current.click();
    }
  }

  const handleDeleteAnexoLegado = async () => {
    if (!projeto || !window.confirm("Tem certeza que deseja excluir este anexo legado?")) return;
    setLoading(true);
    try {
        await updateDoc(doc(db, 'projetos', projeto.id), {
            anexo: deleteField()
        });
        form.setValue('anexo', null);
        toast({ title: "Sucesso", description: "Anexo legado excluído." });
    } catch (error) {
        console.error("Erro ao excluir anexo legado:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível excluir o anexo legado." });
    } finally {
        setLoading(false);
    }
  };

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      
      const dataToSave = {
          ...values,
          dataMigracao: timestampOrNull(values.dataMigracao),
          dataImplantacao: timestampOrNull(values.dataImplantacao),
          diagnostica: {
            data: timestampOrNull(values.diagnostica.data),
            ok: values.diagnostica.ok,
            detalhes: values.diagnostica.detalhes,
            anexosIds: values.diagnostica.anexosIds,
          },
          simulados: {
            s1: { dataInicio: timestampOrNull(values.simulados.s1.dataInicio), dataFim: timestampOrNull(values.simulados.s1.dataFim), ok: values.simulados.s1.ok, detalhes: values.simulados.s1.detalhes, anexosIds: values.simulados.s1.anexosIds },
            s2: { dataInicio: timestampOrNull(values.simulados.s2.dataInicio), dataFim: timestampOrNull(values.simulados.s2.dataFim), ok: values.simulados.s2.ok, detalhes: values.simulados.s2.detalhes, anexosIds: values.simulados.s2.anexosIds },
            s3: { dataInicio: timestampOrNull(values.simulados.s3.dataInicio), dataFim: timestampOrNull(values.simulados.s3.dataFim), ok: values.simulados.s3.ok, detalhes: values.simulados.s3.detalhes, anexosIds: values.simulados.s3.anexosIds },
            s4: { dataInicio: timestampOrNull(values.simulados.s4.dataInicio), dataFim: timestampOrNull(values.simulados.s4.dataFim), ok: values.simulados.s4.ok, detalhes: values.simulados.s4.detalhes, anexosIds: values.simulados.s4.anexosIds },
          },
           devolutivas: {
            d1: { ...values.devolutivas.d1, dataInicio: timestampOrNull(values.devolutivas.d1.dataInicio), dataFim: timestampOrNull(values.devolutivas.d1.dataFim) },
            d2: { ...values.devolutivas.d2, dataInicio: timestampOrNull(values.devolutivas.d2.dataInicio), dataFim: timestampOrNull(values.devolutivas.d2.dataFim) },
            d3: { ...values.devolutivas.d3, dataInicio: timestampOrNull(values.devolutivas.d3.dataInicio), dataFim: timestampOrNull(values.devolutivas.d3.dataFim) },
            d4: { ...values.devolutivas.d4, dataInicio: timestampOrNull(values.devolutivas.d4.dataInicio), dataFim: timestampOrNull(values.devolutivas.d4.dataFim) },
          },
          reunioes: values.reunioes?.map(reuniao => ({
            data: timestampOrNull(reuniao.data),
            links: reuniao.links?.filter(link => link && link.url) || []
          })),
          eventosAdicionais: values.eventosAdicionais?.map(evento => ({
            ...evento,
            data: timestampOrNull(evento.data),
          }))
      };

      const cleanedData = cleanObject(dataToSave);
      delete cleanedData.anexo; // Sempre remover o campo legado ao salvar

      if (isEditMode && projeto) {
         await updateDoc(doc(db, 'projetos', projeto.id), cleanedData);
         toast({ title: 'Sucesso!', description: 'Projeto atualizado com sucesso.' });
      } else {
        const newDocRef = doc(collection(db, 'projetos'));
        await setDoc(newDocRef, {
            ...cleanedData,
            id: newDocRef.id,
            dataCriacao: serverTimestamp(),
        });
        toast({ title: 'Sucesso!', description: 'Projeto criado com sucesso.' });
      }
      onSuccess();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao salvar o projeto. Verifique os campos e tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  }
  
  const handleCreateFormation = async (title: string, dataInicio: Date | null | undefined, dataFim: Date | null | undefined, details: string | undefined, formadorNomes: string[]) => {
    const { municipio, uf } = form.getValues();
    if (!municipio || !uf) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um município e UF para o projeto primeiro.' });
      return null;
    }

    setLoading(true);
    try {
      let finalFormadoresIds: string[] = [];
      if (formadorNomes && formadorNomes.length > 0) {
        finalFormadoresIds = allFormadores.filter(f => formadorNomes.includes(f.nomeCompleto)).map(f => f.id);
      } else {
        finalFormadoresIds = form.getValues('formadoresIds') || [];
      }


      const newFormationData: Omit<Formacao, 'id'> = {
        titulo: title,
        descricao: details || `Atividade referente ao projeto de implantação em ${municipio}.`,
        status: 'preparacao',
        municipio,
        uf,
        codigo: generateFormationCode(municipio),
        formadoresIds: finalFormadoresIds,
        formadoresNomes: formadorNomes,
        materiaisIds: [],
        avaliacoesAbertas: false,
        dataInicio: dataInicio ? Timestamp.fromDate(dataInicio) : null,
        dataFim: dataFim ? Timestamp.fromDate(dataFim) : null,
      };
      
      const docRef = await addDoc(collection(db, "formacoes"), {
          ...newFormationData,
          dataCriacao: serverTimestamp(),
      });
      
      toast({ title: 'Sucesso!', description: `Formação "${title}" criada.` });
      return docRef.id;

    } catch (error) {
      console.error("Error creating formation:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar a formação.' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateImplantacaoFormation = async () => {
    const { dataImplantacao, municipio, formadoresIds } = form.getValues();
    const title = `Implantação: ${municipio}`;
    const formadores = allFormadores.filter(f => formadoresIds?.includes(f.id)).map(f => f.nomeCompleto);

    const newFormationId = await handleCreateFormation(title, dataImplantacao, dataImplantacao, 'Formação referente à implantação do sistema.', formadores);

    if (newFormationId) {
        form.setValue('implantacaoFormacaoId', newFormationId);
    }
  }

  const handleCreateDevolutivaFormation = async (devolutivaNumber: 1 | 2 | 3 | 4) => {
    const { municipio, uf, devolutivas } = form.getValues();
    const devolutivaData = devolutivas[`d${devolutivaNumber}`];
    const title = `Devolutiva ${devolutivaNumber}: ${municipio}`;
    
    const newFormationId = await handleCreateFormation(
        title, 
        devolutivaData.dataInicio, 
        devolutivaData.dataFim, 
        devolutivaData.detalhes,
        devolutivaData.formadores || []
    );
      
    if (newFormationId) {
      form.setValue(`devolutivas.d${devolutivaNumber}.formacaoId`, newFormationId);
      form.setValue(`devolutivas.d${devolutivaNumber}.formacaoTitulo`, title);
      
      if (devolutivaData.responsavelId) {
        const responsavel = admins.find(a => a.id === devolutivaData.responsavelId);
        if (responsavel) {
          const demandaText = `Preparar e acompanhar a Devolutiva ${devolutivaNumber} para ${municipio}.`;
          const historicoInicial: HistoricoItem[] = [{
            id: doc(collection(db, 'demandas')).id,
            data: Timestamp.now(),
            autorId: 'system',
            autorNome: 'Sistema',
            tipo: 'criacao',
            texto: `Demanda criada automaticamente a partir do agendamento da Devolutiva ${devolutivaNumber} no projeto ${municipio}.`
          }];

          const newDemand = {
            municipio,
            uf,
            demanda: demandaText,
            status: 'Pendente' as const,
            responsavelId: responsavel.id,
            responsavelNome: responsavel.nome,
            prioridade: 'Normal' as const,
            prazo: devolutivaData.dataInicio ? Timestamp.fromDate(devolutivaData.dataInicio) : null,
            dataCriacao: serverTimestamp(),
            dataAtualizacao: serverTimestamp(),
            origem: 'automatica' as const,
            projetoOrigemId: projeto?.id,
            formacaoOrigemId: newFormationId,
            historico: historicoInicial,
          };
          
          await addDoc(collection(db, 'demandas'), newDemand);
          toast({
            title: 'Demanda Criada!',
            description: `Uma nova tarefa foi criada no Diário de Bordo para ${responsavel.nome}.`
          });
        }
      }
    }
  };

  const handleUpdateFormation = async (devolutivaNumber: 1 | 2 | 3 | 4) => {
    setLoading(true);
    try {
        const { devolutivas } = form.getValues();
        const devolutivaData = devolutivas[`d${devolutivaNumber}`];
        const formacaoId = devolutivaData.formacaoId;

        if (!formacaoId) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma formação associada para atualizar.' });
            return;
        }
        
        const formadoresNomes = devolutivaData.formadores || [];
        const formadoresIds = allFormadores.filter(f => formadoresNomes.includes(f.nomeCompleto)).map(f => f.id);

        const updateData = {
            dataInicio: timestampOrNull(devolutivaData.dataInicio),
            dataFim: timestampOrNull(devolutivaData.dataFim),
            formadoresIds: formadoresIds,
            formadoresNomes: formadoresNomes,
        };

        const formacaoRef = doc(db, 'formacoes', formacaoId);
        await updateDoc(formacaoRef, updateData);

        toast({ title: 'Sucesso!', description: 'Formação no quadro foi atualizada com os dados do projeto.' });
    } catch (error) {
        console.error("Error updating formation:", error);
        toast({ variant: 'destructive', title: 'Erro de Atualização', description: 'Não foi possível sincronizar as alterações com a formação.' });
    } finally {
        setLoading(false);
    }
};

  const getAnexosForEtapa = (etapa: FileUploadKey): Anexo[] => {
    if (etapa === 'brasao') {
      const id = form.getValues('brasaoId');
      return allAnexos.filter(anexo => anexo.id === id);
    }
    const anexoPath = etapa === 'implantacao' ? 'implantacaoAnexosIds' : `${etapa}.anexosIds`;
    const ids = form.getValues(anexoPath as any) || [];
    return allAnexos.filter(anexo => ids.includes(anexo.id));
  };
  
  const handleClearImplantacao = () => {
    if (!window.confirm("Tem certeza que deseja limpar todos os dados desta etapa de Implantação?")) return;
    form.setValue('dataImplantacao', null);
    form.setValue('implantacaoDetalhes', '');
    // Note: We don't clear formacaoId automatically to avoid accidental unlinking. 
    // And we don't delete annexes to prevent data loss.
    toast({ title: 'Dados de implantação limpos.', description: 'Anexos não foram removidos.'});
  };

  const handleClearDevolutiva = (devolutivaNumber: 1 | 2 | 3 | 4) => {
    if (!window.confirm(`Tem certeza que deseja limpar todos os dados da Devolutiva ${devolutivaNumber}, incluindo o vínculo com a formação?`)) return;
    const etapaKey = `devolutivas.d${devolutivaNumber}` as const;
    form.setValue(etapaKey, {
      dataInicio: null,
      dataFim: null,
      detalhes: '',
      formadores: [],
      ok: false,
      formacaoId: undefined, // Desvincular formação
      formacaoTitulo: undefined,
      anexosIds: form.getValues(etapaKey).anexosIds // Manter anexos
    });
     toast({ title: `Dados da Devolutiva ${devolutivaNumber} limpos.`, description: 'A formação foi desvinculada e os anexos foram mantidos.' });
  }

  const brasaoAnexo = allAnexos.find(a => a.id === brasaoId);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
        
        <Card className="shadow-md shadow-primary/5">
            <CardHeader>
                <CardTitle>Dados Gerais do Projeto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="uf" render={({ field }) => (
                        <FormItem><FormLabel>UF</FormLabel>
                            <Select onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue('municipio', '');
                                form.setValue('formadoresIds', []);
                            }} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o estado" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>{estados.map(uf => (<SelectItem key={uf.id} value={uf.sigla}>{uf.nome}</SelectItem>))}</SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="municipio" render={({ field }) => (
                        <FormItem><FormLabel>Município</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedUf || loadingMunicipios}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={loadingMunicipios ? "Carregando..." : "Selecione o município"} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {municipios.map(m => <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)}
                                </SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )}/>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="versao" render={({ field }) => (
                        <FormItem><FormLabel>Versão</FormLabel><FormControl><Input placeholder="Ex: 1.0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="material" render={({ field }) => (
                        <FormItem><FormLabel>Material</FormLabel><FormControl><Input placeholder="Descreva os materiais do projeto" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="dossieUrl" render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                            <FormLabel>Link do Dossiê Final (Google Drive)</FormLabel>
                            <FormControl>
                                <div className="flex items-center gap-2">
                                    <DownloadCloud className="h-5 w-5 text-muted-foreground" />
                                    <Input placeholder="https://drive.google.com/..." {...field} value={field.value ?? ''} />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>
                 <div className="space-y-2">
                    <FormLabel>Brasão do Município</FormLabel>
                    {brasaoAnexo ? (
                    <div className="flex items-center gap-4">
                        <img src={brasaoAnexo.url} alt="Preview do Brasão" className="h-16 w-16 rounded-md object-contain border p-1" />
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteAnexo(brasaoAnexo.id!, 'brasao')}>
                        <Trash2 className="mr-2 h-4 w-4"/> Remover Brasão
                        </Button>
                    </div>
                    ) : (
                    <Button type="button" variant="outline" onClick={() => handleAnexoTrigger('brasao')} disabled={uploading === 'brasao' || !isEditMode}>
                        {uploading === 'brasao' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Shield className="mr-2 h-4 w-4" />}
                        Enviar Brasão
                    </Button>
                    )}
                    {!isEditMode && <FormDescription className="text-xs">Salve o projeto primeiro para poder enviar um brasão.</FormDescription>}
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-md shadow-primary/5">
             <CardHeader>
                <CardTitle>Implementação e Métricas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="dataMigracao" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Data de Migração</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                        </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                        </PopoverContent></Popover><FormMessage />
                    </FormItem>
                    )}/>
                     <div className="space-y-2">
                        <FormField control={form.control} name="dataImplantacao" render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Data de Implantação</FormLabel>
                                <div className="flex gap-2 items-center">
                                    <Popover><PopoverTrigger asChild><FormControl>
                                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                    </PopoverContent></Popover>
                                    <Button type="button" size="icon" variant="outline" onClick={() => handleAnexoTrigger('implantacao')} disabled={uploading === 'implantacao' || !isEditMode}>
                                        {uploading === 'implantacao' ? <Loader2 className="h-4 w-4 animate-spin"/> : <UploadCloud className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        {getAnexosForEtapa('implantacao').map(anexo => (
                            <div key={anexo.id} className="text-xs text-green-600 flex items-center justify-between">
                                <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> {anexo.nome}</span>
                                <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteAnexo(anexo.id!, 'implantacao')} disabled={uploading === 'implantacao'}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
                        ))}
                    </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <FormField control={form.control} name="implantacaoDetalhes" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Detalhes da Implantação</FormLabel>
                            <FormControl><Textarea placeholder="Descreva observações sobre a implantação..." {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <div className="space-y-2">
                        {form.watch("implantacaoFormacaoId") ? (
                            <div className="text-sm text-green-600 flex flex-col gap-2">
                                <span className='flex items-center gap-2'>
                                  <Check className="h-4 w-4" /> Formação de implantação criada.
                                </span>
                                <Button type="button" size="sm" variant="ghost" className="text-xs h-auto p-1" onClick={() => form.setValue('implantacaoFormacaoId', undefined)}>
                                    Desvincular
                                </Button>
                            </div>
                        ) : (
                            <Button type="button" size="sm" variant="secondary" onClick={handleCreateImplantacaoFormation} disabled={!form.watch('dataImplantacao')}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Criar Formação para Implantação
                            </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10" onClick={handleClearImplantacao}>
                            <Eraser className="mr-2 h-3 w-3" /> Limpar Dados
                        </Button>
                    </div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="qtdAlunos" render={({ field }) => (
                        <FormItem><FormLabel>Quantidade de Alunos</FormLabel><FormControl><Input type="number" min="0" placeholder="Ex: 500" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="formacoesPendentes" render={({ field }) => (
                        <FormItem><FormLabel>Formações Pendentes</FormLabel><FormControl><Input type="number" min="0" placeholder="Ex: 2" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField
                        control={form.control}
                        name="formadoresIds"
                        render={({ field }) => (
                            <FormItem className="flex flex-col sm:col-span-2">
                                <FormLabel>Formadores Responsáveis</FormLabel>
                                <Popover open={formadorPopoverOpen} onOpenChange={setFormadorPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between" disabled={!selectedUf}>
                                            <span className="truncate">
                                                {selectedFormadores.length > 0 ? `${selectedFormadores.length} selecionado(s)`: 'Selecione formadores...'}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                        <Command>
                                            <CommandInput placeholder="Buscar formador..." />
                                            <CommandList>
                                                <CommandEmpty>Nenhum formador encontrado para este UF.</CommandEmpty>
                                                <CommandGroup>
                                                    {availableFormadores.map((formador) => (
                                                        <CommandItem
                                                            key={formador.id}
                                                            value={formador.nomeCompleto}
                                                            onSelect={() => {
                                                                const currentIds = field.value || [];
                                                                const newIds = currentIds.includes(formador.id)
                                                                    ? currentIds.filter(id => id !== formador.id)
                                                                    : [...currentIds, formador.id];
                                                                field.onChange(newIds);
                                                            }}
                                                        >
                                                            <Check className={cn('mr-2 h-4 w-4', field.value?.includes(formador.id) ? 'opacity-100' : 'opacity-0')} />
                                                            {formador.nomeCompleto}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {selectedFormadores.length > 0 && (
                                    <div className="pt-2 flex flex-wrap gap-1">
                                        {selectedFormadores.map(formador => (
                                        <Badge key={formador.id} variant="secondary">
                                            {formador.nomeCompleto}
                                            <button
                                            type="button"
                                            className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            onClick={() => field.onChange(field.value?.filter(id => id !== formador.id))}
                                            >
                                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                            </button>
                                        </Badge>
                                        ))}
                                    </div>
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>
                 {form.getValues('anexo') && (
                    <div className="space-y-2 pt-4 border-t">
                        <Label className="text-destructive">Anexo Legado</Label>
                        <div className="flex items-center justify-between p-2 border border-destructive/50 rounded-md bg-destructive/10">
                            <p className="text-sm text-destructive">{form.getValues('anexo.nome')}</p>
                            <Button type="button" size="sm" variant="destructive" onClick={handleDeleteAnexoLegado} disabled={loading}>
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir Anexo Legado
                            </Button>
                        </div>
                        <FormDescription className="text-destructive">Este anexo está em um formato antigo. Exclua-o e envie novamente usando o novo sistema de anexos por etapa.</FormDescription>
                    </div>
                )}
            </CardContent>
        </Card>
        
        <Card className="shadow-md shadow-primary/5">
            <CardHeader>
                <div className='flex justify-between items-center'>
                    <CardTitle>Agendamento de Reuniões</CardTitle>
                    <Button type="button" size="sm" variant="outline" onClick={() => appendReuniao({ data: null, links: Array(4).fill({ url: '', descricao: '' }) })}>
                        <PlusCircle className='mr-2 h-4 w-4'/> Adicionar Reunião
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {reuniaoFields.map((field, index) => (
                    <Card key={field.id} className="p-4 bg-muted/40 shadow-sm shadow-primary/5">
                        <div className='flex justify-between items-center mb-4'>
                            <h4 className='font-semibold text-base'>Reunião {index + 1}</h4>
                            <Button type="button" size="icon" variant="ghost" className='h-7 w-7 text-destructive' onClick={() => removeReuniao(index)}>
                                <Trash2 className='h-4 w-4'/>
                            </Button>
                        </div>
                        <div className="space-y-4">
                            <FormField control={form.control} name={`reunioes.${index}.data`} render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>Data da Reunião</FormLabel>
                                    <Popover><PopoverTrigger asChild><FormControl>
                                    <Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                    </PopoverContent></Popover><FormMessage />
                                </FormItem>
                            )}/>
                            <div className="space-y-4">
                                {Array.from({ length: 4 }).map((_, linkIndex) => (
                                    <div key={linkIndex} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name={`reunioes.${index}.links.${linkIndex}.url`} render={({ field }) => (
                                            <FormItem><FormLabel>Link {linkIndex + 1}</FormLabel><FormControl><Input placeholder="https://exemplo.com" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name={`reunioes.${index}.links.${linkIndex}.descricao`} render={({ field }) => (
                                            <FormItem><FormLabel>Descrição do Link {linkIndex + 1}</FormLabel><FormControl><Input placeholder="Ex: Gravação da reunião" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                ))}
            </CardContent>
        </Card>

        <Card className="shadow-md shadow-primary/5">
            <CardHeader>
                <div className='flex justify-between items-center'>
                    <CardTitle>Eventos Adicionais</CardTitle>
                    <Button type="button" size="sm" variant="outline" onClick={() => appendEvento({ titulo: '', data: null, detalhes: '', anexosIds: [] })}>
                        <PlusCircle className='mr-2 h-4 w-4'/> Adicionar Evento
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {eventoFields.map((field, index) => {
                    const etapaKey = `eventosAdicionais.${index}` as const;
                    return (
                        <Card key={field.id} className="p-4 bg-muted/40 shadow-sm shadow-primary/5">
                             <div className='flex justify-between items-center mb-4'>
                                <h4 className='font-semibold text-base'>Evento #{index + 1}</h4>
                                <Button type="button" size="icon" variant="ghost" className='h-7 w-7 text-destructive' onClick={() => removeEvento(index)}>
                                    <Trash2 className='h-4 w-4'/>
                                </Button>
                            </div>
                            <div className="space-y-4">
                                <FormField control={form.control} name={`${etapaKey}.titulo`} render={({ field }) => (
                                    <FormItem><FormLabel>Título do Evento</FormLabel><FormControl><Input placeholder="Ex: Visita Técnica" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name={`${etapaKey}.data`} render={({ field }) => (
                                        <FormItem className="flex flex-col"><FormLabel>Data do Evento</FormLabel>
                                            <Popover><PopoverTrigger asChild><FormControl>
                                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                            </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                            </PopoverContent></Popover><FormMessage />
                                        </FormItem>
                                    )}/>
                                    <div className="flex flex-col justify-end">
                                        <Button type="button" size="sm" variant="outline" onClick={() => handleAnexoTrigger(etapaKey)} disabled={uploading === etapaKey || !isEditMode}>
                                            {uploading === etapaKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
                                            Enviar Anexo
                                        </Button>
                                    </div>
                                </div>
                                <FormField control={form.control} name={`${etapaKey}.detalhes`} render={({ field }) => (
                                    <FormItem><FormLabel>Detalhes</FormLabel><FormControl><Textarea placeholder="Descreva o evento..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                {getAnexosForEtapa(etapaKey).map(anexo => (
                                    <div key={anexo.id} className="text-xs text-green-600 flex items-center justify-between">
                                        <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> {anexo.nome}</span>
                                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteAnexo(anexo.id!, etapaKey)} disabled={uploading === etapaKey}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )
                })}
            </CardContent>
        </Card>

        <Card className="shadow-md shadow-primary/5">
            <CardHeader>
                <CardTitle>Avaliações e Simulados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Card className="p-4 bg-muted/40 shadow-sm shadow-primary/5">
                    <CardHeader className="p-0 mb-4">
                        <CardTitle className="text-base">Avaliação Diagnóstica</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4">
                        <div className='flex flex-wrap items-end gap-4'>
                            <FormField control={form.control} name="diagnostica.data" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Data</FormLabel>
                                <Popover><PopoverTrigger asChild><FormControl>
                                <Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                </PopoverContent></Popover><FormMessage />
                            </FormItem>
                            )}/>
                            <FormField control={form.control} name="diagnostica.ok" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 h-10"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>OK?</FormLabel></FormItem>
                            )}/>
                            <Button type="button" size="sm" variant="outline" onClick={() => handleAnexoTrigger('diagnostica')} disabled={uploading === 'diagnostica' || !isEditMode}>
                                {uploading === 'diagnostica' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
                                Enviar Anexo
                            </Button>
                        </div>
                        <FormField control={form.control} name="diagnostica.detalhes" render={({ field }) => (
                            <FormItem><FormLabel>Detalhes</FormLabel><FormControl><Textarea placeholder="Detalhes sobre a avaliação diagnóstica..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        {getAnexosForEtapa('diagnostica').map(anexo => (
                                <div key={anexo.id} className="text-xs text-green-600 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> {anexo.nome}</span>
                                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteAnexo(anexo.id!, 'diagnostica')} disabled={uploading === 'diagnostica'}>
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            ))}
                    </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {([1, 2, 3, 4] as const).map(i => {
                    const etapaKey = `simulados.s${i}` as const;
                    return (
                        <Card key={etapaKey} className="p-4 bg-muted/40 shadow-sm shadow-primary/5">
                             <CardHeader className="p-0 mb-4">
                                <CardTitle className="text-base">Simulado {i}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 space-y-4">
                                <FormField control={form.control} name={`${etapaKey}.dataInicio`} render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Data Início</FormLabel>
                                    <Popover><PopoverTrigger asChild><FormControl>
                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                    </PopoverContent></Popover><FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name={`${etapaKey}.dataFim`} render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Data Fim</FormLabel>
                                    <Popover><PopoverTrigger asChild><FormControl>
                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                    </PopoverContent></Popover><FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="flex items-center justify-between gap-4">
                                    <FormField control={form.control} name={`${etapaKey}.ok`} render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-2 pt-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>OK?</FormLabel></FormItem>
                                    )}/>
                                    <Button type="button" size="sm" variant="outline" onClick={() => handleAnexoTrigger(etapaKey)} disabled={uploading === etapaKey || !isEditMode}>
                                        {uploading === etapaKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
                                        Anexar
                                    </Button>
                                </div>
                                <FormField control={form.control} name={`${etapaKey}.detalhes`} render={({ field }) => (
                                    <FormItem><FormLabel>Detalhes</FormLabel><FormControl><Textarea placeholder="Detalhes sobre o simulado..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                {getAnexosForEtapa(etapaKey).map(anexo => (
                                    <div key={anexo.id} className="text-xs text-green-600 flex items-center justify-between">
                                        <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> {anexo.nome}</span>
                                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteAnexo(anexo.id!, etapaKey)} disabled={uploading === etapaKey}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )
                })}
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-md shadow-primary/5">
            <CardHeader>
                <CardTitle>Cronograma de Devolutivas</CardTitle>
                <CardDescription>
                Você pode agendar as devolutivas aqui ou criar uma formação completa para elas, para um gerenciamento mais detalhado.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {([1, 2, 3, 4] as const).map(i => {
                        const etapaKey = `devolutivas.d${i}` as const;
                        const devolutiva = form.watch(etapaKey);
                        return (
                            <Card key={etapaKey} className='p-4 bg-muted/40 shadow-sm shadow-primary/5'>
                                <CardHeader className="p-0 mb-4 flex-row justify-between items-start">
                                    <CardTitle className="text-base">Devolutiva {i}{ municipio ? `: ${municipio}` : '' }</CardTitle>
                                    <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10 h-7" onClick={() => handleClearDevolutiva(i)}>
                                            <Eraser className="mr-2 h-3 w-3" /> Limpar
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0 space-y-4">
                                    <FormField control={form.control} name={`${etapaKey}.dataInicio`} render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Data Início</FormLabel>
                                        <Popover><PopoverTrigger asChild><FormControl>
                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                            {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                        </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                        </PopoverContent></Popover><FormMessage />
                                    </FormItem>
                                    )}/>
                                    <FormField control={form.control} name={`${etapaKey}.dataFim`} render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Data Fim</FormLabel>
                                        <Popover><PopoverTrigger asChild><FormControl>
                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                            {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                        </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                        </PopoverContent></Popover><FormMessage />
                                    </FormItem>
                                    )}/>
                                    <FormField
                                        control={form.control}
                                        name={`${etapaKey}.formadores`}
                                        render={({ field }) => {
                                            const selectedDevolutivaFormadores = allFormadores.filter(f => field.value?.includes(f.nomeCompleto));

                                            return (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Formadores</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" role="combobox" className="w-full justify-between">
                                                                <span className="truncate">
                                                                    {selectedDevolutivaFormadores.length > 0 ? `${selectedDevolutivaFormadores.length} selecionado(s)` : "Selecione formadores..."}
                                                                </span>
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[300px] p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Buscar formador..." />
                                                                <CommandList>
                                                                    <CommandEmpty>Nenhum formador encontrado.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {allFormadores.map((formador) => (
                                                                            <CommandItem
                                                                                key={formador.id}
                                                                                value={formador.nomeCompleto}
                                                                                onSelect={() => {
                                                                                    const currentValues = field.value || [];
                                                                                    const newValues = currentValues.includes(formador.nomeCompleto)
                                                                                        ? currentValues.filter(name => name !== formador.nomeCompleto)
                                                                                        : [...currentValues, formador.nomeCompleto];
                                                                                    field.onChange(newValues);
                                                                                }}
                                                                            >
                                                                                <Check className={cn('mr-2 h-4 w-4', field.value?.includes(formador.nomeCompleto) ? 'opacity-100' : 'opacity-0')} />
                                                                                {formador.nomeCompleto}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormMessage />
                                                </FormItem>
                                            );
                                        }}
                                    />
                                    <FormField control={form.control} name={`${etapaKey}.detalhes`} render={({ field }) => (
                                    <FormItem><FormLabel>Detalhes</FormLabel><FormControl><Textarea placeholder="Detalhes sobre a devolutiva..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField
                                        control={form.control}
                                        name={`${etapaKey}.responsavelId`}
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Responsável pela Demanda</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                    <SelectValue placeholder="Selecione um responsável" />
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
                                    <div className='flex justify-between items-center gap-2 pt-2 border-t'>
                                        <FormField control={form.control} name={`${etapaKey}.ok`} render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>OK?</FormLabel></FormItem>
                                        )}/>
                                        <Button type="button" size="sm" variant="outline" onClick={() => handleAnexoTrigger(etapaKey)} disabled={uploading === etapaKey || !isEditMode}>
                                            {uploading === etapaKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
                                            Anexar
                                        </Button>
                                    </div>
                                    {getAnexosForEtapa(etapaKey).map(anexo => (
                                        <div key={anexo.id} className="text-xs text-green-600 flex items-center justify-between">
                                            <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> {anexo.nome}</span>
                                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteAnexo(anexo.id!, etapaKey)} disabled={uploading === etapaKey}>
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    ))}
                                    <Separator className="!my-4"/>
                                    {devolutiva?.formacaoId ? (
                                        <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            Formação criada: <span className="font-semibold text-foreground">{devolutiva.formacaoTitulo}</span>
                                        </p>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/quadro`} target="_blank">Ver no Quadro</Link>
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="secondary" 
                                                size="sm"
                                                onClick={() => handleUpdateFormation(i)}
                                                disabled={loading}
                                            >
                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                Atualizar
                                            </Button>
                                        </div>
                                        </div>
                                    ) : (
                                        <Button 
                                        type="button" 
                                        variant="secondary" 
                                        onClick={() => handleCreateDevolutivaFormation(i)}
                                        disabled={loading}
                                        >
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                        Criar Formação para Devolutiva
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                })}
            </CardContent>
        </Card>

        <Button type="submit" className="w-full !mt-8" disabled={loading || !isDirty}>
          {loading ? (<Loader2 className="animate-spin" />) : (isEditMode ? 'Salvar Alterações' : 'Criar Projeto')}
        </Button>
      </form>
    </Form>
  );
}

    

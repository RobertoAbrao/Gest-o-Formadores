
'use client';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';
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
import { format, subDays } from "date-fns"
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
import { useState, useEffect, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Loader2, CalendarIcon, Info, PlusCircle, Trash2, ChevronsUpDown, Check, X, RefreshCw, UploadCloud, Image as ImageIcon, Eraser, Star, Shield, DownloadCloud, UserCog } from 'lucide-react';
import type { Formacao, Formador, DevolutivaLink, Anexo, HistoricoItem, ProjetoImplatancao, ImplantacaoEntry } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { generateFormationCode } from '@/lib/utils';
import Link from 'next/link';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useAuth } from '@/hooks/use-auth';
import { ESTADOS_BR } from '@/lib/estados-br';
import {
  buildProjetoPayload,
  cleanObject,
  timestampOrNull,
  toDate,
  type FileUploadKey,
  type FormValues,
} from './projeto-form-schema';
import { useProjetoForm } from './use-projeto-form';

interface FormProjetoProps {
  projeto?: ProjetoImplatancao | null;
  onSuccess: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  /**
   * Instância de formulário criada por quem renderiza (página `/agente`).
   * Omitida, o componente cria a sua — comportamento das telas atuais.
   */
  form?: UseFormReturn<FormValues>;
  /**
   * Chamado quando o submit é barrado pela validação. Sem isto, o react-hook-form
   * apenas foca o campo inválido — que no celular pode estar numa aba invisível,
   * e o salvamento falha em silêncio.
   */
  onInvalid?: (errors: Record<string, unknown>) => void;
}

/** Ações imperativas que o robô guiado dispara neste formulário. */
export interface FormProjetoHandle {
  /** Submete e RESOLVE só depois da gravação terminar. */
  submit: () => Promise<boolean>;
  criarFormacaoDevolutiva: (devolutivaNumber: 1 | 2 | 3 | 4) => Promise<void>;
  atualizarFormacaoDevolutiva: (devolutivaNumber: 1 | 2 | 3 | 4) => Promise<void>;
  criarFormacaoImplantacao: (index: number) => Promise<void>;
  atualizarFormacaoImplantacao: (index: number) => Promise<void>;
  /** Rola até a seção indicada (usado ao trocar para a aba do formulário). */
  irParaSecao: (secao: SecaoProjeto) => void;
  formadores: Formador[];
  admins: AdminUser[];
}

export type SecaoProjeto =
  | 'dados-gerais'
  | 'implantacoes'
  | 'reunioes'
  | 'eventos-adicionais'
  | 'avaliacoes'
  | 'devolutivas';

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

const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};


export const FormProjeto = forwardRef<FormProjetoHandle, FormProjetoProps>(function FormProjeto(
  { projeto, onSuccess, onDirtyChange, form: formExterno, onInvalid },
  ref
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<FileUploadKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allFormadores, setAllFormadores] = useState<Formador[]>([]);
  const [allAnexos, setAllAnexos] = useState<Anexo[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [impFormadorPopoverOpen, setImpFormadorPopoverOpen] = useState<Record<number, boolean>>({});
  const estados = ESTADOS_BR;
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  
  const isEditMode = !!projeto;

  // A instancia pode vir de fora: na pagina /agente o robo guiado e este
  // formulario precisam operar o MESMO form. Sem a prop, o componente cria a
  // sua propria - e por isso que as telas existentes nao mudam.
  const formInterno = useProjetoForm(projeto);
  const form = formExterno ?? formInterno;

  const { formState: { isDirty } } = form;


  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);


  const selectedUf = form.watch('uf');
  const brasaoId = form.watch('brasaoId');

  useEffect(() => {
    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const adminsQuery = query(collection(db, 'usuarios'), where('perfil', '==', 'administrador'));
            const fetchList: Promise<any>[] = [
                getDocs(collection(db, 'formadores')),
                projeto ? getDocs(query(collection(db, 'anexos'), where('projetoId', '==', projeto.id))) : Promise.resolve(null),
                getDocs(adminsQuery)
            ];
            const [formadoresSnap, anexosSnap, adminsSnap] = await Promise.all(fetchList);
            
            const formadoresData = formadoresSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Formador));
            setAllFormadores(formadoresData);
            
            const adminData = adminsSnap.docs.map((doc: any) => ({ id: doc.id, nome: doc.data().nome as string }));
            setAdmins(adminData);

            if (anexosSnap) {
                const anexosData = anexosSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Anexo));
                setAllAnexos(anexosData);
            }
            // Estados são carregados localmente via ESTADOS_BR, sem necessidade de fetch externo.

        } catch (error) {
            console.error("Failed to fetch initial data", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar alguns dados necessários." });
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
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    data.sort((a: any, b: any) => a.nome.localeCompare(b.nome));
                    setMunicipios(data);
                } else {
                    setMunicipios([]);
                }
            } else {
                setMunicipios([]);
            }
        } catch (error) {
            console.error('Failed to fetch municipios', error);
            setMunicipios([]);
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

  const { fields: implantacaoFields, append: appendImplantacao, remove: removeImplantacao } = useFieldArray({
    control: form.control,
    name: "implantacoes",
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
      
      const anexoPath = etapa === 'implantacao' ? 'implantacaoAnexosIds' 
        : etapa === 'brasao' ? 'brasaoId' 
        : etapa.startsWith('implantacoes.') ? `${etapa}.anexosIds`
        : `${etapa}.anexosIds`;
      
      const dataUrl = await fileToDataURL(file);
      const novoAnexo: Omit<Anexo, 'id'> = { 
        nome: file.name, 
        url: dataUrl,
        dataUpload: Timestamp.now(),
        projetoId: projetoId,
        etapa: etapa,
        autorId: user!.uid,
      };
      
      const anexoDocRef = doc(collection(db, 'anexos'));
      setDoc(anexoDocRef, novoAnexo)
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: anexoDocRef.path,
            operation: 'create',
            requestResourceData: novoAnexo,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
  
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
        fileInputRef.current.onchange = null;
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAnexo = async (anexoIdToDelete: string, etapa: FileUploadKey | null) => {
    if (!window.confirm("Tem certeza que deseja excluir este anexo?")) return;

    if (etapa) setUploading(etapa);
    try {
        const anexoRef = doc(db, 'anexos', anexoIdToDelete);
        deleteDoc(anexoRef)
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: anexoRef.path,
              operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
          });
        
        if (etapa) {
          const anexoPath = etapa === 'implantacao' ? 'implantacaoAnexosIds' 
            : etapa === 'brasao' ? 'brasaoId' 
            : etapa.startsWith('implantacoes.') ? `${etapa}.anexosIds`
            : `${etapa}.anexosIds`;
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
        const projetoRef = doc(db, 'projetos', projeto.id);
        updateDoc(projetoRef, {
            anexo: deleteField()
        })
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: projetoRef.path,
            operation: 'update',
            requestResourceData: { anexo: deleteField() },
          });
          errorEmitter.emit('permission-error', permissionError);
        });
        form.setValue('anexo', null);
        toast({ title: "Sucesso", description: "Anexo legado excluído." });
    } catch (error) {
        console.error("Erro ao excluir anexo legado:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível excluir the anexo legado." });
    } finally {
        setLoading(false);
    }
  };

  // Espelha na formação vinculada os campos que a ficha (/ficha/[id]) e o quadro leem.
  // A ficha monta a equipe a partir de 'formacoes.formadoresIds'; até aqui esse espelho só
  // acontecia no botão "Atualizar Formação", então quem preenchia os formadores depois de
  // criar a formação ficava com a ficha vazia. Só grava campo que tem valor no projeto —
  // nunca zera o que já existe na formação.
  const sincronizarFormacoesVinculadas = (values: FormValues) => {
    const alvos: { formacaoId: string; formadores?: string[] | null; dataInicio?: Date | null; dataFim?: Date | null }[] = [];

    (values.implantacoes || []).forEach(imp => {
      if (imp.formacaoId) {
        alvos.push({ formacaoId: imp.formacaoId, formadores: imp.formadores, dataInicio: imp.dataInicio, dataFim: imp.dataFim });
      }
    });

    (['d1', 'd2', 'd3', 'd4'] as const).forEach(chave => {
      const dev = values.devolutivas?.[chave];
      if (dev?.formacaoId) {
        alvos.push({ formacaoId: dev.formacaoId, formadores: dev.formadores, dataInicio: dev.dataInicio, dataFim: dev.dataFim });
      }
    });

    alvos.forEach(({ formacaoId, formadores, dataInicio, dataFim }) => {
      const updateData: Record<string, any> = {};
      const nomes = formadores || [];

      if (nomes.length > 0) {
        updateData.formadoresNomes = nomes;
        updateData.formadoresIds = allFormadores.filter(f => nomes.includes(f.nomeCompleto)).map(f => f.id);
      }
      if (dataInicio) updateData.dataInicio = timestampOrNull(dataInicio);
      if (dataFim) updateData.dataFim = timestampOrNull(dataFim);

      if (Object.keys(updateData).length === 0) return;

      const formacaoRef = doc(db, 'formacoes', formacaoId);
      updateDoc(formacaoRef, updateData)
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: formacaoRef.path,
            operation: 'update',
            requestResourceData: updateData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  /**
   * Grava o projeto no Firestore.
   *
   * `aguardarGravacao` existe por causa do robo guiado: o fluxo dele encadeia
   * "salvar -> criar formacao -> salvar de novo", e cada passo precisa ter certeza
   * de que o anterior chegou ao servidor. O submit normal do formulario continua
   * disparando a escrita sem esperar (comportamento historico desta tela), para
   * nao mudar o tempo de fechamento dos dialogos ja existentes.
   *
   * Retorna true se a gravacao foi aceita.
   */
  async function gravarProjeto(values: FormValues, aguardarGravacao = false): Promise<boolean> {
    if (!user) {
      toast({ variant: 'destructive', title: 'Erro de autenticação' });
      return false;
    }
    setLoading(true);

    const selectedAdmin = admins.find(admin => admin.id === values.responsavelId);

    try {
      const cleanedData = buildProjetoPayload(values, selectedAdmin?.nome || '');

      if (isEditMode && projeto) {
        const projetoRef = doc(db, 'projetos', projeto.id);
        const escrita = updateDoc(projetoRef, cleanedData)
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: projetoRef.path,
              operation: 'update',
              requestResourceData: cleanedData,
            });
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
          });

        if (aguardarGravacao) {
          await escrita;
        } else {
          escrita.catch(() => { /* ja reportado via errorEmitter */ });
        }
        toast({ title: 'Sucesso!', description: 'Projeto atualizado com sucesso.' });
      } else {
        const newDocRef = doc(collection(db, 'projetos'));
        const escrita = setDoc(newDocRef, {
          ...cleanedData,
          id: newDocRef.id,
          dataCriacao: serverTimestamp(),
        })
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: newDocRef.path,
              operation: 'create',
              requestResourceData: { ...cleanedData, id: newDocRef.id, dataCriacao: 'serverTimestamp' },
            });
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
          });

        if (aguardarGravacao) {
          await escrita;
        } else {
          escrita.catch(() => { /* ja reportado via errorEmitter */ });
        }
        toast({ title: 'Sucesso!', description: 'Projeto criado com sucesso.' });
      }

      sincronizarFormacoesVinculadas(values);

      // Zera o isDirty sem recarregar do banco: os valores em tela SAO os gravados.
      // Sem isto, o robo nao consegue distinguir "ja salvei" de "falta salvar".
      form.reset(values, { keepValues: true });

      onSuccess();
      return true;
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao salvar o projeto. Verifique os campos e tente novamente.',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    await gravarProjeto(values, false);
  }

  /** Submit programatico do robo: valida, grava e so resolve depois de confirmar. */
  const submitAndWait = useCallback(async (): Promise<boolean> => {
    let gravou = false;
    await form.handleSubmit(
      async (values) => { gravou = await gravarProjeto(values, true); },
      (errors) => { gravou = false; onInvalid?.(errors as Record<string, unknown>); }
    )();
    return gravou;
  }, [form, onInvalid, admins, projeto, isEditMode, user]);
  
  const handleCreateFormation = async (title: string, dataInicio: Date | null | undefined, dataFim: Date | null | undefined, details: string | undefined, formadorNomes: string[]) => {
    const { municipio, uf, responsavelId } = form.getValues();
    if (!municipio || !uf) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione um município e UF para o projeto primeiro.' });
      return null;
    }

    if (!projeto?.id) {
      toast({ variant: 'destructive', title: 'Ação necessária', description: 'Por favor, salve o projeto antes de criar formações vinculadas.' });
      return null;
    }

    setLoading(true);
    try {
      // Ids e nomes precisam descrever o mesmo conjunto: a ficha lê 'formadoresIds' e o
      // quadro lê 'formadoresNomes'. Preencher um e deixar o outro vazio gera ficha em branco.
      let finalFormadoresNomes: string[] = formadorNomes || [];
      let finalFormadoresIds: string[] = [];
      if (finalFormadoresNomes.length > 0) {
        finalFormadoresIds = allFormadores.filter(f => finalFormadoresNomes.includes(f.nomeCompleto)).map(f => f.id);
      } else {
        finalFormadoresIds = form.getValues('formadoresIds') || [];
        finalFormadoresNomes = allFormadores.filter(f => finalFormadoresIds.includes(f.id)).map(f => f.nomeCompleto);
      }


      const newFormationData: Omit<Formacao, 'id'> = {
        titulo: title,
        descricao: details || `Atividade referente ao projeto de implantação em ${municipio}.`,
        status: 'preparacao',
        municipio,
        uf,
        codigo: generateFormationCode(municipio),
        formadoresIds: finalFormadoresIds,
        formadoresNomes: finalFormadoresNomes,
        materiaisIds: [],
        avaliacoesAbertas: false,
        dataInicio: dataInicio ? Timestamp.fromDate(dataInicio) : null,
        dataFim: dataFim ? Timestamp.fromDate(dataFim) : null,
        projetoId: projeto.id, // VINCULAÇÃO COM O PROJETO MÃE
      };
      
      const docRef = doc(collection(db, "formacoes"));
      await setDoc(docRef, {
          ...newFormationData,
          dataCriacao: serverTimestamp(),
      });

      // --- CRIAÇÃO AUTOMÁTICA DE DEMANDA ---
      const selectedAdmin = admins.find(a => a.id === responsavelId);
      if (responsavelId && selectedAdmin) {
          const demandDeadline = dataInicio ? subDays(dataInicio, 7) : null;
          const demandRef = doc(collection(db, 'demandas'));
          const newDemand = {
              municipio,
              uf,
              demanda: `Acompanhar o desenvolvimento para ${title}`,
              status: 'Pendente',
              responsavelId,
              responsavelNome: selectedAdmin.nome,
              prioridade: 'Normal',
              prazo: demandDeadline ? Timestamp.fromDate(demandDeadline) : null,
              dataCriacao: serverTimestamp(),
              dataAtualizacao: serverTimestamp(),
              origem: 'automatica',
              projetoOrigemId: projeto.id,
              projetoOrigemNome: municipio,
              formacaoOrigemId: docRef.id,
              historico: [{
                  id: docRef.id + '_auto_hist',
                  data: Timestamp.now(),
                  autorId: 'system',
                  autorNome: 'Sistema',
                  tipo: 'criacao',
                  texto: `Demanda criada automaticamente para acompanhar o desenvolvimento da formação "${title}".`
              }]
          };
          
          await setDoc(demandRef, newDemand);
      }
      // -------------------------------------
      
      toast({ title: 'Sucesso!', description: `Formação "${title}" criada e demanda vinculada ao responsável.` });
      return docRef.id;

    } catch (error) {
      console.error("Error creating formation:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar a formação.' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateImplantacaoFormation = async (index: number) => {
    const implantacoes = form.getValues('implantacoes') || [];
    const imp = implantacoes[index];
    if (!imp) return;

    const { municipio } = form.getValues();
    const titulo = imp.titulo || `Implantação ${index + 1}`;
    const title = `${titulo}: ${municipio}`;
    
    // Se não houver formadores selecionados especificamente para implantação, usa os do projeto
    let formadoresNames = imp.formadores && imp.formadores.length > 0 
        ? imp.formadores 
        : allFormadores.filter(f => form.getValues('formadoresIds')?.includes(f.id)).map(f => f.nomeCompleto);

    const newFormationId = await handleCreateFormation(title, imp.dataInicio, imp.dataFim, imp.detalhes || 'Formação referente à implantação do sistema.', formadoresNames);

    if (newFormationId) {
        form.setValue(`implantacoes.${index}.formacaoId`, newFormationId);
    }
  }

  const handleUpdateImplantacaoFormation = async (index: number) => {
    setLoading(true);
    try {
        const implantacoes = form.getValues('implantacoes') || [];
        const imp = implantacoes[index];

        if (!imp?.formacaoId) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma formação de implantação associada.' });
            return;
        }
        
        const formadoresNomes = imp.formadores || [];
        const formadoresIds = allFormadores.filter(f => formadoresNomes.includes(f.nomeCompleto)).map(f => f.id);

        const updateData = {
            dataInicio: timestampOrNull(imp.dataInicio),
            dataFim: timestampOrNull(imp.dataFim),
            formadoresIds: formadoresIds,
            formadoresNomes: formadoresNomes,
            descricao: imp.detalhes || 'Formação referente à implantação do sistema.',
        };

        const formacaoRef = doc(db, 'formacoes', imp.formacaoId);
        updateDoc(formacaoRef, updateData)
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: formacaoRef.path,
              operation: 'update',
              requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
          });

        toast({ title: 'Sucesso!', description: 'Formação de implantação atualizada.' });
    } catch (error) {
        console.error("Error updating formation:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar a formação.' });
    } finally {
        setLoading(false);
    }
  };

  const handleCreateDevolutivaFormation = async (devolutivaNumber: 1 | 2 | 3 | 4) => {
    const { municipio, devolutivas } = form.getValues();
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
        updateDoc(formacaoRef, updateData)
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: formacaoRef.path,
              operation: 'update',
              requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
          });

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
      return id ? allAnexos.filter(anexo => anexo.id === id) : [];
    }
    const anexoPath = etapa === 'implantacao' ? 'implantacaoAnexosIds' 
      : etapa.startsWith('implantacoes.') ? `${etapa}.anexosIds`
      : `${etapa}.anexosIds`;
    const ids = form.getValues(anexoPath as any) || [];
    return allAnexos.filter(anexo => ids.includes(anexo.id));
  };
  
  const handleClearImplantacao = (index: number) => {
    const implantacoes = form.getValues('implantacoes') || [];
    const imp = implantacoes[index];
    const titulo = imp?.titulo || `Implantação ${index + 1}`;
    if (!window.confirm(`Tem certeza que deseja limpar todos os dados de "${titulo}"?`)) return;
    form.setValue(`implantacoes.${index}.dataInicio`, null);
    form.setValue(`implantacoes.${index}.dataFim`, null);
    form.setValue(`implantacoes.${index}.detalhes`, '');
    form.setValue(`implantacoes.${index}.formadores`, []);
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

  /**
   * Superficie imperativa para o robo guiado (/agente).
   *
   * Expoe SO acoes. Leitura de valores NAO passa por aqui: um ref nao dispara
   * re-render, entao o robo leria estado congelado. Quem precisa ler assina o
   * formulario via useWatch/useFormContext.
   */
  useImperativeHandle(
    ref,
    () => ({
      submit: submitAndWait,
      criarFormacaoDevolutiva: handleCreateDevolutivaFormation,
      atualizarFormacaoDevolutiva: handleUpdateFormation,
      criarFormacaoImplantacao: handleCreateImplantacaoFormation,
      atualizarFormacaoImplantacao: handleUpdateImplantacaoFormation,
      irParaSecao: (secao: SecaoProjeto) => {
        document.getElementById('sec-' + secao)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      formadores: allFormadores,
      admins,
    }),
    [submitAndWait, allFormadores, admins]
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => onInvalid?.(errors as Record<string, unknown>))} className="space-y-6">
        
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
        
        <Card id="sec-dados-gerais" className="shadow-md shadow-primary/5 scroll-mt-20">
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
                            {municipios.length > 0 ? (
                                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedUf || loadingMunicipios}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={loadingMunicipios ? "Carregando..." : "Selecione o município"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {municipios.map(m => <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <FormControl>
                                    <Input placeholder={loadingMunicipios ? "Carregando..." : "Digite o nome do município"} {...field} disabled={!selectedUf || loadingMunicipios} />
                                </FormControl>
                            )}
                            <FormMessage />
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
                    <FormField control={form.control} name="responsavelId" render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                            <FormLabel className="flex items-center gap-2">
                                <UserCog className="h-4 w-4 text-primary"/> Responsável Geral pelo Projeto
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a responsável (Irene, Ana ou Amaranta)" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {admins.map(admin => (
                                        <SelectItem key={admin.id} value={admin.id}>{admin.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormDescription>Esta pessoa será a responsável principal pela gestão das demandas deste projeto.</FormDescription>
                            <FormMessage />
                        </FormItem>
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

        <Card id="sec-implantacoes" className="shadow-md shadow-primary/5 scroll-mt-20">
             <CardHeader>
                <CardTitle>Implementação e Métricas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                 </div>

                 {/* Implantações Dinâmicas */}
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <FormLabel className="text-base font-semibold">Implantações</FormLabel>
                        <Button type="button" size="sm" variant="outline" onClick={() => appendImplantacao({ titulo: '', dataInicio: null, dataFim: null, formadores: [], detalhes: '', formacaoId: '', anexosIds: [] })}>
                            <PlusCircle className='mr-2 h-4 w-4'/> Adicionar Implantação
                        </Button>
                    </div>
                    {implantacaoFields.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                            Nenhuma implantação adicionada. Clique em &quot;Adicionar Implantação&quot; para começar.
                        </p>
                    )}
                    {implantacaoFields.map((impField, index) => {
                        const etapaKey = `implantacoes.${index}` as const;
                        const impData = form.watch(`implantacoes.${index}`);
                        const selectedImpFormadoresForCard = allFormadores.filter(f => impData?.formadores?.includes(f.nomeCompleto));
                        return (
                            <Card key={impField.id} className="p-4 bg-muted/40 shadow-sm shadow-primary/5">
                                <div className='flex justify-between items-center mb-4'>
                                    <h4 className='font-semibold text-base'>Implantação {index + 1}</h4>
                                    <div className="flex items-center gap-1">
                                        <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10 h-7" onClick={() => handleClearImplantacao(index)}>
                                            <Eraser className="mr-1 h-3 w-3" /> Limpar
                                        </Button>
                                        <Button type="button" size="icon" variant="ghost" className='h-7 w-7 text-destructive' onClick={() => {
                                            if (window.confirm(`Tem certeza que deseja remover esta implantação?`)) removeImplantacao(index);
                                        }}>
                                            <Trash2 className='h-4 w-4'/>
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <FormField control={form.control} name={`implantacoes.${index}.titulo`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Título / Identificação</FormLabel>
                                            <FormControl><Input placeholder="Ex: Implantação Turma A, Implantação 2º Semestre..." {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <FormField control={form.control} name={`implantacoes.${index}.dataInicio`} render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Data de Início</FormLabel>
                                                    <div className="flex gap-2 items-center">
                                                        <Popover><PopoverTrigger asChild><FormControl>
                                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                        </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={ptBR}/>
                                                        </PopoverContent></Popover>
                                                        <Button type="button" size="icon" variant="outline" onClick={() => handleAnexoTrigger(etapaKey)} disabled={uploading === etapaKey || !isEditMode}>
                                                            {uploading === etapaKey ? <Loader2 className="h-4 w-4 animate-spin"/> : <UploadCloud className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
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
                                        <FormField control={form.control} name={`implantacoes.${index}.dataFim`} render={({ field }) => (
                                            <FormItem className="flex flex-col"><FormLabel>Data Fim</FormLabel>
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
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name={`implantacoes.${index}.formadores`}
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Formadores</FormLabel>
                                                <Popover open={impFormadorPopoverOpen[index] || false} onOpenChange={(open) => setImpFormadorPopoverOpen(prev => ({ ...prev, [index]: open }))}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                                            <span className="truncate">
                                                                {selectedImpFormadoresForCard.length > 0 ? `${selectedImpFormadoresForCard.length} selecionado(s)` : "Selecione formadores..."}
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
                                                {selectedImpFormadoresForCard.length > 0 && (
                                                    <div className="pt-2 flex flex-wrap gap-1">
                                                        {selectedImpFormadoresForCard.map(formador => (
                                                        <Badge key={formador.id} variant="secondary">
                                                            {formador.nomeCompleto}
                                                            <button
                                                            type="button"
                                                            className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                            onClick={() => field.onChange(field.value?.filter(name => name !== formador.nomeCompleto))}
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={form.control} name={`implantacoes.${index}.detalhes`} render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Detalhes</FormLabel>
                                                <FormControl><Textarea placeholder="Descreva observações sobre a implantação..." {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                        <div className="space-y-2 pt-6">
                                            {impData?.formacaoId ? (
                                                <div className="text-sm text-green-600 flex flex-col gap-2">
                                                    <span className='flex items-center gap-2'>
                                                    <Check className="h-4 w-4" /> Formação vinculada.
                                                    </span>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm" asChild>
                                                            <Link href={`/quadro`} target="_blank">Ver no Quadro</Link>
                                                        </Button>
                                                        <Button type="button" size="sm" variant="secondary" onClick={() => handleUpdateImplantacaoFormation(index)}>
                                                            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
                                                        </Button>
                                                        <Button type="button" size="sm" variant="ghost" className="text-xs h-auto p-1 text-destructive" onClick={() => form.setValue(`implantacoes.${index}.formacaoId`, undefined)}>
                                                            Desvincular
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button type="button" size="sm" variant="secondary" onClick={() => handleCreateImplantacaoFormation(index)} disabled={!impData?.dataInicio || !isEditMode}>
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Criar Formação
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="qtdAlunos" render={({ field }) => (
                        <FormItem><FormLabel>Quantidade de Alunos</FormLabel><FormControl><Input type="number" min="0" placeholder="Ex: 500" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="qtdProfessores" render={({ field }) => (
                        <FormItem><FormLabel>Quantidade de Professores</FormLabel><FormControl><Input type="number" min="0" placeholder="Ex: 50" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="formacoesPendentes" render={({ field }) => (
                        <FormItem><FormLabel>Formações Pendentes</FormLabel><FormControl><Input type="number" min="0" placeholder="Ex: 2" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField
                        control={form.control}
                        name="formadoresIds"
                        render={({ field }) => (
                            <FormItem className="flex flex-col sm:col-span-2">
                                <FormLabel>Formadores Responsáveis pelo Projeto</FormLabel>
                                <Popover>
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
        
        <Card id="sec-reunioes" className="shadow-md shadow-primary/5 scroll-mt-20">
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

        <Card id="sec-eventos-adicionais" className="shadow-md shadow-primary/5 scroll-mt-20">
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

        <Card id="sec-avaliacoes" className="shadow-md shadow-primary/5 scroll-mt-20">
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
                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
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
                                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
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

        <Card id="sec-devolutivas" className="shadow-md shadow-primary/5 scroll-mt-20">
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
                                    <CardTitle className="text-base">Devolutiva {i}{ form.watch('municipio') ? `: ${form.watch('municipio')}` : '' }</CardTitle>
                                    <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10 h-7" onClick={() => handleClearDevolutiva(i)}>
                                            <Eraser className="mr-2 h-3 w-3" /> Limpar
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0 space-y-4">
                                    <FormField control={form.control} name={`${etapaKey}.dataInicio`} render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Data Início</FormLabel>
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
                                    <FormField control={form.control} name={`${etapaKey}.dataFim`} render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Data Fim</FormLabel>
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
                                        disabled={loading || !isEditMode}
                                        title={!isEditMode ? "Salve o projeto primeiro para criar a formação" : ""}
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
});

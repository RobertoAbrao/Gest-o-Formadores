'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Timestamp,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { differenceInCalendarDays, startOfToday } from 'date-fns';
import { Loader2, Mail, PlusCircle, RefreshCw, Sparkles } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import type { Demanda, HistoricoItem, StatusDemanda } from '@/lib/types';
import { resumirDemandasFlow } from '@/ai/flows/diario-flows';
import { FormDemanda } from '@/components/diario/form-diario';
import { BoardColumn } from '@/components/diario/board-column';
import { DemandaCard } from '@/components/diario/demanda-card';
import { DiarioToolbar } from '@/components/diario/diario-toolbar';
import {
  FILTROS_PADRAO,
  QUEUES,
  STATUS_OPTIONS,
  carregarFiltros,
  getSla,
  ordenarDemandas,
  salvarFiltros,
  type DiarioFiltros,
  type JanelaConcluidas,
  type QueueId,
} from '@/components/diario/diario-utils';

const VALIDADORES = ['beto-a-p@hotmail.com', 'irene@editoralt.com.br'];

const DESTINATARIOS_RELATORIO = [
  'alessandra@editoralt.com.br',
  'amaranta@editoralt.com.br',
  'assessoria@editoralt.com.br',
  'irene@editoralt.com.br',
  'kellem@editoralt.com.br',
];

/** Gmail rejeita URLs muito longas; o corpo é cortado antes disso. */
const LIMITE_CORPO_EMAIL = 1600;

const JANELAS: { value: JanelaConcluidas; label: string }[] = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: 'todas', label: 'Tudo' },
];

export default function DiarioPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const [filtros, setFiltros] = useState<DiarioFiltros>(FILTROS_PADRAO);
  const filtrosCarregados = useRef(false);

  const [demandaSelecionada, setDemandaSelecionada] = useState<Demanda | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [demandaParaExcluir, setDemandaParaExcluir] = useState<Demanda | null>(null);

  const [emMovimento, setEmMovimento] = useState<Set<string>>(new Set());
  const [arrastando, setArrastando] = useState<Demanda | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<StatusDemanda | null>(null);

  const [isResumoOpen, setIsResumoOpen] = useState(false);
  const [resumoIA, setResumoIA] = useState<string | null>(null);
  const [gerandoResumo, setGerandoResumo] = useState(false);

  const canValidate = useMemo(
    () => !!user?.email && VALIDADORES.includes(user.email),
    [user?.email],
  );
  const canDelete = user?.perfil === 'administrador';

  /* ----------------------------------------------------------------------- */
  /* Filtros persistidos                                                     */
  /* ----------------------------------------------------------------------- */

  useEffect(() => {
    setFiltros(carregarFiltros());
    filtrosCarregados.current = true;
  }, []);

  useEffect(() => {
    // Não sobrescreve o que está salvo com o padrão do primeiro render.
    if (!filtrosCarregados.current) return;
    salvarFiltros(filtros);
  }, [filtros]);

  const aplicarFiltros = useCallback((patch: Partial<DiarioFiltros>) => {
    setFiltros((atual) => ({ ...atual, ...patch }));
  }, []);

  const limparFiltros = useCallback(() => {
    setFiltros((atual) => ({
      ...FILTROS_PADRAO,
      ordenacao: atual.ordenacao,
      janelaConcluidas: atual.janelaConcluidas,
    }));
  }, []);

  /* ----------------------------------------------------------------------- */
  /* Dados                                                                   */
  /* ----------------------------------------------------------------------- */

  const buscarDados = useCallback(
    async (silencioso = false) => {
      if (silencioso) setAtualizando(true);
      else setLoading(true);
      try {
        const [demandasSnap, adminsSnap] = await Promise.all([
          getDocs(query(collection(db, 'demandas'), orderBy('dataCriacao', 'desc'))),
          getDocs(query(collection(db, 'usuarios'), where('perfil', '==', 'administrador'))),
        ]);

        setDemandas(demandasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Demanda));
        setResponsaveis(
          adminsSnap.docs.map((d) => ({ id: d.id, nome: (d.data().nome as string) ?? 'Sem nome' })),
        );
      } catch (error) {
        console.error('Erro ao carregar o diário:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar',
          description: 'Não foi possível carregar os dados do diário.',
        });
      } finally {
        setLoading(false);
        setAtualizando(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  /* ----------------------------------------------------------------------- */
  /* Recortes                                                                */
  /* ----------------------------------------------------------------------- */

  /** Tudo, menos a fila selecionada — é a base das contagens das filas. */
  const baseFiltrada = useMemo(() => {
    const busca = filtros.busca.trim().toLowerCase();
    return demandas.filter((d) => {
      if (busca) {
        const alvo =
          `${d.municipio} ${d.uf} ${d.demanda} ${d.responsavelNome}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      if (filtros.responsavelId !== 'all' && d.responsavelId !== filtros.responsavelId) return false;
      if (filtros.prioridade !== 'all' && (d.prioridade ?? 'Normal') !== filtros.prioridade)
        return false;
      if (filtros.escopo === 'minhas' && d.responsavelId !== user?.uid) return false;
      return true;
    });
  }, [demandas, filtros.busca, filtros.responsavelId, filtros.prioridade, filtros.escopo, user?.uid]);

  const queueCounts = useMemo(() => {
    const counts = {} as Record<QueueId, number>;
    for (const queue of QUEUES) {
      counts[queue.id] = baseFiltrada.filter(queue.match).length;
    }
    return counts;
  }, [baseFiltrada]);

  const demandasVisiveis = useMemo(() => {
    if (!filtros.queue) return baseFiltrada;
    const queue = QUEUES.find((q) => q.id === filtros.queue);
    return queue ? baseFiltrada.filter(queue.match) : baseFiltrada;
  }, [baseFiltrada, filtros.queue]);

  const colunas = useMemo(() => {
    const porStatus = {} as Record<StatusDemanda, { visiveis: Demanda[]; total: number }>;
    const hoje = startOfToday();

    for (const status of STATUS_OPTIONS) {
      let lista = demandasVisiveis.filter((d) => d.status === status);
      const total = lista.length;

      // A coluna Concluída acumularia indefinidamente: recorta por período,
      // exceto quando uma fila já está restringindo o quadro.
      if (status === 'Concluída' && filtros.janelaConcluidas !== 'todas' && !filtros.queue) {
        const limite = Number(filtros.janelaConcluidas);
        lista = lista.filter((d) => {
          const referencia = d.dataAtualizacao?.toDate?.() ?? d.dataCriacao?.toDate?.();
          if (!referencia) return true;
          return differenceInCalendarDays(hoje, referencia) <= limite;
        });
      }

      porStatus[status] = { visiveis: ordenarDemandas(lista, filtros.ordenacao), total };
    }
    return porStatus;
  }, [demandasVisiveis, filtros.ordenacao, filtros.janelaConcluidas, filtros.queue]);

  const totalVisivel = useMemo(
    () => STATUS_OPTIONS.reduce((soma, s) => soma + colunas[s].visiveis.length, 0),
    [colunas],
  );

  /* ----------------------------------------------------------------------- */
  /* Mutações                                                                */
  /* ----------------------------------------------------------------------- */

  const marcarEmMovimento = (id: string, ativo: boolean) => {
    setEmMovimento((atual) => {
      const proximo = new Set(atual);
      if (ativo) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  };

  const novoHistorico = useCallback(
    (texto: string, tipo: HistoricoItem['tipo'] = 'alteracao') => ({
      id: doc(collection(db, 'demandas')).id,
      data: Timestamp.now(),
      autorId: user?.uid ?? '',
      autorNome: user?.nome ?? 'Usuário',
      tipo,
      texto,
    }),
    [user?.uid, user?.nome],
  );

  /**
   * Aplica a mudança na tela antes de confirmar no Firestore e desfaz se falhar —
   * é o que faz o arrastar parecer instantâneo.
   */
  const atualizarDemanda = useCallback(
    async (
      demanda: Demanda,
      mudancaLocal: Partial<Demanda>,
      payloadRemoto: Record<string, unknown>,
      mensagemErro: string,
    ) => {
      marcarEmMovimento(demanda.id, true);
      setDemandas((atual) =>
        atual.map((d) => (d.id === demanda.id ? { ...d, ...mudancaLocal } : d)),
      );

      try {
        await updateDoc(doc(db, 'demandas', demanda.id), {
          ...payloadRemoto,
          dataAtualizacao: serverTimestamp(),
        });
        return true;
      } catch (error) {
        console.error(mensagemErro, error);
        // Desfaz só esta demanda: outra mutação em voo não pode ser atropelada.
        setDemandas((atual) => atual.map((d) => (d.id === demanda.id ? demanda : d)));
        toast({ variant: 'destructive', title: 'Não foi possível salvar', description: mensagemErro });
        return false;
      } finally {
        marcarEmMovimento(demanda.id, false);
      }
    },
    [toast],
  );

  const moverStatus = useCallback(
    async (demanda: Demanda, status: StatusDemanda) => {
      if (demanda.status === status) return;

      const historico: HistoricoItem[] = [
        novoHistorico(`Status alterado de "${demanda.status}" para "${status}".`),
      ];
      const mudancaLocal: Partial<Demanda> = { status };
      const payload: Record<string, unknown> = {
        status,
        historico: arrayUnion(historico[0]),
      };

      // Reabrir uma demanda já validada invalida a validação anterior.
      if (status !== 'Concluída' && demanda.validado) {
        mudancaLocal.validado = false;
        payload.validado = false;
        historico.push(novoHistorico('Validação removida: a demanda foi reaberta.'));
        payload.historico = arrayUnion(...historico);
      }

      mudancaLocal.historico = [...(demanda.historico ?? []), ...historico];

      const ok = await atualizarDemanda(
        demanda,
        mudancaLocal,
        payload,
        'Erro ao mover a demanda de status.',
      );
      if (ok) toast({ title: 'Movida', description: `${demanda.municipio} → ${status}.` });
    },
    [atualizarDemanda, novoHistorico, toast],
  );

  const alternarPrioridade = useCallback(
    async (demanda: Demanda) => {
      const nova = demanda.prioridade === 'Urgente' ? 'Normal' : 'Urgente';
      const item = novoHistorico(`Prioridade alterada para "${nova}".`);
      await atualizarDemanda(
        demanda,
        { prioridade: nova, historico: [...(demanda.historico ?? []), item] },
        { prioridade: nova, historico: arrayUnion(item) },
        'Erro ao alterar a prioridade.',
      );
    },
    [atualizarDemanda, novoHistorico],
  );

  const validarDemanda = useCallback(
    async (demanda: Demanda) => {
      if (!canValidate) {
        toast({ variant: 'destructive', title: 'Acesso negado', description: 'Você não tem permissão para validar demandas.' });
        return;
      }
      const item = novoHistorico('Demanda validada.');
      const ok = await atualizarDemanda(
        demanda,
        { validado: true, historico: [...(demanda.historico ?? []), item] },
        { validado: true, historico: arrayUnion(item) },
        'Erro ao validar a demanda.',
      );
      if (ok) toast({ title: 'Validada', description: `${demanda.municipio} foi validada.` });
    },
    [atualizarDemanda, canValidate, novoHistorico, toast],
  );

  const excluirDemanda = useCallback(async () => {
    if (!demandaParaExcluir) return;
    const alvo = demandaParaExcluir;
    setDemandaParaExcluir(null);
    setDemandas((atual) => atual.filter((d) => d.id !== alvo.id));
    try {
      await deleteDoc(doc(db, 'demandas', alvo.id));
      toast({ title: 'Excluída', description: 'A demanda foi removida.' });
    } catch (error) {
      console.error('Erro ao excluir demanda:', error);
      // Recarrega em vez de reinserir na mão, para não perder a posição na lista.
      buscarDados(true);
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'A demanda foi mantida.' });
    }
  }, [buscarDados, demandaParaExcluir, toast]);

  /* ----------------------------------------------------------------------- */
  /* Arrastar e soltar                                                       */
  /* ----------------------------------------------------------------------- */

  const soltarNaColuna = useCallback(
    (status: StatusDemanda) => {
      const demanda = arrastando;
      setArrastando(null);
      setColunaAlvo(null);
      if (demanda) moverStatus(demanda, status);
    },
    [arrastando, moverStatus],
  );

  /* ----------------------------------------------------------------------- */
  /* Ações do cabeçalho                                                      */
  /* ----------------------------------------------------------------------- */

  const abrirDemanda = useCallback((demanda: Demanda | null) => {
    setDemandaSelecionada(demanda);
    setIsFormOpen(true);
  }, []);

  const aoSalvarFormulario = useCallback(() => {
    setIsFormOpen(false);
    setDemandaSelecionada(null);
    buscarDados(true);
  }, [buscarDados]);

  const emailHref = useMemo(() => {
    const abertas = demandasVisiveis
      .filter((d) => d.status !== 'Concluída' && !d.validado)
      .sort((a, b) => (a.prazo?.toMillis() ?? Infinity) - (b.prazo?.toMillis() ?? Infinity));

    let corpo = 'Olá equipe,\n\nSegue a lista de demandas abertas do Diário de Bordo:\n\n';
    let incluidas = 0;

    for (const d of abertas) {
      const sla = getSla(d);
      const linha =
        `• ${d.municipio}/${d.uf} — ${d.demanda}\n` +
        `  Status: ${d.status} | Prioridade: ${d.prioridade ?? 'Normal'} | ` +
        `Responsável: ${d.responsavelNome} | Prazo: ${sla.label}\n\n`;

      if (corpo.length + linha.length > LIMITE_CORPO_EMAIL) break;
      corpo += linha;
      incluidas++;
    }

    if (incluidas < abertas.length) {
      corpo += `... e mais ${abertas.length - incluidas} demanda(s). Veja o quadro completo no portal.\n\n`;
    }
    if (abertas.length === 0) {
      corpo += 'Nenhuma demanda aberta com os filtros atuais.\n\n';
    }
    corpo += 'Atenciosamente,\nPortal de Gestão Pedagógica';

    const params = new URLSearchParams({
      to: DESTINATARIOS_RELATORIO.join(','),
      su: 'Relatório de Demandas — Diário de Bordo',
      body: corpo,
    });
    return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
  }, [demandasVisiveis]);

  const gerarResumo = useCallback(async () => {
    if (demandasVisiveis.length === 0) {
      toast({ title: 'Sem dados', description: 'Não há demandas visíveis para resumir.' });
      return;
    }

    setGerandoResumo(true);
    setResumoIA(null);
    setIsResumoOpen(true);
    try {
      // Server Actions não aceitam Timestamp do Firestore: tudo vira string ISO.
      const paraISO = (v: unknown) =>
        v && typeof (v as Timestamp).toDate === 'function'
          ? (v as Timestamp).toDate().toISOString()
          : null;

      const payload = demandasVisiveis.map((d) => ({
        ...d,
        dataCriacao: paraISO(d.dataCriacao),
        dataAtualizacao: paraISO(d.dataAtualizacao),
        prazo: paraISO(d.prazo),
        historico: (d.historico ?? []).map((h) => ({ ...h, data: paraISO(h.data) })),
      }));

      setResumoIA(await resumirDemandasFlow({ demandas: payload }));
    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na IA',
        description: 'Não foi possível gerar o resumo agora.',
      });
      setIsResumoOpen(false);
    } finally {
      setGerandoResumo(false);
    }
  }, [demandasVisiveis, toast]);

  /* ----------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ----------------------------------------------------------------------- */

  const filaAtiva = QUEUES.find((q) => q.id === filtros.queue);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4 py-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">Diário de Bordo</h1>
            <p className="text-sm text-muted-foreground">
              {filaAtiva
                ? `Filtrando: ${filaAtiva.label.toLowerCase()} — ${filaAtiva.descricao.toLowerCase()}.`
                : 'Acompanhe as demandas dos municípios do registro à validação.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => buscarDados(true)}
                  disabled={atualizando}
                >
                  <RefreshCw className={atualizando ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                  <span className="sr-only">Atualizar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Recarregar as demandas</TooltipContent>
            </Tooltip>

            <Button variant="outline" onClick={gerarResumo} className="gap-2">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Resumo IA</span>
            </Button>

            <Button asChild variant="outline" className="gap-2">
              <a href={emailHref} target="_blank" rel="noopener noreferrer">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Enviar por e-mail</span>
              </a>
            </Button>

            <Button onClick={() => abrirDemanda(null)} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Nova demanda
            </Button>
          </div>
        </header>

        {loading ? (
          <BoardSkeleton />
        ) : (
          <>
            <DiarioToolbar
              filtros={filtros}
              onChange={aplicarFiltros}
              onLimpar={limparFiltros}
              queueCounts={queueCounts}
              responsaveis={responsaveis}
              totalVisivel={totalVisivel}
              totalGeral={demandas.length}
            />

            <div
              onDragEnd={() => {
                setArrastando(null);
                setColunaAlvo(null);
              }}
              className="flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-4"
            >
              {STATUS_OPTIONS.map((status) => (
                <BoardColumn
                  key={status}
                  status={status}
                  demandas={colunas[status].visiveis}
                  totalSemRecorte={colunas[status].total}
                  isDropTarget={
                    colunaAlvo === status && !!arrastando && arrastando.status !== status
                  }
                  onDragEnter={setColunaAlvo}
                  onDragLeave={() => setColunaAlvo(null)}
                  onDropDemanda={soltarNaColuna}
                  emptyLabel={
                    filtros.queue
                      ? 'Nenhuma demanda desta fila neste status.'
                      : 'Nenhuma demanda aqui.'
                  }
                  headerExtra={
                    status === 'Concluída' ? (
                      <Select
                        value={filtros.janelaConcluidas}
                        onValueChange={(v) =>
                          aplicarFiltros({ janelaConcluidas: v as JanelaConcluidas })
                        }
                      >
                        <SelectTrigger className="h-7 w-[92px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {JANELAS.map((j) => (
                            <SelectItem key={j.value} value={j.value} className="text-xs">
                              {j.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : undefined
                  }
                  renderCard={(demanda) => (
                    <DemandaCard
                      key={demanda.id}
                      demanda={demanda}
                      onOpen={abrirDemanda}
                      onMoverStatus={moverStatus}
                      onAlternarPrioridade={alternarPrioridade}
                      onValidar={validarDemanda}
                      onExcluir={setDemandaParaExcluir}
                      canValidate={canValidate}
                      canDelete={!!canDelete}
                      isBusy={emMovimento.has(demanda.id)}
                      isDragging={arrastando?.id === demanda.id}
                      onDragStart={setArrastando}
                      onDragEnd={() => {
                        setArrastando(null);
                        setColunaAlvo(null);
                      }}
                    />
                  )}
                />
              ))}
            </div>
          </>
        )}

        {/* Detalhe da demanda */}
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setDemandaSelecionada(null);
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {demandaSelecionada ? 'Editar demanda' : 'Nova demanda'}
              </DialogTitle>
              <DialogDescription>
                {demandaSelecionada
                  ? 'Altere os dados, comente e acompanhe o histórico.'
                  : 'Preencha os dados para registrar uma nova demanda.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[75vh]">
              <div className="p-4">
                <FormDemanda demanda={demandaSelecionada} onSuccess={aoSalvarFormulario} />
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Confirmação de exclusão */}
        <AlertDialog
          open={!!demandaParaExcluir}
          onOpenChange={(open) => !open && setDemandaParaExcluir(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir esta demanda?</AlertDialogTitle>
              <AlertDialogDescription>
                {demandaParaExcluir
                  ? `"${demandaParaExcluir.demanda.slice(0, 120)}" (${demandaParaExcluir.municipio}/${demandaParaExcluir.uf}) será removida junto com todo o histórico. Esta ação não pode ser desfeita.`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={excluirDemanda}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sim, excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Resumo por IA */}
        <Dialog open={isResumoOpen} onOpenChange={setIsResumoOpen}>
          <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Resumo da equipe
              </DialogTitle>
              <DialogDescription>
                Análise das {demandasVisiveis.length} demandas visíveis nos filtros atuais.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="mt-2 max-h-[55vh] rounded-md border bg-muted/30 p-4">
              {gerandoResumo ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="animate-pulse text-sm text-muted-foreground">
                    Analisando as demandas...
                  </p>
                </div>
              ) : resumoIA ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{resumoIA}</div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum resumo disponível.
                </p>
              )}
            </ScrollArea>

            <div className="mt-3 flex justify-end gap-2">
              {resumoIA && (
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(resumoIA);
                    toast({ title: 'Copiado', description: 'O resumo foi para a área de transferência.' });
                  }}
                >
                  Copiar
                </Button>
              )}
              <Button onClick={() => setIsResumoOpen(false)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[52px] rounded-lg" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, coluna) => (
          <div key={coluna} className="space-y-2 rounded-lg border bg-muted/40 p-2">
            <Skeleton className="h-8" />
            {Array.from({ length: 3 }).map((_, card) => (
              <Skeleton key={card} className="h-[124px] rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

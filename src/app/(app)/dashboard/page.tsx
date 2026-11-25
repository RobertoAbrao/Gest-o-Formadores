'use client';

/**
 * Dashboard do Administrador — "Precisa de você" (redesenho de 25/11/2026).
 *
 * A primeira tela do administrador: o que está atrasado, o que é hoje e o que vem nos
 * próximos 7 dias, com filas clicáveis no topo. A REGRA (o que entra em cada coluna,
 * com que texto) mora em src/lib/dashboard/agenda.ts, com teste. Esta página só lê o
 * banco, desenha e grava as ações.
 *
 * O QUE NÃO PODE VOLTAR (passo a passo em REGRESSOES.md, seção Dashboard):
 *  - Atualização ao vivo NUNCA tira a página da tela. A versão antiga relia tudo a cada
 *    mudança no banco e, enquanto relia, trocava a página inteira por um spinner: o
 *    detalhe da formação aberto fechava e o texto digitado se perdia — bastava marcar
 *    um item do checklist. Aqui os dados chegam pelas assinaturas e a tela é derivada
 *    com useMemo; o esqueleto só aparece antes da primeira entrega.
 *  - Os diálogos ficam montados fora de qualquer condição de carregamento.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, doc, query, updateDoc, where } from 'firebase/firestore';
import { AlertTriangle, Check, ChevronRight, Plus, X } from 'lucide-react';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ToastAction } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AgendaDoMes } from '@/components/dashboard/agenda-do-mes';
import { ColunasAgenda } from '@/components/dashboard/colunas-agenda';
import { FaixaFilas, type FilaDaFaixa } from '@/components/dashboard/faixa-filas';
import { FormLembrete } from '@/components/dashboard/form-lembrete';
import { ItemDaAgenda, type AcoesDoItem } from '@/components/dashboard/item-agenda';
import { FormDemanda } from '@/components/diario/form-diario';
import { DetalhesFormacao } from '@/components/formacoes/detalhes-formacao';
import { tituloDaFormacao } from '@/components/quadro/quadro-modelo';
import { useAuth } from '@/hooks/use-auth';
import { useColecaoTempoReal } from '@/hooks/use-colecao-tempo-real';
import useDynamicFavicon from '@/hooks/use-dynamic-favicon';
import { useHoje } from '@/hooks/use-hoje';
import { useToast } from '@/hooks/use-toast';
import { criarLembrete, marcarLembrete, mudarStatusDemanda } from '@/lib/dashboard/acoes';
import { agruparAgenda, diaDaSemana, itensDeOntem, montarAgenda, type ItemAgenda } from '@/lib/dashboard/agenda';
import {
  contarFilasDeDemanda,
  contarFilasDeFormacao,
  FILAS_DE_DEMANDA,
  FILAS_DE_FORMACAO,
  type FilaDeDemandaId,
} from '@/lib/dashboard/filas';
import { db } from '@/lib/firebase';
import { changeFormacaoStatus } from '@/lib/formacao-actions';
import type { Demanda, Formacao, Lembrete, ProjetoImplatancao } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  // As consultas exigem perfil de administrador nas regras do Firestore: o painel (e as
  // assinaturas) só monta depois que o perfil é conhecido.
  if (!user || user.perfil !== 'administrador') return <EsqueletoDaPagina />;
  return <PainelDoAdministrador />;
}

function PainelDoAdministrador() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const hoje = useHoje();
  const { setNotificationFavicon, clearNotificationFavicon } = useDynamicFavicon();
  const [tentativa, setTentativa] = useState(0);

  // ------------------------------------------------------------------ dados

  // Quatro assinaturas ao vivo, já filtradas no servidor. Uma mudança no banco chega
  // como documento novo e a tela recalcula (useMemo) — sem reler tudo, sem spinner,
  // sem uma leitura velha sobrescrever a nova. `tentativa` refaz as assinaturas.
  const formacoes = useColecaoTempoReal<Formacao>(
    () => query(collection(db, 'formacoes'), where('status', '!=', 'arquivado')),
    [tentativa]
  );
  const demandas = useColecaoTempoReal<Demanda>(
    () => query(collection(db, 'demandas'), where('status', '!=', 'Concluída')),
    [tentativa]
  );
  const projetos = useColecaoTempoReal<ProjetoImplatancao>(() => collection(db, 'projetos'), [tentativa]);
  const lembretes = useColecaoTempoReal<Lembrete>(
    () => query(collection(db, 'lembretes'), where('concluido', '==', false)),
    [tentativa]
  );

  const carregando = formacoes.carregando || demandas.carregando || projetos.carregando || lembretes.carregando;
  const falhas = [
    formacoes.erro && 'as formações',
    demandas.erro && 'as demandas',
    projetos.erro && 'os projetos',
    lembretes.erro && 'os lembretes',
  ].filter(Boolean) as string[];

  // Formações concluídas nesta visita: ficam à vista com "Arquivar" em vez de sumir no clique.
  const [recemConcluidas, setRecemConcluidas] = useState<Set<string>>(() => new Set());

  const itens = useMemo(
    () =>
      montarAgenda(
        { formacoes: formacoes.dados, demandas: demandas.dados, projetos: projetos.dados, lembretes: lembretes.dados },
        hoje,
        { recemConcluidas }
      ),
    [formacoes.dados, demandas.dados, projetos.dados, lembretes.dados, hoje, recemConcluidas]
  );

  const [filaAtiva, setFilaAtiva] = useState<FilaDeDemandaId | null>(null);
  const filtro = FILAS_DE_DEMANDA.find((f) => f.id === filaAtiva) ?? null;

  const todos = useMemo(() => agruparAgenda(itens), [itens]);
  const grupos = useMemo(() => (filtro ? agruparAgenda(itens.filter(filtro.combina)) : todos), [itens, filtro, todos]);
  const ontem = useMemo(() => itensDeOntem(itens, hoje), [itens, hoje]);
  const contagemFormacao = useMemo(() => contarFilasDeFormacao(formacoes.dados, hoje), [formacoes.dados, hoje]);
  const contagemDemanda = useMemo(() => contarFilasDeDemanda(itens), [itens]);

  const filas: FilaDaFaixa[] = [
    ...FILAS_DE_FORMACAO.map((f) => ({
      id: f.id,
      rotulo: f.rotulo,
      dica: f.dica,
      tom: f.tom,
      n: formacoes.erro ? null : contagemFormacao[f.id],
      href: `/quadro?fila=${f.id}`,
    })),
    ...FILAS_DE_DEMANDA.map((f, i) => ({
      id: f.id,
      rotulo: f.rotulo,
      dica: f.dica,
      tom: f.tom,
      n: demandas.erro ? null : contagemDemanda[f.id],
      grupo: i === 0 ? 'Demandas' : undefined,
    })),
  ];

  const pendentesHoje = todos.atrasado.length + todos.hoje.length;
  useEffect(() => {
    if (carregando) return;
    if (pendentesHoje > 0) setNotificationFavicon();
    else clearNotificationFavicon();
  }, [carregando, pendentesHoje, setNotificationFavicon, clearNotificationFavicon]);

  // ------------------------------------------------------------------ diálogos

  const [detalheId, setDetalheId] = useState<string | null>(null);
  // Cópia congelada ao abrir: um documento chegando ao vivo no meio da digitação apagaria o formulário.
  const [demandaAberta, setDemandaAberta] = useState<Demanda | null>(null);
  const [aConcluir, setAConcluir] = useState<Formacao | null>(null);
  const [lembreteAberto, setLembreteAberto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [semPrazoAberto, setSemPrazoAberto] = useState(false);
  const [ontemAberto, setOntemAberto] = useState(false);

  const formacaoPorId = useMemo(() => new Map(formacoes.dados.map((f) => [f.id, f])), [formacoes.dados]);
  const demandaPorId = useMemo(() => new Map(demandas.dados.map((d) => [d.id, d])), [demandas.dados]);

  // ------------------------------------------------------------------ ações

  const falhou = (titulo: string, error: unknown) => {
    console.error(titulo, error);
    toast({ variant: 'destructive', title: titulo, description: (error as Error)?.message || 'Tente de novo.' });
  };

  /** Concluir pede confirmação (não "Desfazer"): ele cria a demanda de agradecimento, e desfazer só o status a deixaria solta. */
  const concluirFormacao = async () => {
    const f = aConcluir;
    if (!f) return;
    setAConcluir(null);
    setOcupado(`formacao:${f.id}`);
    try {
      await changeFormacaoStatus(f, 'concluido', user);
      setRecemConcluidas((atual) => new Set(atual).add(f.id));
      toast({
        title: 'Formação concluída',
        description: `A demanda de agradecimento aparece aqui, com prazo para ${diaDaSemana(addDays(hoje, 2))}.`,
      });
    } catch (error) {
      falhou('Não foi possível concluir', error);
    } finally {
      setOcupado(null);
    }
  };

  const arquivarFormacao = async (f: Formacao, chave: string) => {
    setOcupado(chave);
    try {
      await changeFormacaoStatus(f, 'arquivado', user);
      toast({
        title: 'Formação arquivada',
        description: 'Ela continua em Arquivados.',
        action: (
          <ToastAction
            altText="Desfazer arquivamento"
            onClick={() =>
              updateDoc(doc(db, 'formacoes', f.id), { status: 'concluido' }).catch((e) => falhou('Não deu para desfazer', e))
            }
          >
            Desfazer
          </ToastAction>
        ),
      });
    } catch (error) {
      falhou('Não foi possível arquivar', error);
    } finally {
      setOcupado(null);
    }
  };

  const concluirDemanda = async (item: ItemAgenda) => {
    const d = item.demandaId ? demandaPorId.get(item.demandaId) : undefined;
    if (!d) return;
    setOcupado(item.chave);
    try {
      await mudarStatusDemanda(d, 'Concluída', user);
      toast({
        title: 'Demanda concluída',
        description: d.demanda,
        action: (
          <ToastAction
            altText="Desfazer conclusão"
            onClick={() =>
              mudarStatusDemanda({ ...d, status: 'Concluída' }, d.status, user).catch((e) => falhou('Não deu para desfazer', e))
            }
          >
            Desfazer
          </ToastAction>
        ),
      });
    } catch (error) {
      falhou('Não foi possível concluir a demanda', error);
    } finally {
      setOcupado(null);
    }
  };

  const concluirLembrete = async (item: ItemAgenda) => {
    const id = item.lembreteId;
    if (!id) return;
    setOcupado(item.chave);
    try {
      await marcarLembrete(id, true);
      toast({
        title: 'Lembrete concluído',
        description: item.titulo,
        action: (
          <ToastAction
            altText="Desfazer"
            onClick={() => marcarLembrete(id, false).catch((e) => falhou('Não deu para desfazer', e))}
          >
            Desfazer
          </ToastAction>
        ),
      });
    } catch (error) {
      falhou('Não foi possível concluir o lembrete', error);
    } finally {
      setOcupado(null);
    }
  };

  const salvarLembrete = async (titulo: string, data: Date) => {
    try {
      await criarLembrete(titulo, data, user);
      toast({ title: 'Lembrete criado' });
      return true;
    } catch (error) {
      falhou('Não foi possível criar o lembrete', error);
      return false;
    }
  };

  const acoes: AcoesDoItem = {
    ocupado,
    onAbrir: (item) => {
      if (item.tipo === 'demanda') {
        const d = item.demandaId ? demandaPorId.get(item.demandaId) : undefined;
        if (d) setDemandaAberta(d);
      } else if (item.formacaoId) {
        setDetalheId(item.formacaoId);
      } else if (item.projetoId) {
        router.push(`/projeto-relatorio/${item.projetoId}`);
      }
    },
    onConcluirFormacao: (item) => {
      const f = item.formacaoId ? formacaoPorId.get(item.formacaoId) : undefined;
      if (f) setAConcluir(f);
    },
    onArquivarFormacao: (item) => {
      const f = item.formacaoId ? formacaoPorId.get(item.formacaoId) : undefined;
      if (f) arquivarFormacao(f, item.chave);
    },
    onMarcarFeito: (item) => (item.tipo === 'demanda' ? concluirDemanda(item) : concluirLembrete(item)),
  };

  // ------------------------------------------------------------------ tela

  const dataPorExtenso = format(hoje, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const semPrazo = grupos['sem-prazo'];
  const nadaNasColunas = grupos.atrasado.length + grupos.hoje.length + grupos.proximos.length === 0;
  const tudoEmDia = !filtro && nadaNasColunas;
  const filtroSoSemPrazo = !!filtro && nadaNasColunas && grupos.adiante.length === 0;
  const listaDeItens = (lista: ItemAgenda[]) => (
    <ul>
      {lista.map((i) => (
        <ItemDaAgenda key={i.chave} item={i} acoes={acoes} />
      ))}
    </ul>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {dataPorExtenso.charAt(0).toUpperCase() + dataPorExtenso.slice(1)}
              {!carregando && (
                <>
                  {' · '}
                  <span className="font-semibold text-foreground">
                    {pendentesHoje === 0
                      ? 'nada pendente para hoje'
                      : `${pendentesHoje} ${pendentesHoje === 1 ? 'item precisa' : 'itens precisam'} de você hoje`}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" className="h-10" onClick={() => setLembreteAberto(true)} aria-label="Novo lembrete">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Lembrete</span>
            </Button>
            <AgendaDoMes itens={itens} hoje={hoje} />
          </div>
        </div>

        {falhas.length > 0 && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Não deu para carregar {juntar(falhas)} agora. O resto da tela está em dia.</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setTentativa((t) => t + 1)}>
              Tentar de novo
            </Button>
          </div>
        )}

        <FaixaFilas filas={filas} ativa={filaAtiva} carregando={carregando} onFiltrar={(id) => setFilaAtiva(id as FilaDeDemandaId | null)} />

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0 pb-2">
            <CardTitle className="text-lg">Precisa de você</CardTitle>
            {filtro && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-3 pr-1 text-sm font-semibold text-primary">
                Filtrando: {filtro.rotulo}
                <button type="button" aria-label="Limpar filtro" onClick={() => setFilaAtiva(null)} className="rounded-full p-0.5 hover:bg-primary/15">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </CardHeader>
          <CardContent className="pb-3">
            {carregando ? (
              <EsqueletoDasColunas />
            ) : tudoEmDia ? (
              <TudoEmDia proximo={todos.adiante[0]} />
            ) : filtroSoSemPrazo ? (
              semPrazo.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nada nesta fila.</p>
            ) : (
              <ColunasAgenda grupos={grupos} filtrando={!!filtro} acoes={acoes} />
            )}
          </CardContent>

          {!carregando && semPrazo.length > 0 && (
            <Faixa
              titulo={`Sem prazo · ${semPrazo.length} ${semPrazo.length === 1 ? 'demanda' : 'demandas'}`}
              sub="(precisam de uma data)"
              aberta={semPrazoAberto || filtro?.id === 'dem-sem-prazo'}
              onAlternar={() => setSemPrazoAberto((v) => !v)}
            >
              {listaDeItens(semPrazo)}
            </Faixa>
          )}
          {!carregando && !filtro && ontem.length > 0 && (
            <Faixa
              titulo={`Ontem · ${ontem.length} ${ontem.length === 1 ? 'evento' : 'eventos'}`}
              sub="(só para informação)"
              aberta={ontemAberto}
              onAlternar={() => setOntemAberto((v) => !v)}
            >
              {listaDeItens(ontem)}
            </Faixa>
          )}
        </Card>

        {/* ------------------------------------------------ diálogos: sempre montados, fora do carregamento */}

        <Dialog open={detalheId !== null} onOpenChange={(open) => !open && setDetalheId(null)}>
          {/* O DetalhesFormacao desenha o próprio cabeçalho e rola só o conteúdo da aba. */}
          <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
            {detalheId && <DetalhesFormacao formacaoId={detalheId} onClose={() => setDetalheId(null)} />}
          </DialogContent>
        </Dialog>

        <Dialog open={demandaAberta !== null} onOpenChange={(open) => !open && setDemandaAberta(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Demanda</DialogTitle>
              <DialogDescription>
                {demandaAberta ? [demandaAberta.municipio, demandaAberta.uf].filter(Boolean).join('/') : ''}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh]">
              <div className="p-4">
                {demandaAberta && <FormDemanda demanda={demandaAberta} onSuccess={() => setDemandaAberta(null)} />}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <AlertDialog open={aConcluir !== null} onOpenChange={(open) => !open && setAConcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Concluir esta formação?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    <strong className="text-foreground">{aConcluir ? tituloDaFormacao(aConcluir) : ''}</strong> sai de “Falta concluir”.
                  </p>
                  <p>
                    Concluir também cria a demanda <strong className="text-foreground">“Enviar e-mail de agradecimento e feedback”</strong>,
                    com prazo para {diaDaSemana(addDays(hoje, 2))} (se ela ainda não existir).
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={concluirFormacao}>Concluir formação</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <FormLembrete aberto={lembreteAberto} onAbertoChange={setLembreteAberto} onSalvar={salvarLembrete} />
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Peças pequenas da página
// ---------------------------------------------------------------------------

const juntar = (partes: string[]) =>
  partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;

/** Faixa recolhível abaixo das colunas ("Sem prazo", "Ontem"). */
function Faixa({
  titulo,
  sub,
  aberta,
  onAlternar,
  children,
}: {
  titulo: string;
  sub: string;
  aberta: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-t">
      <button
        type="button"
        aria-expanded={aberta}
        onClick={onAlternar}
        className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-sm font-semibold text-muted-foreground hover:text-foreground sm:px-6"
      >
        <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', aberta && 'rotate-90')} />
        {titulo} <span className="font-normal">{sub}</span>
      </button>
      {aberta && <div className="px-4 pb-3 sm:px-6">{children}</div>}
    </div>
  );
}

function TudoEmDia({ proximo }: { proximo?: ItemAgenda }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
        <Check className="h-5 w-5" />
      </div>
      <p className="text-base font-semibold text-foreground">Tudo em dia.</p>
      <p>Nenhum atraso e nada nos próximos 7 dias.</p>
      {proximo?.data && (
        <p className="mt-1">
          Próximo na agenda: {diaDaSemana(proximo.data)} — {proximo.titulo}
        </p>
      )}
    </div>
  );
}

function EsqueletoDasColunas() {
  return (
    <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2].map((c) => (
        <div key={c} className={cn('space-y-3', c > 0 && 'hidden md:block')}>
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2].map((l) => (
            <div key={l} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EsqueletoDaPagina() {
  return (
    <div className="flex flex-col gap-5 py-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <EsqueletoDasColunas />
        </CardContent>
      </Card>
    </div>
  );
}

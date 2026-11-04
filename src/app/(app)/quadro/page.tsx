'use client';

import { collection, deleteDoc, doc, getDoc, query, updateDoc, where } from 'firebase/firestore';
import { Loader2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { startOfToday } from 'date-fns';

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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToastAction } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DetalhesFormacao } from '@/components/formacoes/detalhes-formacao';
import { FormFormacao } from '@/components/formacoes/form-formacao';
import { FormProjeto } from '@/components/projetos/form-projeto';
import { GeradorQRCode } from '@/components/qrcode/GeradorQRCode';
import { BarraFilas } from '@/components/quadro/barra-filas';
import { CardFormacao } from '@/components/quadro/card-formacao';
import { ColunaQuadro } from '@/components/quadro/coluna-quadro';
import {
  FILAS,
  combinaBusca,
  ordenarColuna,
  tituloDaFormacao,
  type ContextoCard,
  type FilaId,
} from '@/components/quadro/quadro-modelo';
import { useAuth } from '@/hooks/use-auth';
import { useColecaoTempoReal } from '@/hooks/use-colecao-tempo-real';
import { useToast } from '@/hooks/use-toast';
import { alertasDaFormacao, pendenciasDoProjeto } from '@/lib/alertas';
import { FASES, FASES_DO_QUADRO, faseDaFormacao, type FaseFormacao } from '@/lib/fase-formacao';
import { db } from '@/lib/firebase';
import { changeFormacaoStatus } from '@/lib/formacao-actions';
import type { Formacao, ProjetoImplatancao } from '@/lib/types';
import { cn } from '@/lib/utils';

type FaseDoQuadro = (typeof FASES_DO_QUADRO)[number];

/**
 * Acompanhamento: as formações por fase (colunas) e o que precisa de ação (filas).
 *
 * A coluna vem de `faseDaFormacao` — a data move o card. Os únicos botões que
 * gravam status são Concluir e Arquivar: são decisões humanas, e o Concluir cria a
 * demanda de agradecimento no Diário de Bordo (`changeFormacaoStatus`).
 */
export default function QuadroPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Ao vivo: um usuário salva, os outros veem sem recarregar.
  const { dados: formacoesData, carregando } = useColecaoTempoReal<Formacao>(
    () => query(collection(db, 'formacoes'), where('status', '!=', 'arquivado')),
    []
  );
  // Projetos entram só para as etapas sem data: etapa sem data nunca vira formação.
  const { dados: projetosData } = useColecaoTempoReal<ProjetoImplatancao>(() => collection(db, 'projetos'), []);

  const [fila, setFila] = useState<FilaId | null>(null);
  const [busca, setBusca] = useState('');
  const [faseMovel, setFaseMovel] = useState<FaseDoQuadro | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  // Um estado por diálogo: antes os quatro dividiam um "selecionado" e se atropelavam.
  const [detalhe, setDetalhe] = useState<Formacao | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Formacao | null>(null);
  const [projetoEmEdicao, setProjetoEmEdicao] = useState<ProjetoImplatancao | null>(null);
  const [qrDe, setQrDe] = useState<Formacao | null>(null);
  const [excluir, setExcluir] = useState<Formacao | null>(null);
  const [formSujo, setFormSujo] = useState(false);
  const [descartar, setDescartar] = useState<'formacao' | 'projeto' | null>(null);

  // ------------------------------------------------------------------ dados

  const contextos = useMemo<ContextoCard[]>(() => {
    const hoje = startOfToday();
    return formacoesData
      .map((f) => ({ formacao: f, fase: faseDaFormacao(f, hoje), alertas: alertasDaFormacao(f, hoje) }))
      .filter((c) => c.fase !== 'arquivada');
  }, [formacoesData]);

  const pendencias = useMemo(() => projetosData.flatMap(pendenciasDoProjeto), [projetosData]);

  const daBusca = useMemo(() => contextos.filter((c) => combinaBusca(c.formacao, busca)), [contextos, busca]);

  // Contagem inclusiva sobre o que a busca deixa: o número da fila é o que aparece ao clicar.
  const contagem = useMemo(() => {
    const r = {} as Record<FilaId, number>;
    for (const f of FILAS) r[f.id] = daBusca.filter(f.combina).length;
    return r;
  }, [daBusca]);

  const filtrando = fila !== null || busca.trim() !== '';

  const porFase = useMemo(() => {
    const filaAtiva = FILAS.find((f) => f.id === fila);
    const visiveis = filaAtiva ? daBusca.filter(filaAtiva.combina) : daBusca;
    const r = {} as Record<FaseDoQuadro, ContextoCard[]>;
    for (const fase of FASES_DO_QUADRO) {
      const daFase = visiveis.filter((c) => c.fase === fase);
      const porId = new Map(daFase.map((c) => [c.formacao.id, c]));
      r[fase] = ordenarColuna(daFase.map((c) => c.formacao), fase).map((f) => porId.get(f.id)!);
    }
    return r;
  }, [daBusca, fila]);

  const totalPorFase = useMemo(() => {
    const r = {} as Record<FaseDoQuadro, number>;
    for (const fase of FASES_DO_QUADRO) r[fase] = contextos.filter((c) => c.fase === fase).length;
    return r;
  }, [contextos]);

  const totalVisivel = FASES_DO_QUADRO.reduce((s, f) => s + porFase[f].length, 0);
  const nadaPendente = FILAS.every((f) => f.id === 'avaliacao-aberta' || contagem[f.id] === 0);

  // Celular: uma coluna por vez. Abre na que pede ação (Encerrada) e, com filtro,
  // pula para uma coluna que tenha resultado em vez de mostrar uma vazia.
  const primeiraComItens = FASES_DO_QUADRO.find((f) => porFase[f].length > 0);
  const padraoMovel: FaseDoQuadro =
    porFase.encerrada.length > 0 ? 'encerrada' : porFase.acontecendo.length > 0 ? 'acontecendo' : 'a-realizar';
  let abaMovel: FaseDoQuadro = faseMovel ?? padraoMovel;
  if (filtrando && porFase[abaMovel].length === 0 && primeiraComItens) abaMovel = primeiraComItens;

  // ------------------------------------------------------------------ ações

  const concluir = async (f: Formacao) => {
    setOcupadoId(f.id);
    try {
      await changeFormacaoStatus(f, 'concluido', user);
      toast({ title: 'Formação concluída', description: 'A demanda de agradecimento está no Diário de Bordo.' });
    } catch (error: any) {
      console.error('Erro ao concluir:', error);
      toast({ variant: 'destructive', title: 'Erro', description: error?.message || 'Não foi possível concluir.' });
    } finally {
      setOcupadoId(null);
    }
  };

  const arquivar = async (f: Formacao) => {
    setOcupadoId(f.id);
    try {
      await changeFormacaoStatus(f, 'arquivado', user);
      toast({
        title: 'Formação arquivada',
        description: 'Ela continua em Arquivados.',
        action: (
          <ToastAction
            altText="Desfazer arquivamento"
            onClick={() =>
              updateDoc(doc(db, 'formacoes', f.id), { status: 'concluido' }).catch((e) => {
                console.error('Erro ao desfazer arquivamento:', e);
                toast({ variant: 'destructive', title: 'Não deu para desfazer', description: 'Abra Arquivados e desarquive por lá.' });
              })
            }
          >
            Desfazer
          </ToastAction>
        ),
      });
    } catch (error: any) {
      console.error('Erro ao arquivar:', error);
      toast({ variant: 'destructive', title: 'Erro', description: error?.message || 'Não foi possível arquivar.' });
    } finally {
      setOcupadoId(null);
    }
  };

  const copiarLink = async (f: Formacao) => {
    const url = `${window.location.origin}/avaliacao/${f.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copiado', description: 'O link do formulário de avaliação está na área de transferência.' });
    } catch {
      // Sem permissão de área de transferência (http, iframe): mostra o link para copiar à mão.
      toast({ variant: 'destructive', title: 'Não deu para copiar', description: url });
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    try {
      await deleteDoc(doc(db, 'formacoes', excluir.id));
      toast({ title: 'Formação excluída' });
    } catch (error) {
      console.error('Erro ao excluir formação:', error);
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: 'Não foi possível excluir a formação.' });
    } finally {
      setExcluir(null);
    }
  };

  /** Com projeto vinculado, a formação é editada pelo projeto (é ele que gera as datas). */
  const editar = async (f: Formacao) => {
    if (!f.projetoId) {
      setEmEdicao(f);
      setFormAberto(true);
      return;
    }
    setOcupadoId(f.id);
    try {
      const snap = await getDoc(doc(db, 'projetos', f.projetoId));
      if (snap.exists()) {
        setProjetoEmEdicao({ id: snap.id, ...snap.data() } as ProjetoImplatancao);
      } else {
        toast({ variant: 'destructive', title: 'Projeto vinculado não encontrado', description: 'Abrindo a formação.' });
        setEmEdicao(f);
        setFormAberto(true);
      }
    } catch (error) {
      console.error('Erro ao carregar projeto:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar os dados do projeto.' });
    } finally {
      setOcupadoId(null);
    }
  };

  const fecharFormacao = () => {
    setFormAberto(false);
    setEmEdicao(null);
    setFormSujo(false);
  };
  const fecharProjeto = () => {
    setProjetoEmEdicao(null);
    setFormSujo(false);
  };
  // Com onSnapshot o quadro se atualiza sozinho; ao salvar só falta fechar.
  const aoSalvar = () => {
    fecharFormacao();
    fecharProjeto();
  };

  // ------------------------------------------------------------------ tela

  if (carregando) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderCard = (c: ContextoCard) => (
    <CardFormacao
      key={c.formacao.id}
      contexto={c}
      ocupado={ocupadoId === c.formacao.id}
      onAbrir={() => setDetalhe(c.formacao)}
      onEditar={() => editar(c.formacao)}
      onConcluir={() => concluir(c.formacao)}
      onArquivar={() => arquivar(c.formacao)}
      onExcluir={() => setExcluir(c.formacao)}
      onCopiarLink={() => copiarLink(c.formacao)}
      onQRCode={() => setQrDe(c.formacao)}
    />
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">Acompanhamento</h1>
            <p className="text-sm text-muted-foreground">
              A data move o card entre as fases; concluir e arquivar ficam com você.
            </p>
          </div>
          <Button
            className="h-10 shrink-0"
            onClick={() => {
              setEmEdicao(null);
              setFormAberto(true);
            }}
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="sr-only sm:not-sr-only">Nova formação</span>
          </Button>
        </div>

        <BarraFilas
          contagem={contagem}
          filaAtiva={fila}
          onFila={setFila}
          busca={busca}
          onBusca={setBusca}
          pendencias={pendencias}
        />

        <div className="flex min-h-5 flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          {filtrando ? (
            <>
              <span>
                Mostrando {totalVisivel} de {contextos.length} formações
              </span>
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                onClick={() => {
                  setFila(null);
                  setBusca('');
                }}
              >
                Limpar filtros
              </button>
            </>
          ) : nadaPendente ? (
            <span className="text-emerald-700 dark:text-emerald-500">
              Tudo em dia: nada por concluir, nada sem formador ou sem data.
            </span>
          ) : null}
        </div>

        {/* Celular e tablet: abas de fase, uma coluna por vez. */}
        <div role="tablist" aria-label="Fases" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden">
          {FASES_DO_QUADRO.map((fase) => {
            const ativa = abaMovel === fase;
            return (
              <button
                key={fase}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setFaseMovel(fase)}
                className={cn(
                  'flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
                  ativa ? 'border-primary bg-primary/10 text-foreground' : 'bg-card text-muted-foreground'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', FASES[fase].ponto)} />
                {FASES[fase].titulo}
                <span className="tabular-nums text-xs">{porFase[fase].length}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-4">
          {FASES_DO_QUADRO.map((fase) => (
            <ColunaQuadro
              key={fase}
              fase={fase}
              itens={porFase[fase]}
              total={totalPorFase[fase]}
              filtrando={filtrando}
              renderCard={renderCard}
              className={cn(abaMovel !== fase && 'hidden lg:flex')}
            />
          ))}
        </div>

        {/* ------------------------------------------------ diálogos */}

        <Dialog open={detalhe !== null} onOpenChange={(open) => !open && setDetalhe(null)}>
          <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
            {detalhe && (
              <DetalhesFormacao
                formacaoId={detalhe.id}
                onClose={() => setDetalhe(null)}
                onEditar={() => {
                  const f = detalhe;
                  setDetalhe(null);
                  editar(f);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={formAberto}
          onOpenChange={(open) => {
            if (open) return;
            if (formSujo) setDescartar('formacao');
            else fecharFormacao();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{emEdicao ? 'Editar formação' : 'Nova formação'}</DialogTitle>
              <DialogDescription>
                {emEdicao ? tituloDaFormacao(emEdicao) : 'Preencha os dados para criar uma nova formação.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh]">
              <div className="p-4">
                <FormFormacao formacao={emEdicao} onSuccess={aoSalvar} onDirtyChange={setFormSujo} />
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog
          open={projetoEmEdicao !== null}
          onOpenChange={(open) => {
            if (open) return;
            if (formSujo) setDescartar('projeto');
            else fecharProjeto();
          }}
        >
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Editar projeto</DialogTitle>
              <DialogDescription>
                Esta formação nasce do projeto de {projetoEmEdicao?.municipio}: datas e formadores são editados aqui.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh]">
              <div className="p-4">
                <FormProjeto projeto={projetoEmEdicao} onSuccess={aoSalvar} onDirtyChange={setFormSujo} />
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <AlertDialog open={descartar !== null} onOpenChange={(open) => !open && setDescartar(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar as alterações?</AlertDialogTitle>
              <AlertDialogDescription>
                Você alterou campos que ainda não foram salvos. Se fechar agora, eles se perdem.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continuar editando</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => {
                  if (descartar === 'formacao') fecharFormacao();
                  else fecharProjeto();
                  setDescartar(null);
                }}
              >
                Descartar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={qrDe !== null} onOpenChange={(open) => !open && setQrDe(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>QR Code da avaliação</DialogTitle>
              <DialogDescription>Os participantes leem este código para abrir o formulário de avaliação.</DialogDescription>
            </DialogHeader>
            {qrDe && <GeradorQRCode url={`${window.location.origin}/avaliacao/${qrDe.id}`} title={qrDe.titulo} />}
          </DialogContent>
        </Dialog>

        <AlertDialog open={excluir !== null} onOpenChange={(open) => !open && setExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {excluir ? tituloDaFormacao(excluir) : 'formação'}?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Avaliações, despesas e anexos ligados a ela não são apagados
                junto. Se a intenção é só tirar do quadro, arquive.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmarExclusao} className="bg-destructive hover:bg-destructive/90">
                Sim, excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

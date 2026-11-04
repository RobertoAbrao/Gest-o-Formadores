'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { format, isToday } from 'date-fns';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Info, Loader2, Lock, Printer, Save } from 'lucide-react';
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
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DocumentoFicha } from '@/components/ficha/documento-ficha';
import { EditorFicha } from '@/components/ficha/editor-ficha';
import { useFicha } from '@/components/ficha/use-ficha';
import {
  comModalidade,
  comParticipanteDeVolta,
  diasDoPeriodo,
  formatarQuando,
  pendenciasDaFicha,
  semParticipante,
  type FichaEditavel,
  type Modalidade,
  type Pendencia,
} from '@/components/ficha/ficha-modelo';

/**
 * Impressão. O documento é desenhado uma segunda vez num portal direto no <body>
 * (`.ficha-print-root`), e na impressão tudo que não é ele some com `display: none`.
 *
 * Por que não a técnica antiga (`body * { visibility: hidden }` + `.printable-area` em
 * position:absolute, que ainda está no globals.css para as outras telas): visibility não tira
 * o resto do layout do fluxo e o absolute tira o documento dele — o navegador podia cortar o
 * que passava da 1ª página ou gerar página em branco. Aqui o documento fica no fluxo normal
 * e pagina sozinho. As regras com !important existem para vencer as do globals.css.
 */
const CSS_FICHA = `
.ficha-print-root { display: none; }
[data-destaque].ficha-destaque { box-shadow: 0 0 0 3px hsl(var(--accent)); }
@page { size: A4; margin: 14mm 12mm; }
@media print {
  html, body { background: #fff !important; }
  body > *:not(.ficha-print-root) { display: none !important; }
  .ficha-print-root { display: block !important; }
  .ficha-print-root, .ficha-print-root * { visibility: visible !important; }
  .ficha-print-root .doc-folha { box-shadow: none !important; padding: 0 !important; max-width: none !important; }
  .ficha-print-root .doc-falta { display: none !important; }
  .ficha-print-root thead { display: table-header-group; }
  .ficha-print-root tr, .ficha-print-root .doc-bloco { break-inside: avoid; page-break-inside: avoid; }
  .ficha-print-root h2, .ficha-print-root h3 { break-after: avoid; page-break-after: avoid; }
  .ficha-print-root a { color: inherit !important; }
}
`;

type Aba = 'editar' | 'documento';

export default function FichaDivulgacaoPage() {
  const params = useParams();
  const formacaoId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const { formacao, ficha, setFicha, sujo, salvaEm, carregando, erro, salvando, salvar } = useFicha(formacaoId);

  const [aba, setAba] = useState<Aba>('editar');
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [confirmarImpressao, setConfirmarImpressao] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  // Fechar a aba (ou recarregar) com alteração pendente: o navegador pergunta.
  useEffect(() => {
    if (!sujo) return;
    const aoSair = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [sujo]);

  const periodo = useMemo(() => (formacao ? diasDoPeriodo(formacao) : []), [formacao]);
  const quando = useMemo(() => (formacao ? formatarQuando(formacao) : ''), [formacao]);
  const pendencias = useMemo(
    () => (formacao && ficha ? pendenciasDaFicha(ficha, formacao, periodo) : []),
    [ficha, formacao, periodo]
  );
  const faltas = pendencias.filter((p) => p.gravidade === 'falta');

  const atualizar = useCallback(
    (fn: (f: FichaEditavel) => FichaEditavel) => setFicha((f) => (f ? fn(f) : f)),
    [setFicha]
  );

  if (carregando) {
    return (
      <div className="flex h-screen w-full items-center justify-center gap-2 bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        Carregando a ficha…
      </div>
    );
  }

  if (erro || !formacao || !ficha) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="max-w-md text-destructive">{erro ?? 'Não foi possível carregar a ficha.'}</p>
        <Button variant="outline" asChild>
          <Link href="/quadro">
            <ArrowLeft /> Voltar ao quadro
          </Link>
        </Button>
      </div>
    );
  }

  const handleSalvar = async () => {
    const ok = await salvar();
    toast(
      ok
        ? { title: 'Ficha salva.' }
        : { variant: 'destructive', title: 'Não foi possível salvar', description: 'Verifique a conexão e tente de novo.' }
    );
    return ok;
  };

  const imprimir = () => {
    if (faltas.length > 0) setConfirmarImpressao(true);
    else window.print();
  };

  const voltar = () => {
    if (sujo) setConfirmarSaida(true);
    else router.push('/quadro');
  };

  const trocarModalidade = (m: Modalidade) => atualizar((f) => comModalidade(f, m, formacao.titulo));

  const remover = (key: string) => {
    const r = semParticipante(ficha, key);
    if (!r.removido) return;
    const removido = r.removido;
    setFicha(r.ficha);
    toast({
      title: removido.tipo === 'fora' ? `${removido.nome} foi removido da ficha.` : 'Formador removido.',
      action: (
        <ToastAction altText="Desfazer" onClick={() => atualizar((f) => comParticipanteDeVolta(f, removido, r.indice))}>
          Desfazer
        </ToastAction>
      ),
    });
  };

  // Leva ao campo que resolve a pendência e o destaca por um instante.
  const irPara = (alvo?: string) => {
    if (!alvo) return;
    setAba('editar');
    window.setTimeout(() => {
      const el = document.getElementById(alvo);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (el.matches('input, textarea, button')) el.focus({ preventScroll: true });
      const caixa = (el.closest('[data-destaque]') as HTMLElement | null) ?? el;
      caixa.classList.add('ficha-destaque');
      window.setTimeout(() => caixa.classList.remove('ficha-destaque'), 1600);
    }, 60);
  };

  const documento = <DocumentoFicha ficha={ficha} formacao={formacao} periodo={periodo} quando={quando} />;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_FICHA }} />

      <div className="flex min-h-screen flex-col bg-background lg:h-screen">
        <header className="sticky top-0 z-20 border-b bg-card">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 lg:flex-nowrap lg:px-6">
            <Button variant="ghost" size="sm" className="px-2" onClick={voltar} aria-label="Voltar ao quadro">
              <ArrowLeft />
              <span className="hidden lg:inline">Quadro</span>
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Comunicado de divulgação</p>
              <p className="truncate font-bold">
                {formacao.titulo}{' '}
                {formacao.codigo && <span className="font-mono text-xs font-normal text-muted-foreground">#{formacao.codigo}</span>}
              </p>
            </div>
            <StatusSalvo sujo={sujo} salvaEm={salvaEm} />
            <div className="flex w-full items-center gap-2 lg:w-auto">
              <SeletorModalidade valor={ficha.modalidade} onChange={trocarModalidade} className="flex-1 lg:flex-none" />
              <div className="hidden gap-2 lg:flex">
                <BotaoSalvar sujo={sujo} salvando={salvando} onClick={handleSalvar} />
                <Button variant="outline" onClick={imprimir}>
                  <Printer /> Imprimir / PDF
                </Button>
              </div>
            </div>
          </div>

          <div role="tablist" aria-label="Partes da ficha" className="flex border-t lg:hidden">
            {(['editar', 'documento'] as const).map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={aba === a}
                onClick={() => setAba(a)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-bold',
                  aba === a ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                )}
              >
                {a === 'editar' ? 'Editar' : 'Documento'}
                {a === 'documento' && faltas.length > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full border border-amber-300 bg-amber-50 px-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {faltas.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section
            aria-label="Editar"
            className={cn('p-4 lg:overflow-y-auto lg:border-r lg:p-6', aba !== 'editar' && 'hidden lg:block')}
          >
            <EditorFicha
              ficha={ficha}
              formacao={formacao}
              periodo={periodo}
              quando={quando}
              atualizar={atualizar}
              onRemover={remover}
            />
          </section>

          <section
            aria-label="Documento"
            className={cn('bg-muted/40 p-4 lg:overflow-y-auto lg:p-6', aba !== 'documento' && 'hidden lg:block')}
          >
            <div className="mx-auto flex max-w-[860px] flex-col gap-3">
              <PainelPendencias pendencias={pendencias} onIr={irPara} />
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3.5 w-3.5" aria-hidden /> Documento · somente leitura, igual ao PDF
              </p>
              {documento}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 z-20 flex gap-2 border-t bg-card px-4 py-3 lg:hidden">
          <BotaoSalvar sujo={sujo} salvando={salvando} onClick={handleSalvar} className="flex-1" />
          <Button variant="outline" onClick={imprimir} className="flex-1">
            <Printer /> Imprimir / PDF
          </Button>
        </div>
      </div>

      {montado && createPortal(<div className="ficha-print-root">{documento}</div>, document.body)}

      <AlertDialog open={confirmarSaida} onOpenChange={setConfirmarSaida}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações que ainda não foram salvas. Se sair agora, elas se perdem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => router.push('/quadro')}
            >
              Sair sem salvar
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                if (await handleSalvar()) router.push('/quadro');
              }}
            >
              Salvar e sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarImpressao} onOpenChange={setConfirmarImpressao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ainda falta preencher</AlertDialogTitle>
            <AlertDialogDescription>
              {faltas.length === 1 ? 'Há 1 item' : `Há ${faltas.length} itens`} na lista &quot;Antes de enviar&quot;. No PDF, o
              que estiver vazio sai em branco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => irPara(faltas[0]?.alvo)}>Revisar</AlertDialogCancel>
            <AlertDialogAction onClick={() => window.setTimeout(() => window.print(), 150)}>Imprimir mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------

function StatusSalvo({ sujo, salvaEm }: { sujo: boolean; salvaEm: Date | null }) {
  const base = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold';
  if (sujo) {
    return (
      <span
        role="status"
        className={cn(base, 'border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300')}
      >
        <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
        <span className="hidden sm:inline">Alterações não salvas</span>
        <span className="sm:hidden">Não salvo</span>
      </span>
    );
  }
  if (!salvaEm) {
    return (
      <span role="status" className={cn(base, 'border text-muted-foreground')}>
        Ainda não salva
      </span>
    );
  }
  return (
    <span role="status" className={cn(base, 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300')}>
      <Check className="h-3.5 w-3.5" aria-hidden />
      {isToday(salvaEm) ? `Salvo às ${format(salvaEm, 'HH:mm')}` : `Salvo em ${format(salvaEm, 'dd/MM')}`}
    </span>
  );
}

function SeletorModalidade({
  valor,
  onChange,
  className,
}: {
  valor: Modalidade;
  onChange: (m: Modalidade) => void;
  className?: string;
}) {
  const opcoes: { valor: Modalidade; rotulo: string }[] = [
    { valor: 'online', rotulo: 'Online' },
    { valor: 'presencial', rotulo: 'Presencial' },
  ];
  return (
    <div role="group" aria-label="Modalidade" className={cn('inline-flex gap-0.5 rounded-lg border bg-muted/50 p-1', className)}>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            'flex-1 rounded-md px-4 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            valor === o.valor ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

function BotaoSalvar({
  sujo,
  salvando,
  onClick,
  className,
}: {
  sujo: boolean;
  salvando: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button variant={sujo ? 'default' : 'outline'} onClick={onClick} disabled={salvando} className={className}>
      {salvando ? <Loader2 className="animate-spin" /> : <Save />}
      {sujo ? 'Salvar' : 'Salvo'}
    </Button>
  );
}

function PainelPendencias({ pendencias, onIr }: { pendencias: Pendencia[]; onIr: (alvo?: string) => void }) {
  if (pendencias.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
        <span>
          <strong>Tudo preenchido.</strong> Pode gerar o PDF e enviar.
        </span>
      </div>
    );
  }

  const faltas = pendencias.filter((p) => p.gravidade === 'falta').length;
  const avisos = pendencias.length - faltas;
  const contagem = [faltas ? `${faltas} para preencher` : '', avisos ? `${avisos} ${avisos > 1 ? 'avisos' : 'aviso'}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3',
        faltas
          ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
          : 'bg-card'
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {faltas ? (
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden />
        ) : (
          <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        <strong className="text-sm">Antes de enviar</strong>
        <span className="ml-auto text-xs font-bold text-amber-800 dark:text-amber-300">{contagem}</span>
      </div>
      <ul className="mt-2 flex flex-col gap-0.5">
        {pendencias.map((p, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={!p.alvo}
              onClick={() => onIr(p.alvo)}
              className={cn(
                'relative w-full rounded-md py-1.5 pl-6 pr-2 text-left text-sm enabled:hover:bg-card',
                p.gravidade === 'aviso' && 'text-muted-foreground'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute left-2 top-3 h-1.5 w-1.5 rounded-full',
                  p.gravidade === 'falta' ? 'bg-amber-600' : 'bg-muted-foreground'
                )}
              />
              {p.texto}
            </button>
          </li>
        ))}
      </ul>
      {faltas > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Clique num item para ir ao campo. No PDF, o que estiver vazio sai em branco.
        </p>
      )}
    </div>
  );
}

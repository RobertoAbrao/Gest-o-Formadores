'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, User, Loader2, ChevronLeft, SkipForward, AlertTriangle, Search, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { OpcaoPasso } from '@/lib/agent/wizard-flows';
import type { useWizard } from '@/hooks/use-wizard';

type Wizard = ReturnType<typeof useWizard>;

/** Alvo de toque mínimo confortável para polegar. */
const TOQUE = 'min-h-[44px]';

export function WizardChat({ wizard, nomeProjeto }: { wizard: Wizard; nomeProjeto: string }) {
  const fimDaConversa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimDaConversa.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [wizard.mensagens.length, wizard.estado]);

  return (
    <div className="flex h-full flex-col">
      <ResumoProjeto wizard={wizard} nomeProjeto={nomeProjeto} />

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4" data-testid="conversa">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {wizard.mensagens.map((m) => (
            <div key={m.id} className={cn('flex gap-2', m.autor === 'usuario' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  m.autor === 'robo' ? 'bg-primary/10 text-primary' : 'bg-muted'
                )}
              >
                {m.autor === 'robo' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                  m.autor === 'robo' ? 'bg-muted' : 'bg-primary text-primary-foreground'
                )}
              >
                <p className="whitespace-pre-wrap">{m.texto}</p>
                {m.ajuda && (
                  <p
                    className={cn(
                      'mt-1.5 flex items-start gap-1.5 text-xs',
                      m.alerta ? 'text-amber-700 dark:text-amber-500' : 'text-muted-foreground'
                    )}
                  >
                    {m.alerta && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    {m.ajuda}
                  </p>
                )}
              </div>
            </div>
          ))}

          {wizard.erroSalvar && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {wizard.erroSalvar}
            </div>
          )}

          <div ref={fimDaConversa} />
        </div>
      </div>

      <Controles wizard={wizard} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ResumoProjeto({ wizard, nomeProjeto }: { wizard: Wizard; nomeProjeto: string }) {
  const v = wizard.ctx.values;
  const marca = (ok: boolean | undefined, temData: boolean) => (ok ? '✅' : temData ? '📅' : '⏳');

  return (
    <div className="shrink-0 border-b bg-card px-3 py-2.5">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold">{nomeProjeto}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="outline" className="font-normal">
            👥 {wizard.ctx.formadoresDoProjeto.length} formador(es)
          </Badge>
          <Badge variant="outline" className="font-normal">
            {marca(v?.diagnostica?.ok, !!v?.diagnostica?.data)} Diagnóstica
          </Badge>
          <Badge variant="outline" className="font-normal">
            Simulados{' '}
            {([1, 2, 3, 4] as const)
              .map((n) => {
                const s = v?.simulados?.[`s${n}` as 's1'];
                return marca(s?.ok, !!s?.dataInicio);
              })
              .join('')}
          </Badge>
          <Badge variant="outline" className="font-normal">
            Devolutivas{' '}
            {([1, 2, 3, 4] as const)
              .map((n) => {
                const d = v?.devolutivas?.[`d${n}` as 'd1'];
                return marca(d?.ok, !!d?.dataInicio);
              })
              .join('')}
          </Badge>
          <Badge variant="outline" className="font-normal">
            🏗️ {(v?.implantacoes || []).length} implantação(ões)
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Controles({ wizard }: { wizard: Wizard }) {
  const { estado, passo, ctx, salvando } = wizard;

  return (
    <div className="shrink-0 border-t bg-card px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-2xl">
        {salvando && (
          <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
          </p>
        )}

        {estado === 'menu' && <Menu wizard={wizard} />}
        {estado === 'em-fluxo' && passo && <ControlePasso key={passo.id + ctx.alvo} wizard={wizard} />}
        {estado === 'fim-fluxo' && <AcoesFinais wizard={wizard} />}
      </div>
    </div>
  );
}

function Menu({ wizard }: { wizard: Wizard }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {wizard.fluxos.map((f) => (
        <Button
          key={f.id}
          variant="outline"
          className={cn(TOQUE, 'justify-start')}
          onClick={() => wizard.iniciarFluxo(f.id)}
          disabled={wizard.salvando}
        >
          <span className="mr-2">{f.icone}</span>
          {f.rotulo}
        </Button>
      ))}
    </div>
  );
}

function AcoesFinais({ wizard }: { wizard: Wizard }) {
  return (
    // Não há mais botão "criar formação": ela nasce sozinha ao salvar a etapa.
    <div className="flex flex-col gap-2">
      <Button className={TOQUE} onClick={wizard.irParaMenu} disabled={wizard.salvando}>
        🔙 Preencher outra coisa
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ControlePasso({ wizard }: { wizard: Wizard }) {
  const { passo, ctx, salvando } = wizard;
  if (!passo) return null;

  const opcoes = passo.opcoes?.(ctx) ?? [];
  const semDados = (passo.semDados?.(ctx) ?? null) !== null;

  return (
    <div className="flex flex-col gap-3">
      {passo.tipo === 'chips' && !semDados && <Chips opcoes={opcoes} wizard={wizard} />}
      {passo.tipo === 'multi' && !semDados && <MultiSelecao opcoes={opcoes} wizard={wizard} />}
      {passo.tipo === 'data' && <EscolhaData wizard={wizard} />}
      {passo.tipo === 'texto' && <EntradaTexto wizard={wizard} />}

      <div className="flex gap-2">
        <Button
          variant="ghost"
          className={cn(TOQUE, 'flex-1')}
          onClick={() => wizard.voltar()}
          disabled={salvando}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        {(passo.opcional || semDados) && (
          <Button
            variant="outline"
            className={cn(TOQUE, 'flex-1')}
            onClick={() => wizard.pular()}
            disabled={salvando}
          >
            <SkipForward className="mr-1 h-4 w-4" /> {passo.rotuloPular || 'Pular'}
          </Button>
        )}
      </div>
    </div>
  );
}

function Chips({ opcoes, wizard }: { opcoes: OpcaoPasso[]; wizard: Wizard }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {opcoes.map((o) => (
        <Button
          key={o.valor}
          variant="outline"
          className={cn(TOQUE, 'h-auto flex-col py-2')}
          onClick={() => wizard.responder(o.valor, o.rotulo)}
          disabled={wizard.salvando}
        >
          <span className="font-medium">{o.rotulo}</span>
          {o.detalhe && <span className="text-[11px] font-normal text-muted-foreground">{o.detalhe}</span>}
        </Button>
      ))}
    </div>
  );
}

function MultiSelecao({ opcoes, wizard }: { opcoes: OpcaoPasso[]; wizard: Wizard }) {
  const [marcados, setMarcados] = useState<string[]>([]);
  const [busca, setBusca] = useState('');

  // Lista longa dentro de área rolável é ruim no celular — filtra em vez de rolar.
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((o) => o.rotulo.toLowerCase().includes(termo));
  }, [opcoes, busca]);

  const alternar = (valor: string) =>
    setMarcados((m) => (m.includes(valor) ? m.filter((v) => v !== valor) : [...m, valor]));

  const rotulos = opcoes.filter((o) => marcados.includes(o.valor)).map((o) => o.rotulo);

  return (
    <div className="flex flex-col gap-2">
      {opcoes.length > 8 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar…"
            className="pl-8"
          />
        </div>
      )}

      <div className="flex max-h-[38vh] flex-col gap-1.5 overflow-y-auto overscroll-contain">
        {visiveis.map((o) => {
          const ativo = marcados.includes(o.valor);
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => alternar(o.valor)}
              className={cn(
                TOQUE,
                'flex items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors',
                ativo ? 'border-primary bg-primary/10' : 'hover:bg-muted'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                  ativo && 'border-primary bg-primary text-primary-foreground'
                )}
              >
                {ativo && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="flex-1">{o.rotulo}</span>
              {o.detalhe && <span className="text-xs text-muted-foreground">{o.detalhe}</span>}
            </button>
          );
        })}
      </div>

      <Button
        className={TOQUE}
        disabled={marcados.length === 0 || wizard.salvando}
        onClick={() => wizard.responder(marcados, rotulos.join(', '))}
      >
        Confirmar {marcados.length > 0 && `(${marcados.length})`}
      </Button>
    </div>
  );
}

function EscolhaData({ wizard }: { wizard: Wizard }) {
  const hoje = startOfDay(new Date());
  const atalhos = [
    { rotulo: 'Hoje', data: hoje },
    { rotulo: 'Amanhã', data: addDays(hoje, 1) },
    { rotulo: 'Em 7 dias', data: addDays(hoje, 7) },
  ];

  const enviar = (d: Date) => wizard.responder(d, d.toLocaleDateString('pt-BR'));

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {atalhos.map((a) => (
          <Button
            key={a.rotulo}
            variant="outline"
            className={TOQUE}
            onClick={() => enviar(a.data)}
            disabled={wizard.salvando}
          >
            {a.rotulo}
          </Button>
        ))}
      </div>
      {/* Calendário inline: em tela estreita o Popover do formulário fica cortado. */}
      <div className="flex justify-center rounded-md border">
        <Calendar
          mode="single"
          locale={ptBR}
          onSelect={(d) => d && enviar(startOfDay(d))}
          disabled={wizard.salvando}
        />
      </div>
    </div>
  );
}

function EntradaTexto({ wizard }: { wizard: Wizard }) {
  const [texto, setTexto] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escreva aqui…"
        className="min-h-[80px]"
      />
      <Button
        className={TOQUE}
        disabled={texto.trim().length === 0 || wizard.salvando}
        onClick={() => wizard.responder(texto.trim(), texto.trim())}
      >
        Confirmar
      </Button>
    </div>
  );
}

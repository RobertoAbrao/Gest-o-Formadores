'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Check, Lock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { AgendaRow, Formacao } from '@/lib/types';
import {
  DIAS_DA_SEMANA,
  ID,
  comCampo,
  comExtraNovo,
  comLinha,
  comLinhaNova,
  comParticipante,
  linkInvalido,
  montarIntroducao,
  novaChaveExtra,
  semLinha,
  type DiaDoPeriodo,
  type FichaEditavel,
  type ParticipanteFicha,
} from './ficha-modelo';

type Atualizar = (fn: (f: FichaEditavel) => FichaEditavel) => void;

/** Põe o foco num campo que acabou de ser criado (depois do React desenhá-lo). */
const focarDepois = (id: string, selecionar = false) =>
  window.setTimeout(() => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.focus();
    if (selecionar) el?.select?.();
  }, 30);

/**
 * Lado "Editar" da ficha: tudo que a pessoa preenche. O que vem da formação (título, datas,
 * equipe, currículo) aparece aqui só como leitura — muda-se na formação, não na ficha.
 */
export function EditorFicha({
  ficha,
  formacao,
  periodo,
  quando,
  atualizar,
  onRemover,
}: {
  ficha: FichaEditavel;
  formacao: Formacao;
  periodo: DiaDoPeriodo[];
  quando: string;
  atualizar: Atualizar;
  onRemover: (key: string) => void;
}) {
  const presencial = ficha.modalidade === 'presencial';
  const introducaoPadrao = montarIntroducao(formacao.titulo, ficha.modalidade);
  const ativos = ficha.participantes.filter((p) => p.tipo !== 'fora');
  const fora = ficha.participantes.filter((p) => p.tipo === 'fora');
  let numero = 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Secao numero={++numero} titulo="Mensagem de abertura">
        <div>
          <Label htmlFor={ID.introducao} className="mb-1.5 block text-xs font-bold text-muted-foreground">
            Texto que abre o comunicado
          </Label>
          <Textarea
            id={ID.introducao}
            rows={4}
            value={ficha.introducao}
            onChange={(e) => atualizar((f) => comCampo(f, 'introducao', e.target.value))}
          />
        </div>
        {ficha.introducao !== introducaoPadrao && (
          <button
            type="button"
            className="self-start text-sm font-bold text-primary underline underline-offset-4"
            onClick={() => atualizar((f) => comCampo(f, 'introducao', introducaoPadrao))}
          >
            Voltar ao texto padrão
          </button>
        )}
      </Secao>

      <Secao numero={++numero} titulo="Data e horário">
        <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/40 px-3 py-2.5">
          <Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-xs font-bold text-muted-foreground">Quando</p>
            <p className="font-bold">{quando}</p>
            <p className="text-xs text-muted-foreground">Vem da formação. Para mudar, edite a formação no quadro.</p>
          </div>
        </div>
        <div>
          <Label htmlFor={ID.horario} className="mb-1.5 block text-xs font-bold text-muted-foreground">
            Horário geral
          </Label>
          <Input
            id={ID.horario}
            value={ficha.horario}
            placeholder="Ex.: 19h00 às 20h30"
            onChange={(e) => atualizar((f) => comCampo(f, 'horario', e.target.value))}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Aparece no topo do documento.{presencial && ' Cada horário novo da agenda começa com ele.'}
          </p>
        </div>
      </Secao>

      {presencial && (
        <Secao numero={++numero} titulo="Local do encontro">
          <div>
            <Label htmlFor={ID.endereco} className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Endereço completo
            </Label>
            <Textarea
              id={ID.endereco}
              rows={3}
              value={ficha.endereco}
              placeholder="Ex.: Escola Municipal Rui Barbosa, Rua das Flores, 120, Centro, cidade – UF"
              onChange={(e) => atualizar((f) => comCampo(f, 'endereco', e.target.value))}
            />
            {!ficha.endereco.trim() && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                O endereço muda a cada formação, por isso começa vazio. Preencha antes de enviar.
              </p>
            )}
          </div>
        </Secao>
      )}

      <Secao
        numero={++numero}
        titulo={presencial ? 'Formadores e agenda' : 'Formadores e links'}
        descricao={
          presencial ? 'Cada linha completa vira uma entrada no cronograma do documento.' : 'Um link do Google Meet por formador.'
        }
      >
        <div className="flex flex-col gap-3">
          {ativos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Esta formação não tem formadores cadastrados. Cadastre a equipe na formação ou adicione um formador a definir.
            </p>
          )}
          {ativos.map((p) => (
            <CartaoFormador
              key={p.key}
              p={p}
              presencial={presencial}
              periodo={periodo}
              atualizar={atualizar}
              onRemover={onRemover}
            />
          ))}
          {fora.map((p) => (
            <CartaoForaDaEquipe key={p.key} p={p} onRemover={onRemover} />
          ))}
        </div>
        <Button
          id={ID.addExtra}
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            const key = novaChaveExtra();
            atualizar((f) => comExtraNovo(f, periodo, key));
            focarDepois(ID.nome(key), true);
          }}
        >
          <Plus /> Adicionar formador a definir
        </Button>
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Secao({
  numero,
  titulo,
  descricao,
  children,
}: {
  numero: number;
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section data-destaque className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-shadow sm:p-5">
      <header className="flex items-start gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
          {numero}
        </span>
        <div>
          <h2 className="text-base font-bold leading-tight">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Selo({ children, tom = 'padrao' }: { children: ReactNode; tom?: 'padrao' | 'ok' | 'neutro' | 'tracejado' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-bold [&_svg]:h-3 [&_svg]:w-3',
        tom === 'padrao' && 'bg-primary/10 text-primary',
        tom === 'ok' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        tom === 'neutro' && 'border bg-muted/50 text-muted-foreground',
        tom === 'tracejado' && 'border border-dashed border-input text-muted-foreground'
      )}
    >
      {children}
    </span>
  );
}

function CartaoFormador({
  p,
  presencial,
  periodo,
  atualizar,
  onRemover,
}: {
  p: ParticipanteFicha;
  presencial: boolean;
  periodo: DiaDoPeriodo[];
  atualizar: Atualizar;
  onRemover: (key: string) => void;
}) {
  const extra = p.tipo === 'extra';

  return (
    <div
      id={ID.card(p.key)}
      data-destaque
      className={cn(
        'flex flex-col gap-3 rounded-md border bg-card p-3 transition-shadow',
        extra && 'border-dashed border-input'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {extra ? (
          <>
            <Selo tom="tracejado">A definir</Selo>
            <Label htmlFor={ID.nome(p.key)} className="sr-only">
              Nome do formador
            </Label>
            <Input
              id={ID.nome(p.key)}
              className="min-w-[150px] flex-1 font-bold"
              value={p.nome}
              placeholder="Nome ou A definir"
              onChange={(e) => atualizar((f) => comParticipante(f, p.key, { nome: e.target.value }))}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              aria-label="Remover este formador"
              onClick={() => onRemover(p.key)}
            >
              <Trash2 />
            </Button>
          </>
        ) : (
          <>
            <strong className="mr-auto">{p.nome}</strong>
            <Selo>Da equipe</Selo>
            {p.curriculo?.trim() ? (
              <Selo tom="ok">
                <Check aria-hidden /> Currículo
              </Selo>
            ) : (
              <Selo tom="neutro">Sem currículo no cadastro</Selo>
            )}
          </>
        )}
      </div>

      {presencial ? (
        <Agenda p={p} periodo={periodo} atualizar={atualizar} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <Label htmlFor={ID.anoArea(p.key)} className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Ano/Área
            </Label>
            <Input
              id={ID.anoArea(p.key)}
              value={p.anoArea}
              placeholder="Ex.: Anos Iniciais"
              onChange={(e) => atualizar((f) => comParticipante(f, p.key, { anoArea: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={ID.link(p.key)} className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Link do Google Meet
            </Label>
            <Input
              id={ID.link(p.key)}
              type="url"
              inputMode="url"
              value={p.linkUrl}
              placeholder="https://meet.google.com/..."
              onChange={(e) => atualizar((f) => comParticipante(f, p.key, { linkUrl: e.target.value }))}
            />
            {linkInvalido(p.linkUrl) && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Isto não parece um link. Ele deve começar com https://
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Agenda({ p, periodo, atualizar }: { p: ParticipanteFicha; periodo: DiaDoPeriodo[]; atualizar: Atualizar }) {
  // Com período de até uma semana, só os dias da formação, com a data. Sem isso, os 7 dias.
  const opcoesBase = periodo.length
    ? periodo.map((d) => ({ dia: d.dia, rotulo: `${d.dia.replace('-feira', '')} · ${d.data}` }))
    : DIAS_DA_SEMANA.map((d) => ({ dia: d, rotulo: d }));

  const mudarLinha = (i: number, patch: Partial<AgendaRow>) => atualizar((f) => comLinha(f, p.key, i, patch));

  return (
    <>
      {p.agenda.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum horário ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {p.agenda.map((r, i) => {
            // Dia salvo que não cabe no período atual (a data da formação mudou depois).
            const opcoes =
              r.dia && !opcoesBase.some((o) => o.dia === r.dia)
                ? [...opcoesBase, { dia: r.dia, rotulo: `${r.dia} (fora do período)` }]
                : opcoesBase;
            const rotulo = cn('mb-1.5 block text-xs font-bold text-muted-foreground', i > 0 && 'sm:sr-only');
            return (
              <div
                key={i}
                data-destaque
                className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-2.5 transition-shadow sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.3fr)_88px_36px] sm:items-end sm:bg-transparent sm:p-0"
              >
                <div>
                  <Label htmlFor={ID.dia(p.key, i)} className={rotulo}>
                    Dia
                  </Label>
                  <Select value={r.dia} onValueChange={(v) => mudarLinha(i, { dia: v })}>
                    <SelectTrigger id={ID.dia(p.key, i)}>
                      <SelectValue placeholder="Escolha…" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoes.map((o) => (
                        <SelectItem key={o.dia} value={o.dia}>
                          {o.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={ID.hora(p.key, i)} className={rotulo}>
                    Horário
                  </Label>
                  <Input
                    id={ID.hora(p.key, i)}
                    value={r.horario}
                    placeholder="19h00 às 20h30"
                    onChange={(e) => mudarLinha(i, { horario: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor={ID.area(p.key, i)} className={rotulo}>
                    Ano/Área
                  </Label>
                  <Input
                    id={ID.area(p.key, i)}
                    value={r.area}
                    placeholder="Ex.: Anos Iniciais"
                    onChange={(e) => mudarLinha(i, { area: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={ID.qtd(p.key, i)} className={rotulo}>
                    Participantes
                  </Label>
                  <Input
                    id={ID.qtd(p.key, i)}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={r.participantes ?? ''}
                    placeholder="0"
                    onChange={(e) =>
                      mudarLinha(i, {
                        participantes: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 self-end justify-self-end text-muted-foreground hover:text-destructive"
                  aria-label="Remover este horário"
                  onClick={() => atualizar((f) => semLinha(f, p.key, i))}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <Button
        id={ID.addLinha(p.key)}
        type="button"
        variant="ghost"
        size="sm"
        className="self-start text-primary"
        onClick={() => {
          atualizar((f) => comLinhaNova(f, p.key, periodo));
          focarDepois(ID.area(p.key, p.agenda.length));
        }}
      >
        <Plus /> Adicionar horário
      </Button>
    </>
  );
}

function CartaoForaDaEquipe({ p, onRemover }: { p: ParticipanteFicha; onRemover: (key: string) => void }) {
  return (
    <div
      id={ID.card(p.key)}
      data-destaque
      className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 transition-shadow dark:border-amber-800 dark:bg-amber-950/40"
    >
      <p className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <span>
          <strong>{p.nome}</strong> saiu da equipe desta formação. O que estava salvo para ele fica guardado, mas não sai no
          documento.
        </span>
      </p>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onRemover(p.key)}>
        Remover da ficha
      </Button>
    </div>
  );
}

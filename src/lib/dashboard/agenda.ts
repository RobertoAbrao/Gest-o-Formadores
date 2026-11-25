/**
 * Agenda do Dashboard ("Precisa de você"): o que entra em cada coluna e com que texto.
 *
 * Funções puras — sem React nem Firestore — para testar com relógio fixo (`hoje` é
 * sempre parâmetro) e para a tela só desenhar. Ver `agenda.test.ts`.
 *
 * As colunas (redesenho aprovado em 25/11/2026):
 *  - **Atrasado**: passou da data E dá para resolver aqui — formação que terminou e
 *    ninguém concluiu, demanda vencida, lembrete não feito. Marco de projeto e aviso de
 *    logística que já passaram NÃO entram: não há como "resolvê-los", e ficariam
 *    vermelhos para sempre. Viram "passado" (e aparecem em "Ontem", se foram ontem).
 *  - **Hoje** e **Próximos 7 dias**, contados por dia de calendário (o 7º dia entra).
 *  - **Sem prazo**: demanda sem data.
 *  - **Mais adiante**: só aparece quando uma fila filtra a tela.
 *
 * O que esta regra corrige (o Dashboard antigo calculava tudo dentro da página, sem teste):
 *  1. demanda vencida há 2+ dias sumia de todas as listas — só existiam as janelas
 *     "hoje a +7" e "ontem" — e continuava no contador;
 *  2. demanda sem prazo nunca aparecia;
 *  3. formação com "devolutiva" no título era pulada inteira, junto com os avisos de
 *     logística dela (o filtro por texto existia para não duplicar a devolutiva do
 *     projeto). Agora a duplicata é evitada pelo VÍNCULO entre formação e projeto;
 *  4. a janela de 7 dias terminava às 00:00 do 7º dia: evento desse dia com hora
 *     gravada (ex.: meio-dia) ficava de fora.
 */

import { addDays, differenceInCalendarDays, format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import type { Demanda, Formacao, Lembrete, ProjetoImplatancao } from '@/lib/types';
import { faseDaFormacao, type FaseFormacao } from '@/lib/fase-formacao';
import { implantacoesDoProjeto } from '@/lib/projetos/implantacoes';
import { tituloDaFormacao } from '@/components/quadro/quadro-modelo';

/** Hoje e mais estes dias formam "Próximos 7 dias" (o último dia incluído). */
export const JANELA_DIAS = 7;

export type TipoItem = 'formacao' | 'demanda' | 'projeto' | 'lembrete' | 'logistica';
export type Grupo = 'atrasado' | 'hoje' | 'proximos' | 'adiante' | 'sem-prazo' | 'passado';
/** Cor do texto do prazo: a urgência vem escrita ("Venceu há 3 dias"), a cor só reforça. */
export type Tom = 'atrasado' | 'atencao' | 'andamento' | 'neutro' | 'feito' | 'sem-prazo';

export interface ItemAgenda {
  /** Única e estável: serve de `key` na tela. */
  chave: string;
  tipo: TipoItem;
  titulo: string;
  /** Município/UF, quando faz sentido mostrar. */
  local: string;
  /** A data que decide a coluna e a ordem. `null` = sem prazo. */
  data: Date | null;
  /** Os dias que o item ocupa no calendário do mês. */
  dias: Date[];
  grupo: Grupo;
  /** "Venceu há 5 dias", "Acontecendo · até qui, 26/11", "Começa sex, 27/11"... */
  quando: string;
  tom: Tom;
  formacaoId?: string;
  demandaId?: string;
  projetoId?: string;
  lembreteId?: string;
  fase?: FaseFormacao;
  semFormador?: boolean;
  urgente?: boolean;
  automatica?: boolean;
  responsavel?: string;
  /** Contexto curto extra: versão do projeto, formador da logística, autor do lembrete. */
  detalhe?: string;
}

export interface EntradaAgenda {
  formacoes: Formacao[];
  demandas: Demanda[];
  projetos: ProjetoImplatancao[];
  lembretes: Lembrete[];
}

export interface OpcoesAgenda {
  /**
   * Formações concluídas nesta visita à tela. Ficam à vista ("Concluída · falta
   * arquivar", com o botão Arquivar) em vez de sumir no clique. As demais concluídas
   * não entram: arquivar o que ficou para trás é trabalho do /quadro.
   */
  recemConcluidas?: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Datas e textos
// ---------------------------------------------------------------------------

type ComData = { toDate: () => Date } | Timestamp | null | undefined;

const paraData = (t: ComData): Date | null => {
  if (!t || typeof (t as { toDate?: unknown }).toDate !== 'function') return null;
  try {
    return (t as { toDate: () => Date }).toDate();
  } catch {
    return null;
  }
};

const dias = (n: number) => (n === 1 ? 'dia' : 'dias');

/**
 * "sex, 27/11". Nomes próprios em vez do `EEE` da date-fns: em pt-BR ele devolve
 * "sexta" (longo demais para a coluna) e muda conforme a versão da biblioteca.
 */
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const diaDaSemana = (d: Date) => `${DIAS_CURTOS[d.getDay()]}, ${format(d, 'dd/MM')}`;

const localDe = (o: { municipio?: string; uf?: string }) =>
  o.municipio ? (o.uf ? `${o.municipio}/${o.uf}` : o.municipio) : '';

/**
 * A coluna de uma data. `resolvivel`: o item tem como ser concluído aqui (demanda,
 * lembrete) — só esses vão para "Atrasado" quando a data passa.
 */
function grupoPorData(data: Date | null, hoje: Date, resolvivel: boolean): Grupo {
  if (!data) return 'sem-prazo';
  const n = differenceInCalendarDays(data, hoje);
  if (n < 0) return resolvivel ? 'atrasado' : 'passado';
  if (n === 0) return 'hoje';
  if (n <= JANELA_DIAS) return 'proximos';
  return 'adiante';
}

function quandoDaDemanda(prazo: Date | null, hoje: Date): { quando: string; tom: Tom } {
  if (!prazo) return { quando: 'Sem prazo', tom: 'sem-prazo' };
  const n = differenceInCalendarDays(prazo, hoje);
  if (n < 0) return { quando: n === -1 ? 'Venceu ontem' : `Venceu há ${-n} ${dias(-n)}`, tom: 'atrasado' };
  if (n === 0) return { quando: 'Vence hoje', tom: 'atencao' };
  if (n === 1) return { quando: 'Vence amanhã', tom: 'atencao' };
  return { quando: `Vence ${diaDaSemana(prazo)}`, tom: 'neutro' };
}

/** Marco de projeto, aviso de logística ou lembrete. */
function quandoDoMarco(data: Date, hoje: Date, tipo: TipoItem): { quando: string; tom: Tom } {
  const n = differenceInCalendarDays(data, hoje);
  if (n < 0) {
    if (tipo !== 'lembrete') return { quando: diaDaSemana(data), tom: 'neutro' };
    return { quando: n === -1 ? 'Era para ontem' : `Atrasado há ${-n} ${dias(-n)}`, tom: 'atrasado' };
  }
  if (n === 0) return { quando: 'Hoje', tom: 'atencao' };
  if (n === 1) return { quando: 'Amanhã', tom: 'atencao' };
  return { quando: diaDaSemana(data), tom: 'neutro' };
}

function diasEntre(inicio: Date, fim: Date): Date[] {
  // Teto de 62 dias: uma data digitada errada não pode gerar um laço gigante.
  const total = Math.min(Math.max(differenceInCalendarDays(fim, inicio), 0), 62);
  return Array.from({ length: total + 1 }, (_, i) => addDays(inicio, i));
}

const mesmoDia = (a: Date, b: Date) => differenceInCalendarDays(a, b) === 0;

// ---------------------------------------------------------------------------
// Formações e logística
// ---------------------------------------------------------------------------

function periodoDaFormacao(f: Formacao): { inicio: Date; fim: Date } | null {
  const inicio = paraData(f.dataInicio) ?? paraData(f.dataFim);
  const fim = paraData(f.dataFim) ?? inicio;
  return inicio && fim ? { inicio, fim } : null;
}

function itemDaFormacao(f: Formacao, hoje: Date, recemConcluidas: ReadonlySet<string>): ItemAgenda | null {
  const fase = faseDaFormacao(f, hoje);
  if (fase === 'arquivada') return null;
  if (fase === 'concluida' && !recemConcluidas.has(f.id)) return null;
  // Sem data: não tem lugar numa agenda. Aparece na fila "Sem data" do /quadro.
  const periodo = periodoDaFormacao(f);
  if (!periodo) return null;
  const { inicio, fim } = periodo;

  const base = {
    chave: `formacao:${f.id}`,
    tipo: 'formacao' as const,
    titulo: tituloDaFormacao(f),
    local: localDe(f),
    dias: diasEntre(inicio, fim),
    formacaoId: f.id,
    fase,
    semFormador: fase !== 'concluida' && (f.formadoresIds || []).length === 0,
  };

  switch (fase) {
    case 'concluida':
      return { ...base, data: fim, grupo: 'atrasado', quando: 'Concluída · falta arquivar', tom: 'feito' };
    case 'encerrada': {
      const n = differenceInCalendarDays(hoje, fim);
      return { ...base, data: fim, grupo: 'atrasado', quando: n === 1 ? 'Terminou ontem' : `Terminou há ${n} dias`, tom: 'atrasado' };
    }
    case 'acontecendo':
      return {
        ...base,
        data: inicio,
        grupo: 'hoje',
        quando: mesmoDia(fim, hoje) ? 'Acontecendo · termina hoje' : `Acontecendo · até ${diaDaSemana(fim)}`,
        tom: 'andamento',
      };
    default: {
      const n = differenceInCalendarDays(inicio, hoje);
      return {
        ...base,
        data: inicio,
        grupo: n <= JANELA_DIAS ? 'proximos' : 'adiante',
        quando: n === 1 ? 'Começa amanhã' : `Começa ${diaDaSemana(inicio)}`,
        tom: n === 1 ? 'atencao' : 'neutro',
      };
    }
  }
}

/** Avisos de logística ("confirmar hotel"): N dias antes do check-in de cada formador. */
function itensDaLogistica(f: Formacao, hoje: Date): ItemAgenda[] {
  const fase = faseDaFormacao(f, hoje);
  if (fase === 'arquivada' || fase === 'concluida') return [];

  return (f.logistica || []).flatMap((l, i) => {
    const checkin = paraData(l.checkin);
    if (!l.alertaLembrete || !l.diasLembrete || !checkin) return [];
    const data = addDays(checkin, -l.diasLembrete);
    return [
      {
        chave: `logistica:${f.id}:${i}`,
        tipo: 'logistica' as const,
        titulo: l.alertaLembrete,
        local: localDe(f),
        data,
        dias: [data],
        grupo: grupoPorData(data, hoje, false),
        ...quandoDoMarco(data, hoje, 'logistica'),
        formacaoId: f.id,
        detalhe: l.formadorNome ? `para ${l.formadorNome}` : undefined,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------

/** Os tipos de etapa que podem virar formação (no /calendario e no formulário do projeto). */
type EtapaComFormacao = 'devolutiva' | 'implantacao' | 'simulado';

interface Marco {
  rotulo: string;
  data: Date;
  etapa?: EtapaComFormacao;
  formacaoId?: string;
}

function marcosDoProjeto(p: ProjetoImplatancao): Marco[] {
  const marcos: Marco[] = [];
  const add = (rotulo: string, t: ComData, etapa?: EtapaComFormacao, formacaoId?: string) => {
    const data = paraData(t);
    if (data) marcos.push({ rotulo, data, etapa, formacaoId: formacaoId || undefined });
  };
  /** Início e fim no mesmo dia viram um marco só. */
  const periodo = (nome: string, ini: ComData, fim: ComData, etapa: EtapaComFormacao, formacaoId?: string) => {
    const di = paraData(ini);
    const df = paraData(fim);
    if (di && df && mesmoDia(di, df)) return add(nome, ini, etapa, formacaoId);
    add(`Início: ${nome}`, ini, etapa, formacaoId);
    add(`Fim: ${nome}`, fim, etapa, formacaoId);
  };

  add('Migração de dados', p.dataMigracao);

  // Implantação: sempre por implantacoesDoProjeto — três formatos convivem no banco.
  for (const imp of implantacoesDoProjeto(p)) {
    const vinculo = p.implantacoes?.[imp.indice]?.formacaoId || (imp.indice === 0 ? p.implantacaoFormacaoId : undefined);
    add(imp.titulo || 'Implantação', imp.dataInicio, 'implantacao', vinculo);
  }

  for (const n of [1, 2, 3, 4] as const) {
    const s = p.simulados?.[`s${n}`];
    if (s) periodo(`Simulado ${n}`, s.dataInicio, s.dataFim, 'simulado');
  }

  for (const n of [1, 2, 3, 4] as const) {
    const d = p.devolutivas?.[`d${n}`];
    if (!d) continue;
    // A d4 antiga gravava uma data só, no campo `data`.
    const legado = (d as { data?: Timestamp | null }).data;
    if (!d.dataInicio && legado) add(`Devolutiva ${n}`, legado, 'devolutiva', d.formacaoId);
    else periodo(`Devolutiva ${n}`, d.dataInicio, d.dataFim, 'devolutiva', d.formacaoId);
  }

  return marcos;
}

/**
 * O marco já está na tela como formação? Então não repete.
 *
 * Duas formas de vínculo existem no banco: o formulário do projeto grava o
 * `formacaoId` na etapa; o /calendario grava, na formação, o `projetoId` e o tipo
 * (`etapaCalendario`), sem dizer qual devolutiva é — daí comparar também o dia.
 * Substitui o filtro antigo por título ("devolutiva"), que escondia a formação.
 */
function formacaoCobreMarco(p: ProjetoImplatancao, m: Marco, formacoes: Formacao[], ids: ReadonlySet<string>): boolean {
  if (!m.etapa) return false;
  if (m.formacaoId && ids.has(m.formacaoId)) return true;
  return formacoes.some((f) => {
    if (f.projetoId !== p.id || f.etapaCalendario !== m.etapa) return false;
    const periodo = periodoDaFormacao(f);
    return (
      !!periodo &&
      differenceInCalendarDays(m.data, periodo.inicio) >= 0 &&
      differenceInCalendarDays(periodo.fim, m.data) >= 0
    );
  });
}

function itemDoMarco(p: ProjetoImplatancao, m: Marco, hoje: Date): ItemAgenda {
  const local = localDe(p);
  return {
    chave: `projeto:${p.id}:${m.rotulo}`,
    tipo: 'projeto',
    titulo: local ? `${m.rotulo} — ${local}` : m.rotulo,
    local: '',
    data: m.data,
    dias: [m.data],
    grupo: grupoPorData(m.data, hoje, false),
    ...quandoDoMarco(m.data, hoje, 'projeto'),
    projetoId: p.id,
    detalhe: p.versao ? `Projeto ${p.versao}` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Demandas e lembretes
// ---------------------------------------------------------------------------

function itemDaDemanda(d: Demanda, hoje: Date): ItemAgenda {
  const prazo = paraData(d.prazo);
  return {
    chave: `demanda:${d.id}`,
    tipo: 'demanda',
    titulo: d.demanda || 'Demanda sem descrição',
    local: localDe(d),
    data: prazo,
    dias: prazo ? [prazo] : [],
    grupo: grupoPorData(prazo, hoje, true),
    ...quandoDaDemanda(prazo, hoje),
    demandaId: d.id,
    responsavel: d.responsavelNome || undefined,
    urgente: d.prioridade === 'Urgente',
    automatica: d.origem === 'automatica',
  };
}

function itemDoLembrete(l: Lembrete, hoje: Date): ItemAgenda {
  const data = paraData(l.data);
  const autor = l.criadoPorNome?.trim().split(/\s+/)[0];
  return {
    chave: `lembrete:${l.id}`,
    tipo: 'lembrete',
    titulo: l.titulo,
    local: '',
    data,
    dias: data ? [data] : [],
    grupo: grupoPorData(data, hoje, true),
    ...(data ? quandoDoMarco(data, hoje, 'lembrete') : { quando: 'Sem data', tom: 'sem-prazo' as const }),
    lembreteId: l.id,
    detalhe: autor ? `lembrete de ${autor}` : 'lembrete',
  };
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/** Todos os itens, cada um já com coluna (`grupo`) e texto de prazo. */
export function montarAgenda(entrada: EntradaAgenda, hoje: Date, opcoes: OpcoesAgenda = {}): ItemAgenda[] {
  const recem = opcoes.recemConcluidas ?? new Set<string>();
  const ids = new Set(entrada.formacoes.map((f) => f.id));
  const itens: ItemAgenda[] = [];

  for (const f of entrada.formacoes) {
    const item = itemDaFormacao(f, hoje, recem);
    if (item) itens.push(item);
    itens.push(...itensDaLogistica(f, hoje));
  }

  for (const p of entrada.projetos) {
    for (const m of marcosDoProjeto(p)) {
      if (!formacaoCobreMarco(p, m, entrada.formacoes, ids)) itens.push(itemDoMarco(p, m, hoje));
    }
  }

  for (const d of entrada.demandas) {
    // A consulta já traz só as abertas; o filtro aqui protege quem chamar com outra lista.
    if (d.status === 'Concluída' || d.validado) continue;
    itens.push(itemDaDemanda(d, hoje));
  }

  for (const l of entrada.lembretes) {
    if (!l.concluido) itens.push(itemDoLembrete(l, hoje));
  }

  return itens;
}

const PESO_DO_TIPO: Record<TipoItem, number> = { formacao: 0, demanda: 1, lembrete: 2, logistica: 3, projeto: 4 };
const diaEmMs = (d: Date | null) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : Infinity);

/** Ordem cronológica por dia; no mesmo dia, urgente primeiro, depois formação, demanda... */
export function compararItens(a: ItemAgenda, b: ItemAgenda): number {
  const da = diaEmMs(a.data);
  const db = diaEmMs(b.data);
  if (da !== db) return da - db;
  if (!!a.urgente !== !!b.urgente) return a.urgente ? -1 : 1;
  if (PESO_DO_TIPO[a.tipo] !== PESO_DO_TIPO[b.tipo]) return PESO_DO_TIPO[a.tipo] - PESO_DO_TIPO[b.tipo];
  return a.titulo.localeCompare(b.titulo, 'pt-BR');
}

export type AgendaAgrupada = Record<Grupo, ItemAgenda[]>;

export function agruparAgenda(itens: ItemAgenda[]): AgendaAgrupada {
  const grupos: AgendaAgrupada = { atrasado: [], hoje: [], proximos: [], adiante: [], 'sem-prazo': [], passado: [] };
  for (const i of itens) grupos[i.grupo].push(i);
  for (const lista of Object.values(grupos)) lista.sort(compararItens);
  return grupos;
}

/** "Ontem": só para informação — marcos e avisos de ontem, que não pedem ação. */
export function itensDeOntem(itens: ItemAgenda[], hoje: Date): ItemAgenda[] {
  return itens
    .filter((i) => i.grupo === 'passado' && i.data && differenceInCalendarDays(i.data, hoje) === -1)
    .sort(compararItens);
}

/** O que ocupa um dia — para o calendário do mês. */
export function itensDoDia(itens: ItemAgenda[], dia: Date): ItemAgenda[] {
  return itens.filter((i) => i.dias.some((d) => mesmoDia(d, dia))).sort(compararItens);
}

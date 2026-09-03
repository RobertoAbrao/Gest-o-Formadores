/**
 * Fluxos do robô guiado (/agente).
 *
 * Declarativo de propósito: um fluxo é uma lista de passos, e cada passo diz
 * QUAL campo do formulário ele escreve. Nenhum passo grava direto no Firestore —
 * quem grava é o `FormProjeto`, pelo auto-save por etapa. Assim o robô e a edição
 * manual produzem exatamente o mesmo documento.
 */

import type { Formador } from '@/lib/types';
import type { EtapaProjeto, FormValues } from '@/components/projetos/projeto-form-schema';
import type { SecaoProjeto } from '@/components/projetos/form-projeto';

export type TipoPasso = 'chips' | 'multi' | 'data' | 'texto';

export interface OpcaoPasso {
  valor: string;
  rotulo: string;
  detalhe?: string;
}

/** Tudo que um passo precisa saber para se montar. */
export interface CtxWizard {
  values: FormValues;
  /** Formadores vinculados ao projeto (não todos do sistema). */
  formadoresDoProjeto: Formador[];
  todosFormadores: Formador[];
  /** Qual item do fluxo está sendo preenchido: devolutiva 1..4, índice da implantação, etc. */
  alvo: number;
}

export interface Passo {
  id: string;
  tipo: TipoPasso;
  pergunta: (ctx: CtxWizard) => string;
  /** Linha de apoio abaixo da pergunta. */
  ajuda?: (ctx: CtxWizard) => string | null;
  opcoes?: (ctx: CtxWizard) => OpcaoPasso[];
  /**
   * Mensagem quando não há opção nenhuma para escolher. Devolver texto aqui faz o
   * robô parar e oferecer saída, em vez de mostrar uma lista vazia.
   */
  semDados?: (ctx: CtxWizard) => string | null;
  /** Caminho do campo no formulário. Ausente = o passo não escreve nada. */
  campo?: (ctx: CtxWizard) => string;
  /** Converte a resposta da UI no valor que vai para o formulário. */
  valor?: (resposta: unknown, ctx: CtxWizard) => unknown;
  /** Passo que escolhe o alvo do fluxo (qual devolutiva, qual simulado). */
  defineAlvo?: boolean;
  opcional?: boolean;
  rotuloPular?: string;
  /** Ao pular, ainda escreve algo? Ex.: data fim vazia = mesmo dia da data início. */
  valorAoPular?: (ctx: CtxWizard) => unknown;
}

export interface Fluxo {
  id: string;
  rotulo: string;
  icone: string;
  /** Recorte que o auto-save grava a cada passo deste fluxo. */
  etapa: EtapaProjeto;
  /** Seção do formulário para onde rolar ao abrir a aba de conferência. */
  secao: SecaoProjeto;
  passos: Passo[];
  /** Cria o item antes de começar (implantação é append num array). Devolve o alvo. */
  criarAlvo?: (values: FormValues) => { alvo: number; append: Record<string, unknown> };
  /** Oferece criar/atualizar formação vinculada ao final. */
  formacaoVinculada?: 'devolutiva' | 'implantacao';
}

// ---------------------------------------------------------------------------
// Helpers de rótulo
// ---------------------------------------------------------------------------

const fmtData = (d: Date | null | undefined): string =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

/** Lê um caminho tipo "devolutivas.d1.dataInicio" dentro dos valores do formulário. */
export function lerCampo(values: unknown, caminho: string): unknown {
  return caminho.split('.').reduce<any>((acc, parte) => (acc == null ? acc : acc[parte]), values);
}

const nomesFormadores = (ctx: CtxWizard): OpcaoPasso[] =>
  ctx.formadoresDoProjeto.map((f) => ({ valor: f.nomeCompleto, rotulo: f.nomeCompleto, detalhe: f.uf }));

const semFormadores = (ctx: CtxWizard): string | null =>
  ctx.formadoresDoProjeto.length === 0
    ? 'Este projeto não tem formadores vinculados. Dá para seguir sem informar, ou vincular formadores primeiro no fluxo "Formadores do projeto".'
    : null;

/** Passos de data/formadores/detalhes repetem entre fluxos — montados por fábrica. */
function passosPeriodo(prefixo: (ctx: CtxWizard) => string, rotulo: string): Passo[] {
  return [
    {
      id: 'formadores',
      tipo: 'multi',
      pergunta: (ctx) => `Quais formadores em ${rotulo} ${ctx.alvo}?`,
      ajuda: () => 'Pode marcar mais de um.',
      opcoes: nomesFormadores,
      semDados: semFormadores,
      campo: (ctx) => `${prefixo(ctx)}.formadores`,
      valor: (resposta) => (Array.isArray(resposta) ? resposta : []),
      opcional: true,
      rotuloPular: 'Sem formadores definidos',
      valorAoPular: () => [],
    },
    {
      id: 'dataInicio',
      tipo: 'data',
      pergunta: (ctx) => `Data de início de ${rotulo} ${ctx.alvo}?`,
      campo: (ctx) => `${prefixo(ctx)}.dataInicio`,
      valor: (resposta) => resposta as Date,
    },
    {
      id: 'dataFim',
      tipo: 'data',
      pergunta: (ctx) => `Data de término de ${rotulo} ${ctx.alvo}?`,
      ajuda: (ctx) => {
        const inicio = lerCampo(ctx.values, `${prefixo(ctx)}.dataInicio`) as Date | null;
        return inicio ? `Início em ${fmtData(inicio)}.` : null;
      },
      campo: (ctx) => `${prefixo(ctx)}.dataFim`,
      valor: (resposta) => resposta as Date,
      opcional: true,
      rotuloPular: 'Termina no mesmo dia',
      valorAoPular: (ctx) => lerCampo(ctx.values, `${prefixo(ctx)}.dataInicio`),
    },
    {
      id: 'detalhes',
      tipo: 'texto',
      pergunta: () => 'Alguma observação? (opcional)',
      campo: (ctx) => `${prefixo(ctx)}.detalhes`,
      valor: (resposta) => String(resposta ?? ''),
      opcional: true,
      rotuloPular: 'Sem observação',
    },
  ];
}

// ---------------------------------------------------------------------------
// Fluxos
// ---------------------------------------------------------------------------

const chavesDevolutiva = [1, 2, 3, 4] as const;
const chavesSimulado = [1, 2, 3, 4] as const;

export const FLUXOS: Fluxo[] = [
  {
    id: 'devolutiva',
    rotulo: 'Devolutiva',
    icone: '📝',
    etapa: 'devolutivas',
    secao: 'devolutivas',
    formacaoVinculada: 'devolutiva',
    passos: [
      {
        id: 'qual',
        tipo: 'chips',
        defineAlvo: true,
        pergunta: () => 'Qual devolutiva?',
        opcoes: (ctx) =>
          chavesDevolutiva.map((n) => {
            const d = ctx.values.devolutivas?.[`d${n}` as 'd1'];
            const temData = !!d?.dataInicio;
            return {
              valor: String(n),
              rotulo: `D${n}`,
              detalhe: temData ? fmtData(d?.dataInicio) : 'sem dados',
            };
          }),
      },
      ...passosPeriodo((ctx) => `devolutivas.d${ctx.alvo}`, 'Devolutiva'),
    ],
  },
  {
    id: 'implantacao',
    rotulo: 'Implantação',
    icone: '🏗️',
    etapa: 'implantacoes',
    secao: 'implantacoes',
    formacaoVinculada: 'implantacao',
    criarAlvo: (values) => ({
      alvo: (values.implantacoes || []).length,
      append: {
        titulo: `Implantação ${(values.implantacoes || []).length + 1}`,
        dataInicio: null,
        dataFim: null,
        formadores: [],
        detalhes: '',
        formacaoId: '',
        anexosIds: [],
      },
    }),
    passos: [
      {
        id: 'titulo',
        tipo: 'texto',
        pergunta: (ctx) => `Título desta implantação? (será a ${ctx.alvo + 1}ª)`,
        campo: (ctx) => `implantacoes.${ctx.alvo}.titulo`,
        valor: (resposta) => String(resposta ?? ''),
        opcional: true,
        rotuloPular: 'Usar nome padrão',
        valorAoPular: (ctx) => `Implantação ${ctx.alvo + 1}`,
      },
      {
        id: 'formadores',
        tipo: 'multi',
        pergunta: () => 'Quais formadores nesta implantação?',
        ajuda: () => 'Pode marcar mais de um.',
        opcoes: nomesFormadores,
        semDados: semFormadores,
        campo: (ctx) => `implantacoes.${ctx.alvo}.formadores`,
        valor: (resposta) => (Array.isArray(resposta) ? resposta : []),
        opcional: true,
        rotuloPular: 'Sem formadores definidos',
        valorAoPular: () => [],
      },
      {
        id: 'dataInicio',
        tipo: 'data',
        pergunta: () => 'Data de início da implantação?',
        campo: (ctx) => `implantacoes.${ctx.alvo}.dataInicio`,
        valor: (resposta) => resposta as Date,
      },
      {
        id: 'dataFim',
        tipo: 'data',
        pergunta: () => 'Data de término da implantação?',
        campo: (ctx) => `implantacoes.${ctx.alvo}.dataFim`,
        valor: (resposta) => resposta as Date,
        opcional: true,
        rotuloPular: 'Termina no mesmo dia',
        valorAoPular: (ctx) => lerCampo(ctx.values, `implantacoes.${ctx.alvo}.dataInicio`),
      },
      {
        id: 'detalhes',
        tipo: 'texto',
        pergunta: () => 'Alguma observação? (opcional)',
        campo: (ctx) => `implantacoes.${ctx.alvo}.detalhes`,
        valor: (resposta) => String(resposta ?? ''),
        opcional: true,
        rotuloPular: 'Sem observação',
      },
    ],
  },
  {
    id: 'simulado',
    rotulo: 'Simulado',
    icone: '📊',
    etapa: 'simulados',
    secao: 'avaliacoes',
    passos: [
      {
        id: 'qual',
        tipo: 'chips',
        defineAlvo: true,
        pergunta: () => 'Qual simulado?',
        opcoes: (ctx) =>
          chavesSimulado.map((n) => {
            const s = ctx.values.simulados?.[`s${n}` as 's1'];
            return {
              valor: String(n),
              rotulo: `S${n}`,
              detalhe: s?.dataInicio ? fmtData(s.dataInicio) : 'sem dados',
            };
          }),
      },
      {
        id: 'dataInicio',
        tipo: 'data',
        pergunta: (ctx) => `Data de início do Simulado ${ctx.alvo}?`,
        campo: (ctx) => `simulados.s${ctx.alvo}.dataInicio`,
        valor: (resposta) => resposta as Date,
      },
      {
        id: 'dataFim',
        tipo: 'data',
        pergunta: (ctx) => `Data de término do Simulado ${ctx.alvo}?`,
        campo: (ctx) => `simulados.s${ctx.alvo}.dataFim`,
        valor: (resposta) => resposta as Date,
        opcional: true,
        rotuloPular: 'Termina no mesmo dia',
        valorAoPular: (ctx) => lerCampo(ctx.values, `simulados.s${ctx.alvo}.dataInicio`),
      },
      {
        id: 'ok',
        tipo: 'chips',
        pergunta: (ctx) => `O Simulado ${ctx.alvo} já foi concluído?`,
        opcoes: () => [
          { valor: 'sim', rotulo: '✅ Concluído' },
          { valor: 'nao', rotulo: '⏳ Ainda não' },
        ],
        campo: (ctx) => `simulados.s${ctx.alvo}.ok`,
        valor: (resposta) => resposta === 'sim',
      },
      {
        id: 'detalhes',
        tipo: 'texto',
        pergunta: () => 'Alguma observação? (opcional)',
        campo: (ctx) => `simulados.s${ctx.alvo}.detalhes`,
        valor: (resposta) => String(resposta ?? ''),
        opcional: true,
        rotuloPular: 'Sem observação',
      },
    ],
  },
  {
    id: 'diagnostica',
    rotulo: 'Diagnóstica',
    icone: '📅',
    etapa: 'diagnostica',
    secao: 'avaliacoes',
    passos: [
      {
        id: 'data',
        tipo: 'data',
        pergunta: () => 'Qual a data da avaliação diagnóstica?',
        campo: () => 'diagnostica.data',
        valor: (resposta) => resposta as Date,
      },
      {
        id: 'ok',
        tipo: 'chips',
        pergunta: () => 'A diagnóstica já foi concluída?',
        opcoes: () => [
          { valor: 'sim', rotulo: '✅ Concluída' },
          { valor: 'nao', rotulo: '⏳ Ainda não' },
        ],
        campo: () => 'diagnostica.ok',
        valor: (resposta) => resposta === 'sim',
      },
      {
        id: 'detalhes',
        tipo: 'texto',
        pergunta: () => 'Alguma observação? (opcional)',
        campo: () => 'diagnostica.detalhes',
        valor: (resposta) => String(resposta ?? ''),
        opcional: true,
        rotuloPular: 'Sem observação',
      },
    ],
  },
  {
    id: 'formadores',
    rotulo: 'Formadores do projeto',
    icone: '👥',
    etapa: 'formadores',
    secao: 'dados-gerais',
    passos: [
      {
        id: 'quais',
        tipo: 'multi',
        pergunta: () => 'Quais formadores atendem este projeto?',
        ajuda: (ctx) => `Mostrando formadores de ${ctx.values.uf || 'todos os estados'}.`,
        opcoes: (ctx) =>
          ctx.todosFormadores
            .filter((f) => !ctx.values.uf || f.uf === ctx.values.uf)
            .map((f) => ({ valor: f.id, rotulo: f.nomeCompleto, detalhe: f.uf })),
        semDados: (ctx) =>
          ctx.todosFormadores.filter((f) => !ctx.values.uf || f.uf === ctx.values.uf).length === 0
            ? `Nenhum formador cadastrado em ${ctx.values.uf || 'nenhum estado'}. Cadastre pela tela Formadores e volte aqui.`
            : null,
        campo: () => 'formadoresIds',
        valor: (resposta) => (Array.isArray(resposta) ? resposta : []),
      },
    ],
  },
];

export const acharFluxo = (id: string): Fluxo | undefined => FLUXOS.find((f) => f.id === id);

/**
 * Regras da ficha de divulgação (/ficha/[id]) — sem React, sem Firestore.
 *
 * O ponto delicado deste arquivo é a COMPATIBILIDADE com as fichas já gravadas em
 * `fichas_devolutivas/{formacaoId}`. O formato salvo (tipo `FichaDevolutiva`) continua o
 * mesmo de antes; o que mudou é como a tela o enxerga:
 *
 *   - Antes, formador real e "genérico" viviam em estados separados, e o link era casado
 *     com o formador PELO NOME. Mudar o nome ou tirar alguém da equipe deixava um link
 *     órfão que continuava saindo no impresso, sem botão para apagar.
 *   - Agora tudo vira uma lista só de `ParticipanteFicha` (deFichaSalva) e volta para o
 *     formato salvo em paraFichaSalva. Os links passam a gravar `formadorId`/`extraId`
 *     (campos opcionais, que a versão antiga simplesmente ignora); o casamento por nome
 *     só existe para ler fichas antigas.
 *
 * Se mexer em deFichaSalva/paraFichaSalva, teste abrindo uma ficha salva pela versão
 * anterior: ela precisa aparecer com os mesmos links, agendas e formadores a definir.
 */
import { differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Timestamp } from 'firebase/firestore';
import type { AgendaRow, FichaDevolutiva, Formacao, Formador, LinkOnline } from '@/lib/types';

export type Modalidade = 'online' | 'presencial';

/**
 * - equipe: está hoje em `formacao.formadoresIds`.
 * - extra: "formador a definir", criado na própria ficha (o antigo "formador genérico").
 * - fora: estava salvo na ficha, mas saiu da equipe. Fica guardado e aparece no editor
 *   para a pessoa remover; NUNCA sai no documento.
 */
export type TipoParticipante = 'equipe' | 'extra' | 'fora';

export interface ParticipanteFicha {
  /** equipe: id do formador; extra: id `generico_*` salvo; fora: `fora_<n>`. */
  key: string;
  tipo: TipoParticipante;
  formadorId?: string;
  nome: string;
  curriculo?: string;
  anoArea: string;
  linkUrl: string;
  agenda: AgendaRow[];
}

export interface FichaEditavel {
  modalidade: Modalidade;
  introducao: string;
  horario: string;
  endereco: string;
  participantes: ParticipanteFicha[];
  /**
   * Agendas salvas de formadores que saíram da equipe e não têm link salvo. Não aparecem
   * na tela, mas são regravadas: se a pessoa voltar para a equipe, a agenda volta junto.
   */
  agendasGuardadas: Record<string, AgendaRow[]>;
}

export interface DiaDoPeriodo {
  dia: string;
  /** dd/MM */
  data: string;
}

export interface Pendencia {
  /** falta: o documento sai incompleto. aviso: informação, não impede nada. */
  gravidade: 'falta' | 'aviso';
  texto: string;
  /** id do elemento do editor que resolve a pendência. */
  alvo?: string;
}

export const HORARIO_PADRAO = '19h00 às 20h30';

/** Ordem em que os dias aparecem quando não há período definido. */
export const DIAS_DA_SEMANA = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];

/** Índice = Date.getDay() (0 = domingo). */
const NOME_DO_DIA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/**
 * Endereço que a versão antiga punha em TODA ficha nova. Fichas salvas com ele em outro
 * município saem com o local errado; `pendenciasDaFicha` avisa quando encontra.
 */
const ENDERECO_ANTIGO_LEM = ['Pedro Paulo Corte Filho', 'Ângelo Bosa'];

/** Ids dos campos do editor, usados pelas pendências para levar a pessoa até o campo. */
export const ID = {
  introducao: 'ficha-introducao',
  horario: 'ficha-horario',
  endereco: 'ficha-endereco',
  addExtra: 'ficha-add-extra',
  card: (k: string) => `ficha-card-${k}`,
  nome: (k: string) => `ficha-nome-${k}`,
  anoArea: (k: string) => `ficha-anoarea-${k}`,
  link: (k: string) => `ficha-link-${k}`,
  addLinha: (k: string) => `ficha-add-linha-${k}`,
  dia: (k: string, i: number) => `ficha-dia-${k}-${i}`,
  hora: (k: string, i: number) => `ficha-hora-${k}-${i}`,
  area: (k: string, i: number) => `ficha-area-${k}-${i}`,
  qtd: (k: string, i: number) => `ficha-qtd-${k}-${i}`,
};

// ---------------------------------------------------------------------------
// Textos e datas
// ---------------------------------------------------------------------------

/**
 * Texto padrão da introdução. A troca de modalidade compara o texto atual com este para só
 * reescrever o que ainda não foi editado à mão — por isso o texto precisa continuar IGUAL ao
 * da versão anterior, senão fichas salvas deixam de ser reconhecidas como "texto padrão".
 */
export const montarIntroducao = (titulo: string, modalidade: Modalidade) => {
  const textoModalidade = modalidade === 'online' ? ' e os links de acesso' : '';
  return `Prezadas Diretoria de Formação e Equipe Pedagógica,
Informamos a agenda${textoModalidade} para a formação "${titulo}", conforme o cronograma abaixo.`;
};

const paraData = (t: Timestamp | null | undefined): Date | null => {
  if (!t) return null;
  try {
    return t.toDate();
  } catch {
    return null;
  }
};

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Dias do período da formação, para o seletor de dia e para a data ao lado do dia no
 * documento. A agenda guarda o DIA DA SEMANA (formato salvo); a data só é derivável sem
 * ambiguidade quando o período cabe em uma semana. Acima disso devolve lista vazia, e a
 * tela volta a oferecer os 7 dias, sem data.
 */
export function diasDoPeriodo(formacao: Pick<Formacao, 'dataInicio' | 'dataFim'>): DiaDoPeriodo[] {
  const inicio = paraData(formacao.dataInicio);
  if (!inicio) return [];
  const fim = paraData(formacao.dataFim) ?? inicio;
  if (fim < inicio) return [];

  const dias: DiaDoPeriodo[] = [];
  const d = startOfDay(inicio);
  const limite = startOfDay(fim);
  while (d <= limite) {
    if (dias.length === 7) return [];
    dias.push({ dia: NOME_DO_DIA[d.getDay()], data: format(d, 'dd/MM') });
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

export const periodoPassaDeUmaSemana = (formacao: Pick<Formacao, 'dataInicio' | 'dataFim'>) => {
  const inicio = paraData(formacao.dataInicio);
  const fim = paraData(formacao.dataFim);
  return !!inicio && !!fim && differenceInCalendarDays(fim, inicio) > 6;
};

/** "De 17 a 19 de novembro (terça a quinta-feira)", "Terça-feira, 17 de novembro" etc. */
export function formatarQuando(formacao: Pick<Formacao, 'dataInicio' | 'dataFim'>): string {
  const inicio = paraData(formacao.dataInicio);
  if (!inicio) return 'Data a confirmar';
  const fim = paraData(formacao.dataFim);

  if (!fim || isSameDay(inicio, fim)) {
    return capitalizar(format(inicio, "EEEE, d 'de' MMMM", { locale: ptBR }));
  }

  const mesmoMes = inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear();
  const faixa = mesmoMes
    ? `De ${format(inicio, 'd')} a ${format(fim, "d 'de' MMMM", { locale: ptBR })}`
    : `De ${format(inicio, "d 'de' MMMM", { locale: ptBR })} a ${format(fim, "d 'de' MMMM", { locale: ptBR })}`;

  if (differenceInCalendarDays(fim, inicio) > 6) return faixa;
  const primeiro = format(inicio, 'EEEE', { locale: ptBR }).replace('-feira', '');
  const ultimo = format(fim, 'EEEE', { locale: ptBR });
  return `${faixa} (${primeiro} a ${ultimo})`;
}

export const dataDoDia = (dia: string, periodo: DiaDoPeriodo[]) =>
  periodo.find((p) => p.dia === dia)?.data ?? '';

// ---------------------------------------------------------------------------
// Conversão: formato salvo <-> lista única da tela
// ---------------------------------------------------------------------------

export const linhaCompleta = (r: AgendaRow) => !!(r.dia && r.horario.trim());

/** A versão antiga criava uma linha vazia para cada formador; ela não carrega informação. */
const linhaVazia = (r: AgendaRow) => !r.dia && !r.horario?.trim() && !r.area?.trim() && !r.participantes;

const lerAgenda = (linhas: AgendaRow[] | undefined): AgendaRow[] =>
  (linhas ?? [])
    .filter((r) => !linhaVazia(r))
    .map((r) => ({
      dia: r.dia ?? '',
      horario: r.horario ?? '',
      area: r.area ?? '',
      // 0 era o valor padrão da versão antiga: na tela vira campo vazio.
      participantes: r.participantes ? r.participantes : undefined,
    }));

const gravarLinha = (r: AgendaRow): AgendaRow => ({
  dia: r.dia,
  horario: r.horario,
  area: r.area,
  participantes: r.participantes ?? 0,
});

const GENERICO_ANTIGO = /^Formador \d+$/;

type LinkSalvo = Omit<LinkOnline, 'id'>;

export function fichaNova(formacao: Formacao, formadores: Formador[]): FichaEditavel {
  return {
    modalidade: 'online',
    introducao: montarIntroducao(formacao.titulo, 'online'),
    horario: HORARIO_PADRAO,
    // Vazio de propósito: o local muda a cada formação.
    endereco: '',
    participantes: formadores.map((f) => ({
      key: f.id,
      tipo: 'equipe',
      formadorId: f.id,
      nome: f.nomeCompleto,
      curriculo: f.curriculo,
      anoArea: '',
      linkUrl: '',
      agenda: [],
    })),
    agendasGuardadas: {},
  };
}

/**
 * Monta a lista única a partir do que está salvo + a equipe ATUAL da formação.
 *
 * Ordem de casamento dos links: pelo id (fichas gravadas por esta versão) e, só se não
 * houver, pelo nome (fichas antigas). Link que não casa com ninguém da equipe vira
 * "formador a definir" se tiver cara de genérico antigo ("Formador 3"), e "fora da equipe"
 * nos demais casos — antes ele saía no impresso sem como ser apagado.
 */
export function deFichaSalva(
  salva: Partial<FichaDevolutiva> | null,
  formacao: Formacao,
  formadores: Formador[]
): FichaEditavel {
  if (!salva) return fichaNova(formacao, formadores);

  const modalidade: Modalidade = salva.modalidade === 'presencial' ? 'presencial' : 'online';
  const agendas = salva.agendas ?? {};
  const agendasGenericas = salva.agendasGenericas ?? {};
  const links: LinkSalvo[] = salva.links ?? [];
  const usados = new Set<number>();

  const pegarLink = (combina: (l: LinkSalvo) => boolean): LinkSalvo | undefined => {
    const i = links.findIndex((l, idx) => !usados.has(idx) && combina(l));
    if (i < 0) return undefined;
    usados.add(i);
    return links[i];
  };
  const semIdentidade = (l: LinkSalvo) => !l.formadorId && !l.extraId;

  const participantes: ParticipanteFicha[] = [];

  // 1. A equipe de hoje, na ordem da formação.
  for (const f of formadores) {
    const link =
      pegarLink((l) => l.formadorId === f.id) ??
      pegarLink((l) => semIdentidade(l) && l.formadorNome === f.nomeCompleto);
    participantes.push({
      key: f.id,
      tipo: 'equipe',
      formadorId: f.id,
      nome: f.nomeCompleto,
      curriculo: f.curriculo,
      anoArea: link?.anoArea ?? '',
      linkUrl: link?.linkUrl ?? '',
      agenda: lerAgenda(agendas[f.id]),
    });
  }

  // 2. Formadores a definir (no formato salvo: formadoresGenericos + agendasGenericas).
  for (const g of salva.formadoresGenericos ?? []) {
    const link =
      pegarLink((l) => l.extraId === g.id) ?? pegarLink((l) => semIdentidade(l) && l.formadorNome === g.nome);
    participantes.push({
      key: g.id,
      tipo: 'extra',
      nome: g.nome,
      anoArea: link?.anoArea ?? '',
      linkUrl: link?.linkUrl ?? '',
      agenda: lerAgenda(agendasGenericas[g.id]),
    });
  }

  // 3. Links que sobraram. Os "fora da equipe" vão sempre para o fim da lista (comExtraNovo
  // conta com isso para inserir o formador novo antes deles).
  const foraDaEquipe: ParticipanteFicha[] = [];
  links.forEach((l, i) => {
    if (usados.has(i)) return;
    if (l.extraId || (!l.formadorId && GENERICO_ANTIGO.test(l.formadorNome))) {
      // Genérico antigo só do modo online: nunca teve agenda.
      participantes.push({
        key: l.extraId ?? `generico_link_${i}`,
        tipo: 'extra',
        nome: l.formadorNome,
        anoArea: l.anoArea ?? '',
        linkUrl: l.linkUrl ?? '',
        agenda: [],
      });
      return;
    }
    // Linha vazia de quem saiu da equipe: não há o que perder.
    if (!l.anoArea?.trim() && !l.linkUrl?.trim()) return;
    const fora: ParticipanteFicha = {
      key: `fora_${i}`,
      tipo: 'fora',
      nome: l.formadorNome,
      anoArea: l.anoArea ?? '',
      linkUrl: l.linkUrl ?? '',
      agenda: l.formadorId ? lerAgenda(agendas[l.formadorId]) : [],
    };
    if (l.formadorId) fora.formadorId = l.formadorId;
    foraDaEquipe.push(fora);
  });
  participantes.push(...foraDaEquipe);

  // 4. Agendas de quem saiu e não tinha link: ficam guardadas, fora da tela.
  const comAgendaNaTela = new Set(participantes.map((p) => p.formadorId).filter(Boolean));
  const agendasGuardadas = Object.fromEntries(
    Object.entries(agendas).filter(([id, linhas]) => !comAgendaNaTela.has(id) && lerAgenda(linhas).length > 0)
  );

  return {
    modalidade,
    introducao: salva.introducao ?? montarIntroducao(formacao.titulo, modalidade),
    horario: salva.horario ?? HORARIO_PADRAO,
    endereco: salva.endereco ?? '',
    participantes,
    agendasGuardadas,
  };
}

/**
 * Volta para o formato salvo. Gravado SEM merge (ver use-ficha.ts): com merge, o Firestore
 * mescla mapas aninhados e a chave de um formador a definir removido nunca saía do banco.
 * Nenhum campo pode ser `undefined` — o Firestore deste projeto rejeita.
 */
export function paraFichaSalva(f: FichaEditavel, formacaoId: string): Omit<FichaDevolutiva, 'id' | 'lastUpdated'> {
  const agendas: Record<string, AgendaRow[]> = {};
  for (const [id, linhas] of Object.entries(f.agendasGuardadas)) agendas[id] = linhas.map(gravarLinha);
  for (const p of f.participantes) {
    if (p.tipo !== 'extra' && p.formadorId) agendas[p.formadorId] = p.agenda.map(gravarLinha);
  }

  const extras = f.participantes.filter((p) => p.tipo === 'extra');

  const links: LinkSalvo[] = f.participantes.map((p) => {
    const link: LinkSalvo = { formadorNome: p.nome, anoArea: p.anoArea, linkUrl: p.linkUrl };
    if (p.tipo === 'extra') link.extraId = p.key;
    else if (p.formadorId) link.formadorId = p.formadorId;
    return link;
  });

  return {
    formacaoId,
    modalidade: f.modalidade,
    introducao: f.introducao,
    horario: f.horario,
    endereco: f.endereco,
    agendas,
    agendasGenericas: Object.fromEntries(extras.map((p) => [p.key, p.agenda.map(gravarLinha)])),
    formadoresGenericos: extras.map((p) => ({ id: p.key, nome: p.nome })),
    links,
  };
}

// ---------------------------------------------------------------------------
// Edição (funções puras: recebem a ficha e devolvem outra)
// ---------------------------------------------------------------------------

type CampoTexto = 'introducao' | 'horario' | 'endereco';

export const comCampo = (f: FichaEditavel, campo: CampoTexto, valor: string): FichaEditavel => ({
  ...f,
  [campo]: valor,
});

/** Troca a modalidade; a introdução só é reescrita se ainda for o texto padrão. */
export function comModalidade(f: FichaEditavel, nova: Modalidade, titulo: string): FichaEditavel {
  if (nova === f.modalidade) return f;
  const introducao =
    f.introducao === montarIntroducao(titulo, f.modalidade) ? montarIntroducao(titulo, nova) : f.introducao;
  return { ...f, modalidade: nova, introducao };
}

export const comParticipante = (
  f: FichaEditavel,
  key: string,
  patch: Partial<Pick<ParticipanteFicha, 'nome' | 'anoArea' | 'linkUrl'>>
): FichaEditavel => ({
  ...f,
  participantes: f.participantes.map((p) => (p.key === key ? { ...p, ...patch } : p)),
});

export const comLinha = (f: FichaEditavel, key: string, indice: number, patch: Partial<AgendaRow>): FichaEditavel => ({
  ...f,
  participantes: f.participantes.map((p) =>
    p.key === key ? { ...p, agenda: p.agenda.map((r, i) => (i === indice ? { ...r, ...patch } : r)) } : p
  ),
});

/** Nova linha já com o próximo dia livre do período e o horário geral. */
export function comLinhaNova(f: FichaEditavel, key: string, periodo: DiaDoPeriodo[]): FichaEditavel {
  return {
    ...f,
    participantes: f.participantes.map((p) => {
      if (p.key !== key) return p;
      const usados = new Set(p.agenda.map((r) => r.dia));
      const livre = periodo.find((d) => !usados.has(d.dia)) ?? periodo[0];
      return { ...p, agenda: [...p.agenda, { dia: livre?.dia ?? '', horario: f.horario, area: '' }] };
    }),
  };
}

export const semLinha = (f: FichaEditavel, key: string, indice: number): FichaEditavel => ({
  ...f,
  participantes: f.participantes.map((p) =>
    p.key === key ? { ...p, agenda: p.agenda.filter((_, i) => i !== indice) } : p
  ),
});

/** Mesmo prefixo da versão anterior (`generico_`), para os ids salvos continuarem iguais. */
export const novaChaveExtra = () => `generico_${Date.now()}`;

/** Formador a definir entra depois dos que já estão ativos (antes dos "fora da equipe"). */
export function comExtraNovo(f: FichaEditavel, periodo: DiaDoPeriodo[], key: string): FichaEditavel {
  const novo: ParticipanteFicha = {
    key,
    tipo: 'extra',
    nome: 'A definir',
    anoArea: '',
    linkUrl: '',
    agenda: [{ dia: periodo[0]?.dia ?? '', horario: f.horario, area: '' }],
  };
  const posicao = f.participantes.filter((p) => p.tipo !== 'fora').length;
  const participantes = [...f.participantes];
  participantes.splice(posicao, 0, novo);
  return { ...f, participantes };
}

export function semParticipante(
  f: FichaEditavel,
  key: string
): { ficha: FichaEditavel; removido?: ParticipanteFicha; indice: number } {
  const indice = f.participantes.findIndex((p) => p.key === key);
  if (indice < 0) return { ficha: f, indice };
  return {
    ficha: { ...f, participantes: f.participantes.filter((p) => p.key !== key) },
    removido: f.participantes[indice],
    indice,
  };
}

export function comParticipanteDeVolta(f: FichaEditavel, p: ParticipanteFicha, indice: number): FichaEditavel {
  if (f.participantes.some((x) => x.key === p.key)) return f;
  const participantes = [...f.participantes];
  participantes.splice(Math.min(indice, participantes.length), 0, p);
  return { ...f, participantes };
}

// ---------------------------------------------------------------------------
// Documento e pendências
// ---------------------------------------------------------------------------

export const participantesAtivos = (f: FichaEditavel) => f.participantes.filter((p) => p.tipo !== 'fora');

export interface DiaDoCronograma {
  dia: string;
  data: string;
  entradas: (AgendaRow & { formador: string })[];
}

/**
 * Cronograma geral do modo presencial: só linhas com dia E horário. A ordem dos dias segue
 * o período da formação (uma formação de sexta a segunda começa na sexta); dias salvos
 * fora do período vão para o fim.
 */
export function cronogramaGeral(f: FichaEditavel, periodo: DiaDoPeriodo[]): DiaDoCronograma[] {
  const ordem = periodo.length
    ? [...periodo.map((p) => p.dia), ...DIAS_DA_SEMANA.filter((d) => !periodo.some((p) => p.dia === d))]
    : DIAS_DA_SEMANA;

  const entradas = participantesAtivos(f).flatMap((p) =>
    p.agenda.filter(linhaCompleta).map((r) => ({ ...r, formador: p.nome.trim() || 'A definir' }))
  );

  return ordem
    .map((dia) => ({
      dia,
      data: dataDoDia(dia, periodo),
      entradas: entradas
        .filter((e) => e.dia === dia)
        .sort((a, b) => a.horario.localeCompare(b.horario, 'pt-BR', { numeric: true })),
    }))
    .filter((d) => d.entradas.length > 0);
}

const pareceLink = (v: string) => /^https?:\/\/\S+$/.test(v.trim());
export const linkInvalido = (v: string) => !!v.trim() && !pareceLink(v);

/** O que falta antes de enviar. Recalculado a cada edição; nada disso é gravado. */
export function pendenciasDaFicha(f: FichaEditavel, formacao: Formacao, periodo: DiaDoPeriodo[]): Pendencia[] {
  const presencial = f.modalidade === 'presencial';
  const ativos = participantesAtivos(f);
  const nomeDe = (p: ParticipanteFicha) => p.nome.trim() || 'Formador sem nome';
  const out: Pendencia[] = [];

  if (!formacao.dataInicio) {
    out.push({
      gravidade: 'aviso',
      texto: 'A formação não tem data de início. O documento sai com "Data a confirmar". Para mudar, edite a formação no quadro.',
    });
  } else if (presencial && periodoPassaDeUmaSemana(formacao)) {
    out.push({
      gravidade: 'aviso',
      texto: 'A formação dura mais de uma semana, então os dias da agenda saem sem a data ao lado.',
    });
  }

  if (!f.horario.trim()) out.push({ gravidade: 'falta', texto: 'Preencha o horário geral', alvo: ID.horario });

  if (ativos.length === 0) {
    out.push({
      gravidade: 'falta',
      texto: 'Esta formação não tem formadores. Cadastre a equipe na formação ou adicione um formador a definir.',
      alvo: ID.addExtra,
    });
  }

  if (presencial) {
    if (!f.endereco.trim()) {
      out.push({ gravidade: 'falta', texto: 'Preencha o endereço do encontro', alvo: ID.endereco });
    } else if (
      ENDERECO_ANTIGO_LEM.some((trecho) => f.endereco.includes(trecho)) &&
      !/lu[ií]s eduardo/i.test(formacao.municipio ?? '')
    ) {
      out.push({
        gravidade: 'falta',
        texto: 'O endereço é o padrão antigo de Luís Eduardo Magalhães – BA. Troque pelo local desta formação.',
        alvo: ID.endereco,
      });
    }

    for (const p of ativos) {
      const iIncompleta = p.agenda.findIndex((r) => !linhaCompleta(r));
      if (iIncompleta >= 0) {
        const qtd = p.agenda.filter((r) => !linhaCompleta(r)).length;
        const r = p.agenda[iIncompleta];
        out.push({
          gravidade: 'falta',
          texto:
            qtd === 1
              ? `${nomeDe(p)}: um horário está sem ${r.dia ? 'hora' : 'dia'} e não entra no cronograma`
              : `${nomeDe(p)}: ${qtd} horários estão incompletos e não entram no cronograma`,
          alvo: r.dia ? ID.hora(p.key, iIncompleta) : ID.dia(p.key, iIncompleta),
        });
      } else if (p.agenda.length === 0) {
        out.push({ gravidade: 'falta', texto: `${nomeDe(p)} ainda não tem horário na agenda`, alvo: ID.addLinha(p.key) });
      }
    }
  } else {
    for (const p of ativos) {
      if (!p.linkUrl.trim()) out.push({ gravidade: 'falta', texto: `Link do Meet vazio: ${nomeDe(p)}`, alvo: ID.link(p.key) });
      else if (!pareceLink(p.linkUrl))
        out.push({ gravidade: 'falta', texto: `O link de ${nomeDe(p)} não parece um endereço`, alvo: ID.link(p.key) });
      if (!p.anoArea.trim()) out.push({ gravidade: 'falta', texto: `Ano/Área vazio: ${nomeDe(p)}`, alvo: ID.anoArea(p.key) });
    }
  }

  for (const p of ativos) {
    if (p.tipo === 'extra' && !p.nome.trim()) {
      out.push({ gravidade: 'falta', texto: 'Dê um nome ao formador a definir, ou escreva "A definir"', alvo: ID.nome(p.key) });
    }
  }
  for (const p of ativos) {
    if (p.tipo === 'equipe' && !p.curriculo?.trim()) {
      out.push({
        gravidade: 'aviso',
        texto: `${p.nome} não tem currículo no cadastro, então o documento sai sem ele`,
        alvo: ID.card(p.key),
      });
    }
  }
  for (const p of f.participantes) {
    if (p.tipo === 'fora') {
      out.push({
        gravidade: 'aviso',
        texto: `${p.nome} saiu da equipe. O que estava salvo para ele não sai no documento`,
        alvo: ID.card(p.key),
      });
    }
  }

  return out;
}

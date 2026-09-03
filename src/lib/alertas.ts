/**
 * Regras de alerta do Acompanhamento.
 *
 * Ficam isoladas aqui, como funções puras, por dois motivos: são REGRA DE NEGÓCIO
 * (mudam quando a coordenação muda de ideia, não quando o código muda), e assim dá
 * para conferir cada uma sem abrir a tela.
 *
 * Definições acertadas com a coordenação:
 *  - atrasado: passou da data de fim e não foi concluída;
 *  - atrasado: passou da data de início e ainda está em preparação;
 *  - falta preencher: etapa do projeto sem data nenhuma;
 *  - falta preencher: formação com data e sem formadores;
 *  - próximo de atrasar: começa em até 7 dias (mesma janela da demanda automática).
 */

import { differenceInCalendarDays, startOfToday } from 'date-fns';
import type { Formacao, ProjetoImplatancao } from '@/lib/types';

/** Antecedência do aviso de "vai atrasar". Espelha o prazo da demanda automática. */
export const DIAS_DE_ANTECEDENCIA = 7;

export type Gravidade = 'atrasado' | 'atencao' | 'incompleto';

export interface Alerta {
  gravidade: Gravidade;
  /** Texto curto, para caber no card. */
  texto: string;
  /** Chave estável, para agrupar e contar sem depender do texto. */
  motivo:
    | 'fim-vencido'
    | 'inicio-vencido'
    | 'comeca-em-breve'
    | 'sem-formadores'
    | 'etapa-sem-data';
}

const paraData = (t: { toDate: () => Date } | null | undefined): Date | null => {
  if (!t) return null;
  try {
    return t.toDate();
  } catch {
    return null;
  }
};

const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos);

// ---------------------------------------------------------------------------
// Formações (o que o quadro mostra)
// ---------------------------------------------------------------------------

/**
 * Alertas de uma formação. `hoje` é injetado para o cálculo ser determinístico —
 * sem isso não dá para testar nem para explicar por que um card acendeu.
 */
export function alertasDaFormacao(f: Formacao, hoje: Date = startOfToday()): Alerta[] {
  const alertas: Alerta[] = [];

  // Concluída ou arquivada não atrasa mais: o trabalho acabou.
  const encerrada = f.status === 'concluido' || f.status === 'arquivado';

  const inicio = paraData(f.dataInicio as any);
  const fim = paraData(f.dataFim as any);

  if (!encerrada && fim) {
    const dias = differenceInCalendarDays(hoje, fim);
    if (dias > 0) {
      alertas.push({
        gravidade: 'atrasado',
        motivo: 'fim-vencido',
        texto: `Terminou há ${dias} ${plural(dias, 'dia', 'dias')} e não foi concluída`,
      });
    }
  }

  if (!encerrada && inicio && f.status === 'preparacao') {
    const dias = differenceInCalendarDays(hoje, inicio);
    if (dias > 0) {
      alertas.push({
        gravidade: 'atrasado',
        motivo: 'inicio-vencido',
        texto: `Deveria ter começado há ${dias} ${plural(dias, 'dia', 'dias')}`,
      });
    }
  }

  if (!encerrada && inicio) {
    const faltam = differenceInCalendarDays(inicio, hoje);
    if (faltam >= 0 && faltam <= DIAS_DE_ANTECEDENCIA) {
      alertas.push({
        gravidade: 'atencao',
        motivo: 'comeca-em-breve',
        texto: faltam === 0 ? 'Começa hoje' : `Começa em ${faltam} ${plural(faltam, 'dia', 'dias')}`,
      });
    }
  }

  if (!encerrada && (f.formadoresIds || []).length === 0) {
    alertas.push({
      gravidade: 'incompleto',
      motivo: 'sem-formadores',
      texto: 'Sem formadores definidos',
    });
  }

  return alertas;
}

// ---------------------------------------------------------------------------
// Projetos (o que ainda nem virou formação)
// ---------------------------------------------------------------------------

export interface PendenciaProjeto {
  projetoId: string;
  projetoNome: string;
  etapa: string;
  texto: string;
}

/**
 * Etapas do projeto que ninguém agendou.
 *
 * Isto NÃO é atraso de execução — é buraco de planejamento. Uma devolutiva sem data
 * não aparece no quadro (o quadro lê `formacoes`, e sem data não há formação), então
 * seria invisível se não fosse listada à parte.
 */
export function pendenciasDoProjeto(p: ProjetoImplatancao): PendenciaProjeto[] {
  const nome = `${p.municipio}/${p.uf}`;
  const pendencias: PendenciaProjeto[] = [];

  if (!p.diagnostica?.data) {
    pendencias.push({ projetoId: p.id, projetoNome: nome, etapa: 'Diagnóstica', texto: 'sem data' });
  }

  ([1, 2, 3, 4] as const).forEach((n) => {
    const s = p.simulados?.[`s${n}` as 's1'];
    if (!s?.dataInicio) {
      pendencias.push({ projetoId: p.id, projetoNome: nome, etapa: `Simulado ${n}`, texto: 'sem data' });
    }
  });

  ([1, 2, 3, 4] as const).forEach((n) => {
    const d = p.devolutivas?.[`d${n}` as 'd1'];
    if (!d?.dataInicio) {
      pendencias.push({ projetoId: p.id, projetoNome: nome, etapa: `Devolutiva ${n}`, texto: 'sem data' });
    }
  });

  if ((p.implantacoes || []).length === 0) {
    pendencias.push({ projetoId: p.id, projetoNome: nome, etapa: 'Implantação', texto: 'nenhuma cadastrada' });
  }

  if ((p.formadoresIds || []).length === 0) {
    pendencias.push({ projetoId: p.id, projetoNome: nome, etapa: 'Formadores', texto: 'nenhum vinculado' });
  }

  return pendencias;
}

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

export interface ResumoAlertas {
  atrasadas: number;
  atencao: number;
  incompletas: number;
  pendenciasDeProjeto: number;
}

export function resumirAlertas(
  formacoes: Formacao[],
  projetos: ProjetoImplatancao[],
  hoje: Date = startOfToday()
): ResumoAlertas {
  let atrasadas = 0;
  let atencao = 0;
  let incompletas = 0;

  for (const f of formacoes) {
    const a = alertasDaFormacao(f, hoje);
    // Uma formação conta uma vez por gravidade, não uma vez por alerta:
    // "atrasada há 3 dias e sem formadores" é UM card com problema, não dois.
    if (a.some((x) => x.gravidade === 'atrasado')) atrasadas++;
    else if (a.some((x) => x.gravidade === 'atencao')) atencao++;
    else if (a.some((x) => x.gravidade === 'incompleto')) incompletas++;
  }

  const pendenciasDeProjeto = projetos.reduce((soma, p) => soma + pendenciasDoProjeto(p).length, 0);

  return { atrasadas, atencao, incompletas, pendenciasDeProjeto };
}

export const CORES_GRAVIDADE: Record<Gravidade, string> = {
  atrasado: 'border-destructive/50 bg-destructive/10 text-destructive',
  atencao: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-500',
  incompleto: 'border-muted-foreground/30 bg-muted text-muted-foreground',
};

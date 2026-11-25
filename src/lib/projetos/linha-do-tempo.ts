import type { Timestamp } from 'firebase/firestore';
import type { Anexo, ProjetoImplatancao } from '@/lib/types';
import { anexosDaImplantacao, implantacoesDoProjeto } from './implantacoes';

export type TipoMarco =
  | 'migracao'
  | 'implantacao'
  | 'diagnostica'
  | 'simulado'
  | 'devolutiva'
  | 'evento'
  | 'dossie'
  | 'concluido';

export interface MarcoLinhaDoTempo {
  tipo: TipoMarco;
  titulo: string;
  data?: string;
  descricao: { formadores: string; detalhes: string };
  anexos: Anexo[];
  concluido: boolean;
  /** Posição na linha do tempo. Marco sem data não entra. */
  ordem: Date;
  dossieUrl?: string;
}

export const formatarData = (ts: Timestamp | null | undefined): string =>
  ts ? ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';

/** Fim dos tempos: o marco final fica sempre por último. */
const DEPOIS_DE_TUDO = new Date(8640000000000000);

/**
 * Os marcos da linha do tempo do projeto (/projeto-relatorio/[id]), já em ordem.
 * Só entram etapas com data; havendo alguma, fecha com "Dossiê" ou "Projeto Concluído".
 */
export function montarLinhaDoTempo(projeto: ProjetoImplatancao, anexos: Anexo[]): MarcoLinhaDoTempo[] {
  const daEtapa = (etapa: string) => anexos.filter((a) => a.etapa === etapa);

  const descricaoDevolutiva = (k: 'd1' | 'd2' | 'd3' | 'd4') => {
    const d = projeto.devolutivas?.[k];
    if (!d) return { formadores: '', detalhes: '' };
    const formadores = d.formadores && d.formadores.length > 0 ? `Formadores: ${d.formadores.join(', ')}` : '';
    return { formadores, detalhes: d.detalhes || '' };
  };

  // Uma por implantação, nos três formatos do banco (ver implantacoes.ts). Até 25/11/2026
  // isto lia `dataImplantacao`, que o form não grava desde 03/2026 — e a etapa sumia.
  const listaImplantacoes = implantacoesDoProjeto(projeto);
  const marcosDeImplantacao = listaImplantacoes.map((imp) => ({
    tipo: 'implantacao' as const,
    titulo: imp.titulo || (listaImplantacoes.length > 1 ? `Implantação ${imp.indice + 1}` : 'Implantação do Sistema'),
    data: imp.dataFim
      ? `De ${formatarData(imp.dataInicio)} a ${formatarData(imp.dataFim)}`
      : formatarData(imp.dataInicio),
    descricao: { formadores: '', detalhes: imp.detalhes },
    anexos: anexosDaImplantacao(anexos, imp),
    concluido: !!imp.dataInicio,
    ordem: imp.dataInicio?.toDate(),
  }));

  const candidatos: Array<Omit<MarcoLinhaDoTempo, 'ordem'> & { ordem?: Date }> = [
    {
      tipo: 'migracao',
      titulo: 'Migração de Dados',
      data: formatarData(projeto.dataMigracao),
      descricao: { formadores: '', detalhes: '' },
      anexos: daEtapa('migracao'),
      concluido: !!projeto.dataMigracao,
      ordem: projeto.dataMigracao?.toDate(),
    },
    ...marcosDeImplantacao,
    {
      tipo: 'diagnostica',
      titulo: 'Avaliação Diagnóstica',
      data: formatarData(projeto.diagnostica?.data),
      descricao: { formadores: '', detalhes: projeto.diagnostica?.detalhes || '' },
      anexos: daEtapa('diagnostica'),
      concluido: !!projeto.diagnostica?.ok,
      ordem: projeto.diagnostica?.data?.toDate(),
    },
    ...([1, 2, 3, 4] as const).map((i) => {
      const s = projeto.simulados?.[`s${i}`];
      return {
        tipo: 'simulado' as const,
        titulo: `Simulado ${i}`,
        data: `De ${formatarData(s?.dataInicio)} a ${formatarData(s?.dataFim)}`,
        descricao: { formadores: '', detalhes: s?.detalhes || '' },
        anexos: daEtapa(`simulados.s${i}`),
        concluido: !!s?.ok,
        ordem: s?.dataInicio?.toDate(),
      };
    }),
    ...([1, 2, 3, 4] as const).map((i) => {
      const d = projeto.devolutivas?.[`d${i}`];
      return {
        tipo: 'devolutiva' as const,
        titulo: `Devolutiva ${i}`,
        data: `De ${formatarData(d?.dataInicio)} a ${formatarData(d?.dataFim)}`,
        descricao: descricaoDevolutiva(`d${i}`),
        anexos: daEtapa(`devolutivas.d${i}`),
        concluido: !!d?.ok,
        ordem: d?.dataInicio?.toDate(),
      };
    }),
    ...(projeto.eventosAdicionais || []).map((evento) => ({
      tipo: 'evento' as const,
      titulo: evento.titulo,
      data: formatarData(evento.data),
      descricao: { formadores: '', detalhes: evento.detalhes || '' },
      anexos: anexos.filter((a) => evento.anexosIds?.includes(a.id || '')),
      concluido: true, // evento adicional conta como realizado
      ordem: evento.data?.toDate(),
    })),
  ];

  const marcos = candidatos
    .filter((m): m is MarcoLinhaDoTempo => !!m.ordem)
    .sort((a, b) => a.ordem.getTime() - b.ordem.getTime());

  if (marcos.length > 0) {
    marcos.push(
      projeto.dossieUrl
        ? {
            tipo: 'dossie',
            titulo: 'Dossiê Completo',
            descricao: { formadores: '', detalhes: '' },
            anexos: [],
            concluido: true,
            dossieUrl: projeto.dossieUrl,
            ordem: DEPOIS_DE_TUDO,
          }
        : {
            tipo: 'concluido',
            titulo: 'Projeto Concluído',
            descricao: { formadores: '', detalhes: 'Todas as etapas foram finalizadas com sucesso.' },
            anexos: [],
            concluido: true,
            ordem: DEPOIS_DE_TUDO,
          },
    );
  }
  return marcos;
}

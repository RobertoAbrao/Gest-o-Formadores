import type { Timestamp } from 'firebase/firestore';
import type { Anexo, ProjetoImplatancao } from '@/lib/types';

/**
 * As implantações de um projeto — a ÚNICA porta de leitura delas.
 *
 * Três formatos convivem no banco, conforme a época em que o projeto foi salvo:
 *  1. `implantacoes: [...]`                       — formato atual (lista).
 *  2. `dataInicioImplantacao`/`dataFimImplantacao` — 03/2026; o form ainda grava a 1ª
 *     implantação aqui também, por retrocompatibilidade.
 *  3. `dataImplantacao`                           — antes de 03/2026. Saiu do tipo
 *     (por isso o cast abaixo), mas projeto não editado desde então ainda o tem.
 *
 * Por que existe: quando o 3 virou 2 e depois 1, seis telas continuaram lendo o nome
 * antigo — a linha do tempo, os detalhes, o dashboard, a agenda, a planilha e a lista
 * de projetos — e a Implantação sumiu delas sem erro nenhum (achado em 25/11/2026).
 * Tela nova lê daqui, não dos campos.
 */
export interface Implantacao {
  /** Posição em `implantacoes` — é o N da etapa `implantacoes.N` dos anexos. */
  indice: number;
  titulo: string;
  dataInicio: Timestamp | null;
  dataFim: Timestamp | null;
  detalhes: string;
  anexosIds: string[];
}

export function implantacoesDoProjeto(projeto: ProjetoImplatancao): Implantacao[] {
  if (projeto.implantacoes && projeto.implantacoes.length > 0) {
    return projeto.implantacoes.map((imp, indice) => ({
      indice,
      titulo: imp.titulo || '',
      dataInicio: imp.dataInicio ?? null,
      dataFim: imp.dataFim ?? null,
      detalhes: imp.detalhes || '',
      anexosIds: imp.anexosIds || [],
    }));
  }

  const legado = (projeto as { dataImplantacao?: Timestamp | null }).dataImplantacao ?? null;
  const dataInicio = projeto.dataInicioImplantacao ?? legado;
  if (!dataInicio && !projeto.dataFimImplantacao && !projeto.implantacaoDetalhes) return [];

  return [
    {
      indice: 0,
      titulo: '',
      dataInicio,
      dataFim: projeto.dataFimImplantacao ?? null,
      detalhes: projeto.implantacaoDetalhes || '',
      anexosIds: projeto.implantacaoAnexosIds || [],
    },
  ];
}

/**
 * Anexos de uma implantação. Acha pelos dois caminhos, sem repetir:
 *  - pela etapa gravada no anexo (`implantacoes.N`; a 1ª também `implantacao`, nome
 *    antigo) — vale assim que o upload termina;
 *  - pelos ids em `anexosIds` — que só entram quando alguém clica em Salvar no projeto.
 */
export function anexosDaImplantacao(anexos: Anexo[], imp: Implantacao): Anexo[] {
  const etapas = imp.indice === 0 ? ['implantacoes.0', 'implantacao'] : [`implantacoes.${imp.indice}`];
  return anexos.filter(
    (a) => (!!a.etapa && etapas.includes(a.etapa)) || (!!a.id && imp.anexosIds.includes(a.id)),
  );
}

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Demanda, Formacao, ProjetoImplatancao } from '@/lib/types';
import { alertasDaFormacao, pendenciasDoProjeto, type Alerta, type Gravidade } from '@/lib/alertas';
import { faseDaFormacao } from '@/lib/fase-formacao';
import { QUEUES, getSla, type QueueId } from '@/components/diario/diario-utils';
import { escapar, link, linkApp, paraData, truncar } from './texto';

/**
 * Resumo da manhã. Não inventa regra: usa as MESMAS funções das telas —
 * `alertasDaFormacao`/`pendenciasDoProjeto` (Acompanhamento) e `QUEUES` (filas do Diário).
 * Se a regra mudar lá, o resumo muda junto.
 */

const MAX_ITENS = 8;
const ORDEM: Gravidade[] = ['atrasado', 'atencao', 'incompleto'];

const pior = (alertas: Alerta[]) => ORDEM.find((g) => alertas.some((a) => a.gravidade === g));

const local = (x: { municipio?: string; uf?: string }) => [x.municipio, x.uf].filter(Boolean).map(escapar).join('/');

function lista<T>(itens: T[], linha: (x: T) => string, appUrl: string, caminho: string): string {
  const visiveis = itens.slice(0, MAX_ITENS).map(linha);
  const resto = itens.length - visiveis.length;
  if (resto > 0) visiveis.push(`_… e mais ${resto} — ${linkApp(appUrl, caminho, 'ver todas')}_`);
  return visiveis.join('\n');
}

export interface EntradaResumo {
  formacoes: Formacao[];
  projetos: ProjetoImplatancao[];
  demandas: Demanda[];
  hoje: Date;
  appUrl: string;
  /** Link do card de cada demanda no Slack, por id. */
  links: Map<string, string>;
}

export function montarResumo({ formacoes, projetos, demandas, hoje, appUrl, links }: EntradaResumo): string {
  const partes: string[] = [`☀️ *Resumo de ${format(hoje, "EEEE, dd/MM", { locale: ptBR })}*`];

  // ---- Formações: mesma conta do quadro (arquivada fora; cada uma conta uma vez, pela pior gravidade)
  const comAlerta = formacoes
    .filter((f) => faseDaFormacao(f, hoje) !== 'arquivada')
    .map((f) => ({ f, alertas: alertasDaFormacao(f, hoje) }))
    .filter((x) => x.alertas.length > 0);

  const linhaFormacao = (x: (typeof comAlerta)[number]) =>
    `• ${linkApp(appUrl, '/quadro', x.f.titulo || x.f.codigo || 'Formação')} — ${local(x.f)} · ${x.alertas.map((a) => a.texto).join(' · ')}`;

  const blocosFormacao: [Gravidade, string][] = [
    ['atrasado', '🔴 *Formações que terminaram e falta concluir*'],
    ['atencao', '🟡 *Formações que começam em até 7 dias*'],
    ['incompleto', '⚪ *Formações sem formadores*'],
  ];
  for (const [g, titulo] of blocosFormacao) {
    const doGrupo = comAlerta.filter((x) => pior(x.alertas) === g);
    if (doGrupo.length) partes.push(`${titulo} (${doGrupo.length})\n${lista(doGrupo, linhaFormacao, appUrl, '/quadro')}`);
  }

  // ---- Demandas: as filas do Diário de Bordo
  const contagem = Object.fromEntries(QUEUES.map((q) => [q.id, demandas.filter(q.match).length])) as Record<QueueId, number>;
  const abertas = demandas.filter((d) => d.status !== 'Concluída' && !d.validado).length;
  const numeros = [
    `${abertas} abertas`,
    contagem.atrasadas && `🔴 ${contagem.atrasadas} atrasadas`,
    contagem.hoje && `🟠 ${contagem.hoje} vencem hoje`,
    contagem.proximas && `🟡 ${contagem.proximas} em até 3 dias`,
    contagem.urgentes && `🔥 ${contagem.urgentes} urgentes`,
    contagem.semPrazo && `⚪ ${contagem.semPrazo} sem prazo`,
    contagem.validar && `☑️ ${contagem.validar} a validar`,
  ].filter(Boolean);

  const vencendo = demandas
    .filter((d) => QUEUES.find((q) => q.id === 'atrasadas')!.match(d) || QUEUES.find((q) => q.id === 'hoje')!.match(d))
    .sort((a, b) => (paraData(a.prazo)?.getTime() ?? 0) - (paraData(b.prazo)?.getTime() ?? 0));

  const linhaDemanda = (d: Demanda) => {
    const rotulo = `${d.municipio}/${d.uf}: ${truncar(String(d.demanda ?? '').replace(/\s+/g, ' '), 70)}`;
    const alvo = links.get(d.id);
    return `• ${alvo ? link(alvo, rotulo) : escapar(rotulo)} — 👤 ${escapar(d.responsavelNome || '—')} · ${getSla(d).label}`;
  };
  partes.push(
    `📋 *Demandas:* ${numeros.join(' · ')}` + (vencendo.length ? `\n${vencendo.slice(0, MAX_ITENS).map(linhaDemanda).join('\n')}` : ''),
  );
  if (vencendo.length > MAX_ITENS) partes.push(`_… e mais ${vencendo.length - MAX_ITENS} atrasadas ou vencendo hoje._`);

  // ---- Projetos: buracos de planejamento
  const pendencias = projetos.flatMap(pendenciasDoProjeto);
  if (pendencias.length) {
    const projetosComPendencia = new Set(pendencias.map((p) => p.projetoId)).size;
    partes.push(
      `📁 *Projetos:* ${projetosComPendencia} com etapa sem data ou cadastro incompleto (${pendencias.length} pendências) · ${linkApp(appUrl, '/quadro', 'ver no Acompanhamento')}`,
    );
  }

  if (!comAlerta.length && !contagem.atrasadas && !contagem.hoje && !pendencias.length) {
    partes.push('✅ Nada atrasado nem vencendo hoje.');
  }
  return partes.join('\n\n');
}

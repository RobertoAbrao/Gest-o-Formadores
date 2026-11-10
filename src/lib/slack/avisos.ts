import { escapar, linkApp, periodoBR, dataBR, truncar } from './texto';

/**
 * Avisos de "entrou algo no banco" — canal de avisos.
 *
 * Cada coleção escolhe À MÃO os campos que aparecem. Nunca se despeja o documento:
 * `formadores` e `assessores` guardam CPF, banco e PIX; `avaliacoes` guardam nome e
 * e-mail de quem respondeu. Coleção nova, sem regra aqui, sai só com o nome dela e o id.
 *
 * Funções puras: recebem os dados e devolvem o texto (mrkdwn do Slack).
 */

/** Coleções que não geram aviso. `demandas` tem canal e card próprios; `usuarios` duplicaria
 * o aviso de formador/assessor (o cadastro cria os dois). */
export const SEM_AVISO = new Set(['demandas', 'usuarios']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dados = Record<string, any>;

const local = (d: Dados) => [d.municipio || d.cidade, d.uf].filter(Boolean).map(escapar).join('/');
const nota = (v: unknown) => (v ? `${escapar(v)}/5` : '—');
const trecho = (v: unknown, max = 280) => (v ? `\n> ${escapar(truncar(String(v).replace(/\s+/g, ' '), max))}` : '');

const MENSAGENS: Record<string, (d: Dados, id: string, appUrl: string) => string> = {
  formacoes: (d, _id, url) => {
    const formadores = (d.formadoresNomes ?? []).length ? (d.formadoresNomes as string[]).map(escapar).join(', ') : '⚠️ sem formadores';
    return `🆕 *Formação nova:* ${linkApp(url, '/quadro', d.titulo || d.codigo || 'sem título')} — ${local(d)}\n📅 ${periodoBR(d.dataInicio, d.dataFim)} · 👥 ${formadores}`;
  },
  projetos: (d, _id, url) =>
    `📁 *Projeto novo:* ${linkApp(url, '/projetos', `${d.municipio}/${d.uf}`)}${d.responsavelNome ? ` · responsável ${escapar(d.responsavelNome)}` : ''}${d.material ? ` · material ${escapar(d.material)}` : ''}`,
  avaliacoes: (d, _id, url) =>
    `⭐ *Avaliação respondida* — ${linkApp(url, '/avaliacoes', d.formacaoTitulo || 'formação')}\nFormador(a): ${escapar(d.formadorNome || '—')} · editora ${nota(d.avaliacaoEditora)} · formador ${nota(d.avaliacaoFormador)} · ${local(d)}${trecho(d.observacoes)}`,
  avaliacoesSecretaria: (d, _id, url) =>
    `🏛️ *Avaliação da secretaria* — ${linkApp(url, '/avaliacoes', d.formacaoTitulo || 'formação')} · ${local(d)}\nAplicabilidade ${nota(d.aplicabilidade)} · organização ${escapar(d.organizacaoGeral || '—')} · engajamento ${escapar(d.percepcaoEngajamento || '—')}${trecho(d.comentariosFinais)}`,
  alinhamentos: (d, id, url) => `🤝 *Alinhamento recebido* — ${linkApp(url, '/projetos', d.municipio || id)}`,
  formadores: (d, _id, url) => `👩‍🏫 *Formador(a) cadastrado(a):* ${linkApp(url, '/formadores', d.nomeCompleto || 'sem nome')}${d.uf ? ` — ${escapar(d.uf)}` : ''}${d.disciplina ? ` · ${escapar(d.disciplina)}` : ''}`,
  assessores: (d, _id, url) => `💼 *Assessor(a) cadastrado(a):* ${linkApp(url, '/assessores', d.nomeCompleto || 'sem nome')}${d.uf ? ` — ${escapar(d.uf)}` : ''}`,
  materiais: (d, _id, url) => `📚 *Material novo:* ${linkApp(url, '/materiais', d.titulo || 'sem título')}${d.tipoMaterial ? ` (${escapar(d.tipoMaterial)})` : ''}`,
  despesas: (d, _id, url) => {
    const valor = typeof d.valor === 'number' ? d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
    return `💸 *Despesa lançada:* ${escapar(d.formadorNome || 'formador')} · ${escapar(d.tipo || '')} ${valor}${d.descricao ? ` — ${escapar(truncar(String(d.descricao), 120))}` : ''} · ${linkApp(url, '/despesas', 'ver despesas')}`;
  },
  anexos: (d) => `📎 *Anexo enviado:* ${escapar(d.nome || 'arquivo')}${d.etapa ? ` · ${escapar(d.etapa)}` : ''}`,
  lembretes: (d, _id, url) => `⏰ *Lembrete criado:* ${escapar(d.titulo || '')}${d.data ? ` para ${dataBR(d.data)}` : ''} · ${linkApp(url, '/dashboard', 'abrir')}`,
  calendario_eventos: (d, _id, url) =>
    `🗓️ *Evento no calendário:* ${escapar(d.type || 'evento')} — ${escapar(d.projectName || '')} · ${periodoBR(d.startDate, d.endDate)} · ${linkApp(url, '/calendario', 'abrir')}`,
  fichas_devolutivas: (_d, id, url) => `📝 *Ficha de divulgação criada* · ${linkApp(url, `/ficha/${id}`, 'abrir a ficha')}`,
};

export function avisoDeCriacao(colecao: string, id: string, dados: Dados, appUrl: string): string | null {
  if (SEM_AVISO.has(colecao)) return null;
  const montar = MENSAGENS[colecao];
  return montar ? montar(dados, id, appUrl) : `🗂️ Novo registro em *${escapar(colecao)}* (\`${escapar(id)}\`)`;
}

/**
 * Mudança de status de formação. Desde 04/11/2026 a data diz a fase (`fase-formacao.ts`);
 * só concluir e arquivar são decisão humana — então só essas mudanças viram aviso.
 */
export function avisoDeStatusDaFormacao(antes: Dados, depois: Dados, appUrl: string): string | null {
  if (antes.status === depois.status) return null;
  const nome = `${linkApp(appUrl, '/quadro', depois.titulo || depois.codigo || 'Formação')} — ${local(depois)}`;
  if (depois.status === 'concluido') return `✅ *Formação concluída:* ${nome}`;
  if (depois.status === 'arquivado') return `🗄️ *Formação arquivada:* ${nome}`;
  if (antes.status === 'concluido' || antes.status === 'arquivado') return `↩️ *Formação reaberta:* ${nome}`;
  return null;
}

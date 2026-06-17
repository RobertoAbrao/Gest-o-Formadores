import { NextRequest, NextResponse } from 'next/server';
import {
  listFormadores,
  getFormador,
  createFormador,
  updateFormador,
  listFormacoes,
  getFormacao,
  createFormacao,
  updateFormacaoStatus,
  listProjetos,
  getProjeto,
  createProjeto,
  listDemandas,
  createDemanda,
  updateDemandaStatus,
  listMateriais,
  createMaterial,
  listAssessores,
  createAssessor,
  getStats,
} from '../../../lib/agent/agent-tools';
import { ESTADOS_BR } from '../../../lib/estados-br';

// ─── SYSTEM PROMPT ────────────────────────────────────────────

function buildSystemPrompt(userName?: string, userRole?: string) {
  return `Você é o assistente inteligente do sistema Gestão de Formadores (EduConnect Hub).
Você ajuda administradores e formadores a gerenciar projetos, formações, formadores, demandas e materiais.

## Usuário atual
- Nome: ${userName || 'Desconhecido'}
- Perfil: ${userRole || 'N/A'}

## Como você funciona
- Você conversa em português brasileiro, de forma direta e colaborativa.
- Quando o usuário pedir para criar algo, pergunte apenas os dados essenciais que faltam.
- Se o contexto já tiver informação suficiente, crie diretamente sem perguntar o óbvio.
- Sempre confirme o que foi feito com um resumo claro.
- NUNCA exclua dados do banco de dados.

## Dados do projeto
- Estados brasileiros: ${ESTADOS_BR.map(e => `${e.sigla} (${e.nome})`).join(', ')}
- Status de formação: preparacao, em-formacao, pos-formacao, concluido, arquivado
- Status de demanda: Pendente, Em andamento, Concluída, Aguardando retorno
- Tipos de material: PDF, Vídeo, Link Externo, Documento Word, Apresentação, Pasta

## Regras importantes
1. NUNCA exclua dados do banco de dados
2. Ao criar um projeto, pergunte: município, UF, e se quiser adicionar formadores/responsáveis
3. Ao criar uma formação, pergunte: título, município, formadores, datas
4. Ao criar um formador, gere o email automaticamente: nome.toLowerCase().sem.acentos + '@editoralt.com.br'
5. Se não tiver certeza de algum dado, pergunte antes de criar
6. Sempre retorne um resumo do que foi feito após criar algo`;
}

// ─── TOOL DEFINITIONS (OpenAI format) ────────────────────────

const tools = [
  {
    type: 'function',
    function: {
      name: 'listar_formadores',
      description: 'Lista todos os formadores do sistema, opcionalmente filtrados por UF (sigla do estado como PR, SP, RJ)',
      parameters: {
        type: 'object',
        properties: {
          uf: { type: 'string', description: 'Sigla do estado (ex: PR, SP, RJ)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_formador',
      description: 'Busca um formador pelo ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID do formador' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_formador',
      description: 'Cria um novo formador. Gera email automaticamente baseado no nome.',
      parameters: {
        type: 'object',
        properties: {
          nomeCompleto: { type: 'string', minLength: 3 },
          cpf: { type: 'string', minLength: 11 },
          telefone: { type: 'string', minLength: 10 },
          municipiosResponsaveis: { type: 'array', items: { type: 'string' }, minItems: 1 },
          uf: { type: 'string', minLength: 2, maxLength: 2 },
          disciplina: { type: 'string' },
          curriculo: { type: 'string' },
          banco: { type: 'string' },
          agencia: { type: 'string' },
          conta: { type: 'string' },
          pix: { type: 'string' },
        },
        required: ['nomeCompleto', 'cpf', 'telefone', 'municipiosResponsaveis', 'uf'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_formador',
      description: 'Atualiza dados de um formador existente pelo ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          nomeCompleto: { type: 'string' },
          telefone: { type: 'string' },
          municipiosResponsaveis: { type: 'array', items: { type: 'string' } },
          uf: { type: 'string' },
          disciplina: { type: 'string' },
          banco: { type: 'string' },
          agencia: { type: 'string' },
          conta: { type: 'string' },
          pix: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_formacoes',
      description: 'Lista formações do sistema, opcionalmente filtradas por status (preparacao, em-formacao, pos-formacao, concluido, arquivado)',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['preparacao', 'em-formacao', 'pos-formacao', 'concluido', 'arquivado'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_formacao',
      description: 'Busca uma formação pelo ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_formacao',
      description: 'Cria uma nova formação. Gera código automaticamente baseado no município.',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', minLength: 3 },
          descricao: { type: 'string', minLength: 10 },
          municipio: { type: 'string' },
          uf: { type: 'string', minLength: 2, maxLength: 2 },
          formadoresIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
          formadoresNomes: { type: 'array', items: { type: 'string' }, minItems: 1 },
          participantes: { type: 'number' },
          dataInicio: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
          dataFim: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        },
        required: ['titulo', 'descricao', 'municipio', 'uf', 'formadoresIds', 'formadoresNomes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_status_formacao',
      description: 'Atualiza o status de uma formação',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['preparacao', 'em-formacao', 'pos-formacao', 'concluido', 'arquivado'] },
        },
        required: ['id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_projetos',
      description: 'Lista todos os projetos de implantação',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_projeto',
      description: 'Busca um projeto pelo ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_projeto',
      description: 'Cria um novo projeto de implantação em um município',
      parameters: {
        type: 'object',
        properties: {
          municipio: { type: 'string' },
          uf: { type: 'string', minLength: 2, maxLength: 2 },
          versao: { type: 'string' },
          material: { type: 'string' },
          qtdAlunos: { type: 'number' },
          qtdProfessores: { type: 'number' },
          formadoresIds: { type: 'array', items: { type: 'string' } },
          responsavelId: { type: 'string' },
          responsavelNome: { type: 'string' },
        },
        required: ['municipio', 'uf'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_demandas',
      description: 'Lista demandas do Diário de Bordo, opcionalmente filtradas por status',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Pendente', 'Em andamento', 'Concluída', 'Aguardando retorno'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_demanda',
      description: 'Cria uma nova demanda no Diário de Bordo',
      parameters: {
        type: 'object',
        properties: {
          demanda: { type: 'string', minLength: 5 },
          municipio: { type: 'string' },
          uf: { type: 'string', minLength: 2, maxLength: 2 },
          responsavelId: { type: 'string' },
          responsavelNome: { type: 'string' },
          prioridade: { type: 'string', enum: ['Normal', 'Urgente'] },
          prazo: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        },
        required: ['demanda', 'municipio', 'uf', 'responsavelId', 'responsavelNome'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_status_demanda',
      description: 'Atualiza o status de uma demanda',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['Pendente', 'Em andamento', 'Concluída', 'Aguardando retorno'] },
        },
        required: ['id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_materiais',
      description: 'Lista todos os materiais de apoio',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_material',
      description: 'Cria um novo material de apoio',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          descricao: { type: 'string' },
          tipoMaterial: { type: 'string', enum: ['PDF', 'Vídeo', 'Link Externo', 'Documento Word', 'Apresentação', 'Pasta'] },
          url: { type: 'string' },
        },
        required: ['titulo', 'tipoMaterial', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_assessores',
      description: 'Lista todos os assessores',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_assessor',
      description: 'Cria um novo assessor',
      parameters: {
        type: 'object',
        properties: {
          nomeCompleto: { type: 'string', minLength: 3 },
          email: { type: 'string' },
          cpf: { type: 'string', minLength: 11 },
          telefone: { type: 'string', minLength: 10 },
          municipiosResponsaveis: { type: 'array', items: { type: 'string' }, minItems: 1 },
          uf: { type: 'string', minLength: 2, maxLength: 2 },
          disciplina: { type: 'string' },
          banco: { type: 'string' },
          agencia: { type: 'string' },
          conta: { type: 'string' },
          pix: { type: 'string' },
        },
        required: ['nomeCompleto', 'email', 'cpf', 'telefone', 'municipiosResponsaveis', 'uf'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estatisticas',
      description: 'Obtém resumo estatístico geral do sistema',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ─── TOOL EXECUTOR ────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'listar_formadores':
      return execListFormadores(args);
    case 'buscar_formador':
      return execBuscarFormador(args);
    case 'criar_formador':
      return execCriarFormador(args);
    case 'atualizar_formador':
      return execAtualizarFormador(args);
    case 'listar_formacoes':
      return execListarFormacoes(args);
    case 'buscar_formacao':
      return execBuscarFormacao(args);
    case 'criar_formacao':
      return execCriarFormacao(args);
    case 'atualizar_status_formacao':
      return execAtualizarStatusFormacao(args);
    case 'listar_projetos':
      return execListarProjetos();
    case 'buscar_projeto':
      return execBuscarProjeto(args);
    case 'criar_projeto':
      return execCriarProjeto(args);
    case 'listar_demandas':
      return execListarDemandas(args);
    case 'criar_demanda':
      return execCriarDemanda(args);
    case 'atualizar_status_demanda':
      return execAtualizarStatusDemanda(args);
    case 'listar_materiais':
      return execListarMateriais();
    case 'criar_material':
      return execCriarMaterial(args);
    case 'listar_assessores':
      return execListarAssessores();
    case 'criar_assessor':
      return execCriarAssessor(args);
    case 'estatisticas':
      return execEstatisticas();
    default:
      return `Ferramenta desconhecida: ${name}`;
  }
}

// Formadores
async function execListFormadores(args: Record<string, unknown>) {
  const formadores = await listFormadores(args.uf as string | undefined);
  if (formadores.length === 0) return 'Nenhum formador encontrado.';
  return formadores.map(f => `• ${f.nomeCompleto} (${f.uf}) - ${f.email} - Municípios: ${f.municipiosResponsaveis.join(', ')}`).join('\n');
}

async function execBuscarFormador(args: Record<string, unknown>) {
  const f = await getFormador(args.id as string);
  if (!f) return 'Formador não encontrado.';
  return `Formador: ${f.nomeCompleto}\nEmail: ${f.email}\nCPF: ${f.cpf}\nTelefone: ${f.telefone}\nUF: ${f.uf}\nMunicípios: ${f.municipiosResponsaveis.join(', ')}\nDisciplina: ${f.disciplina || 'N/A'}\nBanco: ${f.banco || 'N/A'} ${f.agencia || ''} ${f.conta || ''}\nPIX: ${f.pix || 'N/A'}`;
}

async function execCriarFormador(args: Record<string, unknown>) {
  const baseName = (args.nomeCompleto as string).toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const email = `${baseName}@editoralt.com.br`;
  const id = await createFormador({
    nomeCompleto: args.nomeCompleto as string,
    email,
    cpf: args.cpf as string,
    telefone: args.telefone as string,
    municipiosResponsaveis: args.municipiosResponsaveis as string[],
    uf: args.uf as string,
    disciplina: args.disciplina as string | undefined,
    curriculo: args.curriculo as string | undefined,
    banco: args.banco as string | undefined,
    agencia: args.agencia as string | undefined,
    conta: args.conta as string | undefined,
    pix: args.pix as string | undefined,
    status: 'preparacao',
  });
  return `✅ Formador criado!\nNome: ${args.nomeCompleto}\nEmail: ${email}\nID: ${id}\nUF: ${args.uf}`;
}

async function execAtualizarFormador(args: Record<string, unknown>) {
  const { id, ...data } = args;
  await updateFormador(id as string, data as Partial<import('../../../lib/types').Formador>);
  return `✅ Formador ${id} atualizado!`;
}

// Formações
async function execListarFormacoes(args: Record<string, unknown>) {
  const formacoes = await listFormacoes(args.status as any);
  if (formacoes.length === 0) return 'Nenhuma formação encontrada.';
  return formacoes.map(f => `• [${f.status}] ${f.titulo} (${f.municipio}/${f.uf}) - ${f.codigo}`).join('\n');
}

async function execBuscarFormacao(args: Record<string, unknown>) {
  const f = await getFormacao(args.id as string);
  if (!f) return 'Formação não encontrada.';
  return `Formação: ${f.titulo}\nCódigo: ${f.codigo}\nStatus: ${f.status}\nMunicípio: ${f.municipio}/${f.uf}\nDescrição: ${f.descricao}\nFormadores: ${f.formadoresNomes?.join(', ') || 'N/A'}`;
}

async function execCriarFormacao(args: Record<string, unknown>) {
  const id = await createFormacao({
    titulo: args.titulo as string,
    descricao: args.descricao as string,
    municipio: args.municipio as string,
    uf: args.uf as string,
    formadoresIds: args.formadoresIds as string[],
    formadoresNomes: args.formadoresNomes as string[],
    participantes: args.participantes as number | undefined,
    dataInicio: args.dataInicio ? new Date(args.dataInicio as string) : null,
    dataFim: args.dataFim ? new Date(args.dataFim as string) : null,
  });
  return `✅ Formação criada!\nTítulo: ${args.titulo}\nMunicípio: ${args.municipio}/${args.uf}\nID: ${id}\nFormadores: ${(args.formadoresNomes as string[]).join(', ')}`;
}

async function execAtualizarStatusFormacao(args: Record<string, unknown>) {
  await updateFormacaoStatus(args.id as string, args.status as any);
  return `✅ Status da formação ${args.id} atualizado para: ${args.status}`;
}

// Projetos
async function execListarProjetos() {
  const projetos = await listProjetos();
  if (projetos.length === 0) return 'Nenhum projeto encontrado.';
  return projetos.map(p => `• ${p.municipio}/${p.uf} - Alunos: ${p.qtdAlunos || 'N/A'} - Professores: ${p.qtdProfessores || 'N/A'}`).join('\n');
}

async function execBuscarProjeto(args: Record<string, unknown>) {
  const p = await getProjeto(args.id as string);
  if (!p) return 'Projeto não encontrado.';
  return `Projeto: ${p.municipio}/${p.uf}\nVersão: ${p.versao || 'N/A'}\nMaterial: ${p.material || 'N/A'}\nAlunos: ${p.qtdAlunos || 'N/A'}\nProfessores: ${p.qtdProfessores || 'N/A'}\nResponsável: ${p.responsavelNome || 'N/A'}`;
}

async function execCriarProjeto(args: Record<string, unknown>) {
  const id = await createProjeto({
    municipio: args.municipio as string,
    uf: args.uf as string,
    versao: args.versao as string | undefined,
    material: args.material as string | undefined,
    qtdAlunos: args.qtdAlunos as number | undefined,
    qtdProfessores: args.qtdProfessores as number | undefined,
    formadoresIds: args.formadoresIds as string[] | undefined,
    responsavelId: args.responsavelId as string | undefined,
    responsavelNome: args.responsavelNome as string | undefined,
  });
  return `✅ Projeto criado!\nMunicípio: ${args.municipio}/${args.uf}\nID: ${id}`;
}

// Demandas
async function execListarDemandas(args: Record<string, unknown>) {
  const demandas = await listDemandas(args.status as any);
  if (demandas.length === 0) return 'Nenhuma demanda encontrada.';
  return demandas.map(d => `• [${d.status}] ${d.demanda.substring(0, 80)} - ${d.municipio}/${d.uf} - Resp: ${d.responsavelNome}`).join('\n');
}

async function execCriarDemanda(args: Record<string, unknown>) {
  const id = await createDemanda({
    demanda: args.demanda as string,
    municipio: args.municipio as string,
    uf: args.uf as string,
    responsavelId: args.responsavelId as string,
    responsavelNome: args.responsavelNome as string,
    prioridade: args.prioridade as 'Normal' | 'Urgente' | undefined,
    prazo: args.prazo ? new Date(args.prazo as string) : null,
  });
  return `✅ Demanda criada!\nDescrição: ${args.demanda}\nMunicípio: ${args.municipio}/${args.uf}\nResponsável: ${args.responsavelNome}\nID: ${id}`;
}

async function execAtualizarStatusDemanda(args: Record<string, unknown>) {
  await updateDemandaStatus(args.id as string, args.status as any);
  return `✅ Status da demanda ${args.id} atualizado para: ${args.status}`;
}

// Materiais
async function execListarMateriais() {
  const materiais = await listMateriais();
  if (materiais.length === 0) return 'Nenhum material encontrado.';
  return materiais.map(m => `• [${m.tipoMaterial}] ${m.titulo} - ${m.descricao}`).join('\n');
}

async function execCriarMaterial(args: Record<string, unknown>) {
  const id = await createMaterial({
    titulo: args.titulo as string,
    descricao: args.descricao as string | undefined,
    tipoMaterial: args.tipoMaterial as any,
    url: args.url as string,
  });
  return `✅ Material criado!\nTítulo: ${args.titulo}\nTipo: ${args.tipoMaterial}\nID: ${id}`;
}

// Assessores
async function execListarAssessores() {
  const assessores = await listAssessores();
  if (assessores.length === 0) return 'Nenhum assessor encontrado.';
  return assessores.map(a => `• ${a.nomeCompleto} (${a.uf}) - ${a.email}`).join('\n');
}

async function execCriarAssessor(args: Record<string, unknown>) {
  const id = await createAssessor({
    nomeCompleto: args.nomeCompleto as string,
    email: args.email as string,
    cpf: args.cpf as string,
    telefone: args.telefone as string,
    municipiosResponsaveis: args.municipiosResponsaveis as string[],
    uf: args.uf as string,
    disciplina: args.disciplina as string | undefined,
    curriculo: undefined,
    banco: args.banco as string | undefined,
    agencia: args.agencia as string | undefined,
    conta: args.conta as string | undefined,
    pix: args.pix as string | undefined,
  });
  return `✅ Assessor criado!\nNome: ${args.nomeCompleto}\nEmail: ${args.email}\nID: ${id}`;
}

// Estatísticas
async function execEstatisticas() {
  const stats = await getStats();
  return `📊 Estatísticas do Sistema\n\n` +
    `Formadores: ${stats.totalFormadores}\n` +
    `Formações: ${stats.totalFormacoes}\n` +
    `Projetos: ${stats.totalProjetos}\n` +
    `Demandas: ${stats.totalDemandas}\n\n` +
    `Formações por status:\n` +
    Object.entries(stats.formacoesPorStatus).map(([k, v]) => `  ${k}: ${v}`).join('\n') +
    `\n\nDemandas por status:\n` +
    Object.entries(stats.demandasPorStatus).map(([k, v]) => `  ${k}: ${v}`).join('\n');
}

// ─── OPENROUTER API CALL ──────────────────────────────────────

async function callOpenRouter(messages: any[], tools: any[]): Promise<any> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://gest-o-formadores.vercel.app',
      'X-Title': 'Gestão de Formadores',
    },
    body: JSON.stringify({
      model: 'openrouter/owl-alpha',
      messages,
      tools,
      tool_choice: 'auto',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ─── CHAT ROUTE ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, userId, userName, userRole } = body as {
      messages: Array<{ role: string; content: string }>;
      userId?: string;
      userName?: string;
      userRole?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(userName, userRole);

    // Build OpenRouter messages
    const openRouterMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Call OpenRouter
    let result = await callOpenRouter(openRouterMessages, tools);

    // Handle tool calls (possibly multiple rounds)
    let maxRounds = 5;
    while (maxRounds > 0) {
      const choice = result.choices?.[0];
      if (!choice) break;

      const toolCalls = choice.message?.tool_calls;
      if (!toolCalls || toolCalls.length === 0) break;

      // Execute all tool calls
      const toolResults = await Promise.all(
        toolCalls.map(async (tc: any) => {
          const args = JSON.parse(tc.function.arguments || '{}');
          const toolResult = await executeTool(tc.function.name, args);
          return {
            tool_call_id: tc.id,
            role: 'tool' as const,
            content: toolResult,
          };
        })
      );

      // Add assistant message with tool calls and tool results
      openRouterMessages.push(choice.message);
      openRouterMessages.push(...toolResults);

      // Call again with tool results
      result = await callOpenRouter(openRouterMessages, tools);
      maxRounds--;
    }

    const finalChoice = result.choices?.[0];
    const responseText = finalChoice?.message?.content || 'Desculpe, não consegui processar sua solicitação.';

    return NextResponse.json({
      message: responseText,
      success: true,
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar mensagem', details: error.message || 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

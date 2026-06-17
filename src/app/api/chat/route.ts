import { NextRequest, NextResponse } from 'next/server';
import { ai } from '../../../ai/genkit';
import { z } from 'genkit';
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

// ─── TOOL DEFINITIONS ─────────────────────────────────────────

function createTools() {
  const zod = z;

  return [
    // ── FORMADORES ──
    ai.defineTool(
      {
        name: 'listar_formadores',
        description: 'Lista todos os formadores do sistema, opcionalmente filtrados por UF (sigla do estado como PR, SP, RJ)',
        inputSchema: zod.object({
          uf: zod.string().length(2).optional().describe('Sigla do estado (ex: PR, SP, RJ)'),
        }),
        outputSchema: zod.string(),
      },
      async ({ uf }: { uf?: string }) => {
        const formadores = await listFormadores(uf);
        if (formadores.length === 0) return 'Nenhum formador encontrado.';
        return formadores.map(f =>
          `• ${f.nomeCompleto} (${f.uf}) - ${f.email} - Municípios: ${f.municipiosResponsaveis.join(', ')}`
        ).join('\n');
      }
    ),

    ai.defineTool(
      {
        name: 'buscar_formador',
        description: 'Busca um formador pelo ID',
        inputSchema: zod.object({ id: zod.string() }),
        outputSchema: zod.string(),
      },
      async ({ id }: { id: string }) => {
        const f = await getFormador(id);
        if (!f) return 'Formador não encontrado.';
        return `Formador: ${f.nomeCompleto}\nEmail: ${f.email}\nCPF: ${f.cpf}\nTelefone: ${f.telefone}\nUF: ${f.uf}\nMunicípios: ${f.municipiosResponsaveis.join(', ')}\nDisciplina: ${f.disciplina || 'N/A'}\nBanco: ${f.banco || 'N/A'} ${f.agencia || ''} ${f.conta || ''}\nPIX: ${f.pix || 'N/A'}`;
      }
    ),

    ai.defineTool(
      {
        name: 'criar_formador',
        description: 'Cria um novo formador. Gera email automaticamente baseado no nome.',
        inputSchema: zod.object({
          nomeCompleto: zod.string().min(3),
          cpf: zod.string().min(11),
          telefone: zod.string().min(10),
          municipiosResponsaveis: zod.array(zod.string()).min(1),
          uf: zod.string().length(2),
          disciplina: zod.string().optional(),
          curriculo: zod.string().optional(),
          banco: zod.string().optional(),
          agencia: zod.string().optional(),
          conta: zod.string().optional(),
          pix: zod.string().optional(),
        }),
        outputSchema: zod.string(),
      },
      async (data: any) => {
        const baseName = data.nomeCompleto.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const email = `${baseName}@editoralt.com.br`;
        const id = await createFormador({ ...data, email, status: 'preparacao' });
        return `✅ Formador criado com sucesso!\nNome: ${data.nomeCompleto}\nEmail: ${email}\nID: ${id}\nMunicípios: ${data.municipiosResponsaveis.join(', ')}\nUF: ${data.uf}`;
      }
    ),

    ai.defineTool(
      {
        name: 'atualizar_formador',
        description: 'Atualiza dados de um formador existente pelo ID',
        inputSchema: zod.object({
          id: zod.string(),
          nomeCompleto: zod.string().optional(),
          telefone: zod.string().optional(),
          municipiosResponsaveis: zod.array(zod.string()).optional(),
          uf: zod.string().optional(),
          disciplina: zod.string().optional(),
          banco: zod.string().optional(),
          agencia: zod.string().optional(),
          conta: zod.string().optional(),
          pix: zod.string().optional(),
        }),
        outputSchema: zod.string(),
      },
      async (params: any) => {
        const { id, ...data } = params;
        await updateFormador(id, data);
        return `✅ Formador ${id} atualizado com sucesso!`;
      }
    ),

    // ── FORMAÇÕES ──
    ai.defineTool(
      {
        name: 'listar_formacoes',
        description: 'Lista formações do sistema, opcionalmente filtradas por status (preparacao, em-formacao, pos-formacao, concluido, arquivado)',
        inputSchema: zod.object({
          status: zod.enum(['preparacao', 'em-formacao', 'pos-formacao', 'concluido', 'arquivado']).optional(),
        }),
        outputSchema: zod.string(),
      },
      async ({ status }: { status?: string }) => {
        const formacoes = await listFormacoes(status as any);
        if (formacoes.length === 0) return 'Nenhuma formação encontrada.';
        return formacoes.map(f =>
          `• [${f.status}] ${f.titulo} (${f.municipio}/${f.uf}) - Código: ${f.codigo}`
        ).join('\n');
      }
    ),

    ai.defineTool(
      {
        name: 'buscar_formacao',
        description: 'Busca uma formação pelo ID',
        inputSchema: zod.object({ id: zod.string() }),
        outputSchema: zod.string(),
      },
      async ({ id }: { id: string }) => {
        const f = await getFormacao(id);
        if (!f) return 'Formação não encontrada.';
        return `Formação: ${f.titulo}\nCódigo: ${f.codigo}\nStatus: ${f.status}\nMunicípio: ${f.municipio}/${f.uf}\nDescrição: ${f.descricao}\nFormadores: ${f.formadoresNomes?.join(', ') || 'N/A'}`;
      }
    ),

    ai.defineTool(
      {
        name: 'criar_formacao',
        description: 'Cria uma nova formação. Gera código automaticamente baseado no município.',
        inputSchema: zod.object({
          titulo: zod.string().min(3),
          descricao: zod.string().min(10),
          municipio: zod.string().min(1),
          uf: zod.string().length(2),
          formadoresIds: zod.array(zod.string()).min(1),
          formadoresNomes: zod.array(zod.string()).min(1),
          participantes: zod.number().optional(),
          dataInicio: zod.string().optional().describe('Data no formato YYYY-MM-DD'),
          dataFim: zod.string().optional().describe('Data no formato YYYY-MM-DD'),
        }),
        outputSchema: zod.string(),
      },
      async (data: any) => {
        const id = await createFormacao({
          ...data,
          dataInicio: data.dataInicio ? new Date(data.dataInicio) : null,
          dataFim: data.dataFim ? new Date(data.dataFim) : null,
        });
        return `✅ Formação criada com sucesso!\nTítulo: ${data.titulo}\nMunicípio: ${data.municipio}/${data.uf}\nID: ${id}\nFormadores: ${data.formadoresNomes.join(', ')}`;
      }
    ),

    ai.defineTool(
      {
        name: 'atualizar_status_formacao',
        description: 'Atualiza o status de uma formação',
        inputSchema: zod.object({
          id: zod.string(),
          status: zod.enum(['preparacao', 'em-formacao', 'pos-formacao', 'concluido', 'arquivado']),
        }),
        outputSchema: zod.string(),
      },
      async (input: { id?: string; status?: string }) => {
        await updateFormacaoStatus(input.id!, input.status as any);
        return `✅ Status da formação ${input.id} atualizado para: ${input.status}`;
      }
    ),

    // ── PROJETOS ──
    ai.defineTool(
      {
        name: 'listar_projetos',
        description: 'Lista todos os projetos de implantação',
        inputSchema: zod.object({}),
        outputSchema: zod.string(),
      },
      async () => {
        const projetos = await listProjetos();
        if (projetos.length === 0) return 'Nenhum projeto encontrado.';
        return projetos.map(p =>
          `• ${p.municipio}/${p.uf} - Alunos: ${p.qtdAlunos || 'N/A'} - Professores: ${p.qtdProfessores || 'N/A'}`
        ).join('\n');
      }
    ),

    ai.defineTool(
      {
        name: 'buscar_projeto',
        description: 'Busca um projeto pelo ID',
        inputSchema: zod.object({ id: zod.string() }),
        outputSchema: zod.string(),
      },
      async ({ id }: { id: string }) => {
        const p = await getProjeto(id);
        if (!p) return 'Projeto não encontrado.';
        return `Projeto: ${p.municipio}/${p.uf}\nVersão: ${p.versao || 'N/A'}\nMaterial: ${p.material || 'N/A'}\nAlunos: ${p.qtdAlunos || 'N/A'}\nProfessores: ${p.qtdProfessores || 'N/A'}\nResponsável: ${p.responsavelNome || 'N/A'}\nDiagnóstica: ${p.diagnostica?.ok ? '✅ Concluída' : '⏳ Pendente'}\nSimulados: S1:${p.simulados?.s1?.ok ? '✅' : '⏳'} S2:${p.simulados?.s2?.ok ? '✅' : '⏳'} S3:${p.simulados?.s3?.ok ? '✅' : '⏳'} S4:${p.simulados?.s4?.ok ? '✅' : '⏳'}`;
      }
    ),

    ai.defineTool(
      {
        name: 'criar_projeto',
        description: 'Cria um novo projeto de implantação em um município',
        inputSchema: zod.object({
          municipio: zod.string().min(1),
          uf: zod.string().length(2),
          versao: zod.string().optional(),
          material: zod.string().optional(),
          qtdAlunos: zod.number().optional(),
          qtdProfessores: zod.number().optional(),
          formadoresIds: zod.array(zod.string()).optional(),
          responsavelId: zod.string().optional(),
          responsavelNome: zod.string().optional(),
        }),
        outputSchema: zod.string(),
      },
      async (data: any) => {
        const id = await createProjeto(data);
        return `✅ Projeto criado com sucesso!\nMunicípio: ${data.municipio}/${data.uf}\nID: ${id}\nAlunos: ${data.qtdAlunos || 'N/A'}\nProfessores: ${data.qtdProfessores || 'N/A'}`;
      }
    ),

    // ── DEMANDAS ──
    ai.defineTool(
      {
        name: 'listar_demandas',
        description: 'Lista demandas do Diário de Bordo, opcionalmente filtradas por status',
        inputSchema: zod.object({
          status: zod.enum(['Pendente', 'Em andamento', 'Concluída', 'Aguardando retorno']).optional(),
        }),
        outputSchema: zod.string(),
      },
      async ({ status }: { status?: string }) => {
        const demandas = await listDemandas(status as any);
        if (demandas.length === 0) return 'Nenhuma demanda encontrada.';
        return demandas.map(d =>
          `• [${d.status}] ${d.demanda.substring(0, 80)} - ${d.municipio}/${d.uf} - Resp: ${d.responsavelNome}`
        ).join('\n');
      }
    ),

    ai.defineTool(
      {
        name: 'criar_demanda',
        description: 'Cria uma nova demanda no Diário de Bordo',
        inputSchema: zod.object({
          demanda: zod.string().min(5),
          municipio: zod.string().min(1),
          uf: zod.string().length(2),
          responsavelId: zod.string(),
          responsavelNome: zod.string(),
          prioridade: zod.enum(['Normal', 'Urgente']).optional(),
          prazo: zod.string().optional().describe('Data no formato YYYY-MM-DD'),
        }),
        outputSchema: zod.string(),
      },
      async (data: any) => {
        const id = await createDemanda({
          ...data,
          prazo: data.prazo ? new Date(data.prazo) : null,
        });
        return `✅ Demanda criada com sucesso!\nDescrição: ${data.demanda}\nMunicípio: ${data.municipio}/${data.uf}\nResponsável: ${data.responsavelNome}\nPrioridade: ${data.prioridade || 'Normal'}\nID: ${id}`;
      }
    ),

    ai.defineTool(
      {
        name: 'atualizar_status_demanda',
        description: 'Atualiza o status de uma demanda',
        inputSchema: zod.object({
          id: zod.string(),
          status: zod.enum(['Pendente', 'Em andamento', 'Concluída', 'Aguardando retorno']),
        }),
        outputSchema: zod.string(),
      },
      async (input: { id?: string; status?: string }) => {
        await updateDemandaStatus(input.id!, input.status as any);
        return `✅ Status da demanda ${input.id} atualizado para: ${input.status}`;
      }
    ),

    // ── MATERIAIS ──
    ai.defineTool(
      {
        name: 'listar_materiais',
        description: 'Lista todos os materiais de apoio',
        inputSchema: zod.object({}),
        outputSchema: zod.string(),
      },
      async () => {
        const materiais = await listMateriais();
        if (materiais.length === 0) return 'Nenhum material encontrado.';
        return materiais.map(m => `• [${m.tipoMaterial}] ${m.titulo} - ${m.descricao}`).join('\n');
      }
    ),

    ai.defineTool(
      {
        name: 'criar_material',
        description: 'Cria um novo material de apoio',
        inputSchema: zod.object({
          titulo: zod.string().min(1),
          descricao: zod.string().optional(),
          tipoMaterial: zod.enum(['PDF', 'Vídeo', 'Link Externo', 'Documento Word', 'Apresentação', 'Pasta']),
          url: zod.string(),
        }),
        outputSchema: zod.string(),
      },
      async (data: any) => {
        const id = await createMaterial(data);
        return `✅ Material criado com sucesso!\nTítulo: ${data.titulo}\nTipo: ${data.tipoMaterial}\nURL: ${data.url}\nID: ${id}`;
      }
    ),

    // ── ASSESSORES ──
    ai.defineTool(
      {
        name: 'listar_assessores',
        description: 'Lista todos os assessores',
        inputSchema: zod.object({}),
        outputSchema: zod.string(),
      },
      async () => {
        const assessores = await listAssessores();
        if (assessores.length === 0) return 'Nenhum assessor encontrado.';
        return assessores.map(a => `• ${a.nomeCompleto} (${a.uf}) - ${a.email}`).join('\n');
      }
    ),

    ai.defineTool(
      {
        name: 'criar_assessor',
        description: 'Cria um novo assessor',
        inputSchema: zod.object({
          nomeCompleto: zod.string().min(3),
          email: zod.string(),
          cpf: zod.string().min(11),
          telefone: zod.string().min(10),
          municipiosResponsaveis: zod.array(zod.string()).min(1),
          uf: zod.string().length(2),
          disciplina: zod.string().optional(),
          banco: zod.string().optional(),
          agencia: zod.string().optional(),
          conta: zod.string().optional(),
          pix: zod.string().optional(),
        }),
        outputSchema: zod.string(),
      },
      async (data: any) => {
        const id = await createAssessor(data);
        return `✅ Assessor criado com sucesso!\nNome: ${data.nomeCompleto}\nEmail: ${data.email}\nID: ${id}`;
      }
    ),

    // ── ESTATÍSTICAS ──
    ai.defineTool(
      {
        name: 'estatisticas',
        description: 'Obtém resumo estatístico geral do sistema',
        inputSchema: zod.object({}),
        outputSchema: zod.string(),
      },
      async () => {
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
    ),
  ];
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

    const tools = createTools();
    const systemPrompt = buildSystemPrompt(userName, userRole);

    // Build conversation history
    const conversationHistory = messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
      .join('\n\n');

    const fullPrompt = `${systemPrompt}

---

## Conversa atual
${conversationHistory}`;

    const response = await ai.generate({
      prompt: fullPrompt,
      tools,
      model: 'googleai/gemini-2.0-flash',
    });

    return NextResponse.json({
      message: response.text || 'Desculpe, não consegui processar sua solicitação.',
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

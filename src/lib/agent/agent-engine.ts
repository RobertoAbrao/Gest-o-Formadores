import { ai } from '@/ai/genkit';
import { z } from 'zod';
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
} from './agent-tools';
import { ESTADOS_BR } from '@/lib/estados-br';

// ─── SYSTEM PROMPT ────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o assistente inteligente do sistema Gestão de Formadores (EduConnect Hub).
Você ajuda administradores e formadores a gerenciar projetos, formações, formadores, demandas e materiais.

## Como você funciona
- Você conversa em **português brasileiro**, de forma direta e colaborativa.
- Quando o usuário pedir para criar algo, **pergunte apenas os dados essenciais** que faltam.
- Se o contexto já tiver informação suficiente, **crie diretamente** sem perguntar o óbvio.
- Sempre confirme o que foi feito com um resumo claro.

## Dados do projeto
- Estados brasileiros disponíveis: ${ESTADOS_BR.map(e => `${e.sigla} (${e.nome})`).join(', ')}
- Status de formação: preparacao, em-formacao, pos-formacao, concluido, arquivado
- Status de demanda: Pendente, Em andamento, Concluída, Aguardando retorno
- Tipos de material: PDF, Vídeo, Link Externo, Documento Word, Apresentação, Pasta
- Tipos de despesa: Alimentação, Transporte, Hospedagem, Material Didático, Outros

## Ações disponíveis
Você pode executar estas ações diretamente no banco de dados:

**Formadores:**
- listar formadores (por UF ou todos)
- buscar formador por ID
- criar formador (nome, email, CPF, telefone, municípios, UF, disciplina, dados bancários)
- atualizar formador

**Formações:**
- listar formações (por status ou todas)
- buscar formação por ID
- criar formação (título, descrição, município, formadores, datas)
- atualizar status da formação

**Projetos:**
- listar projetos
- buscar projeto por ID
- criar projeto (município, UF, versão, material, alunos, professores, formadores, responsável)

**Demandas:**
- listar demandas (por status ou todas)
- criar demanda (descrição, município, responsável, prioridade, prazo)
- atualizar status da demanda

**Materiais:**
- listar materiais
- criar material (título, descrição, tipo, URL)

**Assessores:**
- listar assessores
- criar assessor

**Estatísticas:**
- obter resumo geral do sistema

## Regras importantes
1. NUNCA exclua dados do banco de dados
2. Ao criar um projeto, pergunte: município, UF, e se quiser adicionar formadores/responsáveis
3. Ao criar uma formação, pergunte: título, município, formadores, datas
4. Ao criar um formador, gere o email automatico: nome.toLowerCase().replace(/\\s+/g, '') + '@editoralt.com.br'
5. Use os nomes dos campos exatamente como estão no sistema
6. Se não tiver certeza de algum dado, pergunte antes de criar
7. Sempre retorne um resumo do que foi feito após criar algo`;

// ─── TOOL DEFINITIONS ─────────────────────────────────────────

const toolDefinitions = [
  // Formadores
  {
    name: 'listar_formadores',
    description: 'Lista todos os formadores, opcionalmente filtrados por UF',
    parameters: z.object({
      uf: z.string().length(2).optional().description('Sigla do estado (ex: PR, SP, RJ)'),
    }),
    execute: async ({ uf }: { uf?: string }) => {
      const formadores = await listFormadores(uf);
      if (formadores.length === 0) return 'Nenhum formador encontrado.';
      return formadores.map(f => `• ${f.nomeCompleto} (${f.uf}) - ${f.email} - Municípios: ${f.municipiosResponsaveis.join(', ')}`).join('\n');
    },
  },
  {
    name: 'buscar_formador',
    description: 'Busca um formador pelo ID',
    parameters: z.object({
      id: z.string().description('ID do formador'),
    }),
    execute: async ({ id }: { id: string }) => {
      const f = await getFormador(id);
      if (!f) return 'Formador não encontrado.';
      return `Formador: ${f.nomeCompleto}\nEmail: ${f.email}\nCPF: ${f.cpf}\nTelefone: ${f.telefone}\nUF: ${f.uf}\nMunicípios: ${f.municipiosResponsaveis.join(', ')}\nDisciplina: ${f.disciplina || 'N/A'}\nBanco: ${f.banco || 'N/A'} ${f.agencia || ''} ${f.conta || ''}\nPIX: ${f.pix || 'N/A'}`;
    },
  },
  {
    name: 'criar_formador',
    description: 'Cria um novo formador no sistema. Gera email automaticamente baseado no nome.',
    parameters: z.object({
      nomeCompleto: z.string().min(3),
      cpf: z.string().min(11),
      telefone: z.string().min(10),
      municipiosResponsaveis: z.array(z.string()).min(1),
      uf: z.string().length(2),
      disciplina: z.string().optional(),
      curriculo: z.string().optional(),
      banco: z.string().optional(),
      agencia: z.string().optional(),
      conta: z.string().optional(),
      pix: z.string().optional(),
    }),
    execute: async (data: any) => {
      const baseName = data.nomeCompleto.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const email = `${baseName}@editoralt.com.br`;
      const id = await createFormador({
        ...data,
        email,
        status: 'preparacao',
      });
      return `Formador criado com sucesso!\nNome: ${data.nomeCompleto}\nEmail: ${email}\nID: ${id}\nMunicípios: ${data.municipiosResponsaveis.join(', ')}\nUF: ${data.uf}`;
    },
  },
  {
    name: 'atualizar_formador',
    description: 'Atualiza dados de um formador existente',
    parameters: z.object({
      id: z.string(),
      nomeCompleto: z.string().optional(),
      telefone: z.string().optional(),
      municipiosResponsaveis: z.array(z.string()).optional(),
      uf: z.string().optional(),
      disciplina: z.string().optional(),
      curriculo: z.string().optional(),
      banco: z.string().optional(),
      agencia: z.string().optional(),
      conta: z.string().optional(),
      pix: z.string().optional(),
    }),
    execute: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      await updateFormador(id, data);
      return `Formador ${id} atualizado com sucesso!`;
    },
  },

  // Formações
  {
    name: 'listar_formacoes',
    description: 'Lista formações, opcionalmente filtradas por status',
    parameters: z.object({
      status: z.enum(['preparacao', 'em-formacao', 'pos-formacao', 'concluido', 'arquivado']).optional(),
    }),
    execute: async ({ status }: { status?: string }) => {
      const formacoes = await listFormacoes(status as any);
      if (formacoes.length === 0) return 'Nenhuma formação encontrada.';
      return formacoes.map(f => `• [${f.status}] ${f.titulo} (${f.municipio}/${f.uf}) - Código: ${f.codigo} - Início: ${f.dataInicio ? new Date(f.dataInicio.toString()).toLocaleDateString('pt-BR') : 'N/A'}`).join('\n');
    },
  },
  {
    name: 'buscar_formacao',
    description: 'Busca uma formação pelo ID',
    parameters: z.object({
      id: z.string(),
    }),
    execute: async ({ id }: { id: string }) => {
      const f = await getFormacao(id);
      if (!f) return 'Formação não encontrada.';
      return `Formação: ${f.titulo}\nCódigo: ${f.codigo}\nStatus: ${f.status}\nMunicípio: ${f.municipio}/${f.uf}\nDescrição: ${f.descricao}\nFormadores: ${f.formadoresNomes?.join(', ') || 'N/A'}\nInício: ${f.dataInicio ? new Date(f.dataInicio.toString()).toLocaleDateString('pt-BR') : 'N/A'}\nFim: ${f.dataFim ? new Date(f.dataFim.toString()).toLocaleDateString('pt-BR') : 'N/A'}`;
    },
  },
  {
    name: 'criar_formacao',
    description: 'Cria uma nova formação. Gera código automaticamente.',
    parameters: z.object({
      titulo: z.string().min(3),
      descricao: z.string().min(10),
      municipio: z.string().min(1),
      uf: z.string().length(2),
      formadoresIds: z.array(z.string()).min(1),
      formadoresNomes: z.array(z.string()).min(1),
      participantes: z.number().optional(),
      dataInicio: z.string().optional().description('Data no formato YYYY-MM-DD'),
      dataFim: z.string().optional().description('Data no formato YYYY-MM-DD'),
    }),
    execute: async (data: any) => {
      const id = await createFormacao({
        ...data,
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : null,
        dataFim: data.dataFim ? new Date(data.dataFim) : null,
      });
      return `Formação criada com sucesso!\nTítulo: ${data.titulo}\nMunicípio: ${data.municipio}/${data.uf}\nID: ${id}\nFormadores: ${data.formadoresNomes.join(', ')}`;
    },
  },
  {
    name: 'atualizar_status_formacao',
    description: 'Atualiza o status de uma formação',
    parameters: z.object({
      id: z.string(),
      status: z.enum(['preparacao', 'em-formacao', 'pos-formacao', 'concluido', 'arquivado']),
    }),
    execute: async ({ id, status }: { id: string; status: string }) => {
      await updateFormacaoStatus(id, status as any);
      return `Status da formação ${id} atualizado para: ${status}`;
    },
  },

  // Projetos
  {
    name: 'listar_projetos',
    description: 'Lista todos os projetos',
    parameters: z.object({}),
    execute: async () => {
      const projetos = await listProjetos();
      if (projetos.length === 0) return 'Nenhum projeto encontrado.';
      return projetos.map(p => `• ${p.municipio}/${p.uf} - Alunos: ${p.qtdAlunos || 'N/A'} - Professores: ${p.qtdProfessores || 'N/A'} - Criado: ${p.dataCriacao ? new Date(p.dataCriacao.toString()).toLocaleDateString('pt-BR') : 'N/A'}`).join('\n');
    },
  },
  {
    name: 'buscar_projeto',
    description: 'Busca um projeto pelo ID',
    parameters: z.object({
      id: z.string(),
    }),
    execute: async ({ id }: { id: string }) => {
      const p = await getProjeto(id);
      if (!p) return 'Projeto não encontrado.';
      return `Projeto: ${p.municipio}/${p.uf}\nVersão: ${p.versao || 'N/A'}\nMaterial: ${p.material || 'N/A'}\nAlunos: ${p.qtdAlunos || 'N/A'}\nProfessores: ${p.qtdProfessores || 'N/A'}\nResponsável: ${p.responsavelNome || 'N/A'}\nDiagnóstica: ${p.diagnostica?.ok ? '✅ Concluída' : '⏳ Pendente'}\nSimulados: S1:${p.simulados?.s1?.ok ? '✅' : '⏳'} S2:${p.simulados?.s2?.ok ? '✅' : '⏳'} S3:${p.simulados?.s3?.ok ? '✅' : '⏳'} S4:${p.simulados?.s4?.ok ? '✅' : '⏳'}`;
    },
  },
  {
    name: 'criar_projeto',
    description: 'Cria um novo projeto de implantação em um município',
    parameters: z.object({
      municipio: z.string().min(1),
      uf: z.string().length(2),
      versao: z.string().optional(),
      material: z.string().optional(),
      qtdAlunos: z.number().optional(),
      qtdProfessores: z.number().optional(),
      formadoresIds: z.array(z.string()).optional(),
      responsavelId: z.string().optional(),
      responsavelNome: z.string().optional(),
    }),
    execute: async (data: any) => {
      const id = await createProjeto(data);
      return `Projeto criado com sucesso!\nMunicípio: ${data.municipio}/${data.uf}\nID: ${id}\nAlunos: ${data.qtdAlunos || 'N/A'}\nProfessores: ${data.qtdProfessores || 'N/A'}`;
    },
  },

  // Demandas
  {
    name: 'listar_demandas',
    description: 'Lista demandas, opcionalmente filtradas por status',
    parameters: z.object({
      status: z.enum(['Pendente', 'Em andamento', 'Concluída', 'Aguardando retorno']).optional(),
    }),
    execute: async ({ status }: { status?: string }) => {
      const demandas = await listDemandas(status as any);
      if (demandas.length === 0) return 'Nenhuma demanda encontrada.';
      return demandas.map(d => `• [${d.status}] ${d.demanda.substring(0, 80)}... - ${d.municipio}/${d.uf} - Resp: ${d.responsavelNome} - Prioridade: ${d.prioridade || 'Normal'}`).join('\n');
    },
  },
  {
    name: 'criar_demanda',
    description: 'Cria uma nova demanda no Diário de Bordo',
    parameters: z.object({
      demanda: z.string().min(5),
      municipio: z.string().min(1),
      uf: z.string().length(2),
      responsavelId: z.string(),
      responsavelNome: z.string(),
      prioridade: z.enum(['Normal', 'Urgente']).optional(),
      prazo: z.string().optional().description('Data no formato YYYY-MM-DD'),
    }),
    execute: async (data: any) => {
      const id = await createDemanda({
        ...data,
        prazo: data.prazo ? new Date(data.prazo) : null,
      });
      return `Demanda criada com sucesso!\nDescrição: ${data.demanda}\nMunicípio: ${data.municipio}/${data.uf}\nResponsável: ${data.responsavelNome}\nPrioridade: ${data.prioridade || 'Normal'}\nID: ${id}`;
    },
  },
  {
    name: 'atualizar_status_demanda',
    description: 'Atualiza o status de uma demanda',
    parameters: z.object({
      id: z.string(),
      status: z.enum(['Pendente', 'Em andamento', 'Concluída', 'Aguardando retorno']),
    }),
    execute: async ({ id, status }: { id: string; status: string }) => {
      await updateDemandaStatus(id, status as any);
      return `Status da demanda ${id} atualizado para: ${status}`;
    },
  },

  // Materiais
  {
    name: 'listar_materiais',
    description: 'Lista todos os materiais de apoio',
    parameters: z.object({}),
    execute: async () => {
      const materiais = await listMateriais();
      if (materiais.length === 0) return 'Nenhum material encontrado.';
      return materiais.map(m => `• [${m.tipoMaterial}] ${m.titulo} - ${m.descricao}`).join('\n');
    },
  },
  {
    name: 'criar_material',
    description: 'Cria um novo material de apoio',
    parameters: z.object({
      titulo: z.string().min(1),
      descricao: z.string().optional(),
      tipoMaterial: z.enum(['PDF', 'Vídeo', 'Link Externo', 'Documento Word', 'Apresentação', 'Pasta']),
      url: z.string().url(),
    }),
    execute: async (data: any) => {
      const id = await createMaterial(data);
      return `Material criado com sucesso!\nTítulo: ${data.titulo}\nTipo: ${data.tipoMaterial}\nURL: ${data.url}\nID: ${id}`;
    },
  },

  // Assessores
  {
    name: 'listar_assessores',
    description: 'Lista todos os assessores',
    parameters: z.object({}),
    execute: async () => {
      const assessores = await listAssessores();
      if (assessores.length === 0) return 'Nenhum assessor encontrado.';
      return assessores.map(a => `• ${a.nomeCompleto} (${a.uf}) - ${a.email}`).join('\n');
    },
  },
  {
    name: 'criar_assessor',
    description: 'Cria um novo assessor',
    parameters: z.object({
      nomeCompleto: z.string().min(3),
      email: z.string().email(),
      cpf: z.string().min(11),
      telefone: z.string().min(10),
      municipiosResponsaveis: z.array(z.string()).min(1),
      uf: z.string().length(2),
      disciplina: z.string().optional(),
      curriculo: z.string().optional(),
      banco: z.string().optional(),
      agencia: z.string().optional(),
      conta: z.string().optional(),
      pix: z.string().optional(),
    }),
    execute: async (data: any) => {
      const id = await createAssessor(data);
      return `Assessor criado com sucesso!\nNome: ${data.nomeCompleto}\nEmail: ${data.email}\nID: ${id}`;
    },
  },

  // Estatísticas
  {
    name: 'estatisticas',
    description: 'Obtém resumo estatístico do sistema',
    parameters: z.object({}),
    execute: async () => {
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
    },
  },
];

export { toolDefinitions, SYSTEM_PROMPT };

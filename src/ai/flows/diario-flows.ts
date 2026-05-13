
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Demanda } from '@/lib/types';

const MelhorarDescricaoInputSchema = z.object({
  descricao: z.string().describe('A descrição original da demanda.'),
});

const ResumirDemandasInputSchema = z.object({
  demandas: z.array(z.any()).describe('A lista de demandas para resumir.'),
});

// Fluxo para melhorar o texto da descrição
export const melhorarDescricaoDemandaFlow = ai.defineFlow(
  {
    name: 'melhorarDescricaoDemandaFlow',
    inputSchema: MelhorarDescricaoInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const prompt = `Você é um assistente de gestão de projetos. Melhore a seguinte descrição de tarefa para ficar mais clara, profissional, objetiva e acionável. Não adicione saudações ou comentários extras, retorne APENAS a descrição melhorada.\n\nDescrição original: ${input.descricao}`;

    const { text } = await ai.generate({ 
      model: 'googleai/gemini-2.5-flash',
      prompt,
      config: {
        temperature: 0.3,
      }
    });
    return text.trim();
  }
);

// Fluxo para resumir uma lista de demandas
export const resumirDemandasFlow = ai.defineFlow(
  {
    name: 'resumirDemandasFlow',
    inputSchema: ResumirDemandasInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const demandas = input.demandas as Demanda[];
    
    if (demandas.length === 0) return "Nenhuma demanda para resumir.";

    let boardData = "Status das Tarefas do Kanban da Equipe:\n";
    demandas.forEach(t => {
      boardData += `- [${t.status}] ${t.demanda} (Tag: ${t.prioridade || 'Normal'}, Responsável: ${t.responsavelNome || 'Não atribuído'})\n`;
    });

    const prompt = `Você é um gerente de equipe excelente. Leia as tarefas atuais do nosso Kanban abaixo e crie um Resumo de Status Executivo para a equipe (em português do Brasil). 
    Regras:
    1. Seja motivador mas profissional.
    2. Identifique quais demandas estão em andamento e quais estão paradas no "A Fazer" (Pendente).
    3. Dê destaque para as demandas com a Tag "Urgente".
    4. Mencione os responsáveis pelos trabalhos.
    5. O texto deve ter de 2 a 3 parágrafos curtos.\n\n${boardData}`;

    const { text } = await ai.generate({ 
      model: 'googleai/gemini-2.5-flash',
      prompt 
    });
    return text;
  }
);

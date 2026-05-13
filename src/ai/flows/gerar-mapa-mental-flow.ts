
'use server';

/**
 * @fileOverview Fluxo de IA para gerar um mapa mental a partir de dados de um relatório de formação.
 *
 * - gerarMapaMental - Função que chama o fluxo de IA.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RespostasAbertasSchema = z.object({
  motivos: z.array(z.string()).describe('Lista de motivos pelos quais o material não atendeu às expectativas.'),
  interesses: z.array(z.string()).describe('Lista de interesses dos participantes para futuras formações.'),
  observacoes: z.array(z.string()).describe('Lista de observações e sugestões gerais.'),
});

const PontosSchema = z.object({
    assuntos: z.record(z.string(), z.number()).optional(),
    organizacao: z.record(z.string(), z.number()).optional(),
    relevancia: z.record(z.string(), z.number()).optional(),
    material: z.record(z.string(), z.number()).optional(),
});

const GerarMapaMentalInputSchema = z.object({
  tituloFormacao: z.string().describe('O título principal da formação.'),
  participantes: z.number().describe('O número total de participantes ou respostas.'),
  formadores: z.array(z.string()).describe('Uma lista com os nomes dos formadores.'),
  mediaGeralFormador: z.number().describe('A média de avaliação geral dos formadores (de 1 a 5).'),
  mediaGeralEditora: z.number().describe('A média de avaliação geral da editora (de 1 a 5).'),
  respostasAbertas: RespostasAbertasSchema.describe('Respostas abertas e qualitativas dos participantes.'),
  pontosFortes: PontosSchema.describe('Dados quantitativos sobre pontos fortes (assuntos, organização, relevância).'),
  pontosMelhorar: PontosSchema.describe('Dados quantitativos sobre pontos a melhorar (material).'),
});

type GerarMapaMentalInput = z.infer<typeof GerarMapaMentalInputSchema>;

// Define o fluxo de IA
const gerarMapaMentalFlow = ai.defineFlow(
  {
    name: 'gerarMapaMentalFlow',
    inputSchema: GerarMapaMentalInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    
    // Constrói o prompt para a IA
    const prompt = `
      Você é um especialista em análise de dados pedagógicos e visualização de informações.
      Sua tarefa é transformar os dados brutos de um relatório de formação em um mapa mental claro e conciso, em formato Markdown.

      O nó central do mapa deve ser o título da formação.
      Crie ramos principais para: Resultados Chave, Equipe, Pontos Fortes, Pontos a Melhorar e Sugestões.
      Sintetize as informações de forma inteligente. Não apenas liste os dados, mas extraia insights.
      Use emojis para tornar o mapa mais visual e agradável.

      Dados do Relatório:
      - Título da Formação: ${input.tituloFormacao}
      - Total de Participantes/Respostas: ${input.participantes}
      - Equipe de Formadores: ${input.formadores.join(', ')}
      - Média de Avaliação (Formadores): ${input.mediaGeralFormador.toFixed(1)} / 5
      - Média de Avaliação (Editora): ${input.mediaGeralEditora.toFixed(1)} / 5
      - Respostas sobre material não atender: ${input.respostasAbertas.motivos.join('; ')}
      - Interesses para futuras formações: ${input.respostasAbertas.interesses.join('; ')}
      - Observações e Sugestões: ${input.respostasAbertas.observacoes.join('; ')}

      Analise os dados quantitativos para identificar os pontos mais votados em cada categoria (pontos fortes e a melhorar).

      Exemplo de Saída:
      - Título da Formação
        - Resultados 📊
          - Média Formadores: 4.8 / 5
          - Média Editora: 4.5 / 5
        - Pontos Fortes ✅
          - Assuntos foram 'Muito Relevantes'.
          - Organização do evento foi 'Ótima'.
        - Pontos a Melhorar ⚠️
          - Material didático atendeu apenas 'Parcialmente'.
            - Motivo: "Faltam exemplos práticos."
        - Sugestões 💡
          - Oferecer workshops práticos.
          - Disponibilizar slides com antecedência.

      Agora, gere o mapa mental para os dados fornecidos.
    `;

    const { text } = await ai.generate({ model: 'googleai/gemini-2.5-flash', prompt });
    return text;
  }
);

// Função de invólucro para ser chamada a partir do front-end
export async function gerarMapaMental(input: GerarMapaMentalInput): Promise<string> {
  return gerarMapaMentalFlow(input);
}

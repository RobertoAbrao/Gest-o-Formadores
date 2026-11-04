/**
 * Itens do checklist de uma formação.
 *
 * Saiu de `detalhes-formacao.tsx` para o card do quadro também mostrar o progresso
 * ("Checklist 14/36") sem abrir o modal. A ordem é a combinada com os assessores.
 * Os `id`s são chaves gravadas em `formacao.checklist` — renomear um id faz o item
 * aparecer desmarcado em todas as formações.
 */

import type { ChecklistItem, Formacao } from '@/lib/types';

export type FaseChecklist = 'antes' | 'dia' | 'apos';

export const CHECKLIST_ITENS: { id: string; label: string; phase: FaseChecklist }[] = [
    // 1. Definições Iniciais (O esqueleto do evento)
    { id: 'antes_levantarParticipantes', label: 'Levantar o quantitativo de participantes', phase: 'antes' },
    { id: 'antes_marcarData', label: 'Marcar data da formação (quantos dias são necessários)', phase: 'antes' },
    { id: 'antes_verificarLocal', label: 'Verificar o local de curso', phase: 'antes' },
    { id: 'antes_elaborarProgramacao', label: 'Elaborar a programação e a ficha de curso para o município', phase: 'antes' },
    { id: 'antes_levantarFormadores', label: 'Levantar o número de formadores necessários', phase: 'antes' },
    { id: 'antes_definirAssessor', label: 'Definir um assessor para acompanhar o evento', phase: 'antes' },
    { id: 'antes_contatoFormadores', label: 'Entrar em contato com os formadores', phase: 'antes' },
    { id: 'antes_enviarFichaCurso', label: 'Enviar ficha de curso', phase: 'antes' },
    { id: 'antes_solicitarBrindes', label: 'Solicitar brindes para a logística', phase: 'antes' },
    { id: 'antes_verificarCoffee', label: 'Verificar quem ficará responsável pelo coffee', phase: 'antes' },

    // 2. Divulgação (Com data, local e programação prontos, já pode divulgar)
    { id: 'antes_divulgarEvento', label: 'Entrar em contato com o pessoal do marketing', phase: 'antes' },

    // 3. Equipe e Logística de Viagem
    { id: 'antes_pedirPassagens', label: 'Pedir passagens', phase: 'antes' },
    { id: 'antes_pedirHospedagens', label: 'Pedir hospedagens', phase: 'antes' },
    { id: 'antes_confirmarPagamentoDiarias', label: 'Confirmar se o pagamento das diárias foi efetuado', phase: 'antes' },

    // 4. Infraestrutura Detalhada do Local
    { id: 'antes_verificarEquipamentos', label: 'Verificar os equipamentos necessários (computador, som, projetor)', phase: 'antes' },
    { id: 'antes_verificarInternet', label: 'Verificar se há internet no local', phase: 'antes' },

    // 5. Materiais de Apoio e Alinhamento Final
    { id: 'antes_atualizarApresentacaoAvaliacao', label: 'Atualizar a apresentação com o QRCode da avaliação', phase: 'antes' },
    { id: 'antes_municipioSlideAtualizado', label: 'Slide atualizado', phase: 'antes' },
    { id: 'antes_reuniaoFormadores', label: 'Fazer reunião com formadores para passar a apresentação e orientações do marketing', phase: 'antes' },
    { id: 'antes_selecionarBanners', label: 'Selecionar os banners para o evento', phase: 'antes' },

    { id: 'dia_testarSistema', label: 'Testar sistema de luz e som com a equipe técnica', phase: 'dia' },
    { id: 'dia_disponibilizarWifi', label: 'Disponibilizar acessos ao wi-fi', phase: 'dia' },
    { id: 'dia_repassarDetalhes', label: 'Repassar últimos detalhes com equipe de recepção do município', phase: 'dia' },
    { id: 'dia_registrarPresenca', label: 'Registrar presença do participante por meio do QRCode e entregar o brinde', phase: 'dia' },
    { id: 'dia_disponibilizarAgua', label: 'Disponibilizar água e copo aos formadores', phase: 'dia' },
    { id: 'dia_desenvolverMarketing', label: 'Desenvolver ações de marketing', phase: 'dia' },
    { id: 'dia_gerenciarDemandas', label: 'Acompanhar e gerenciar qualquer demanda que possa surgir', phase: 'dia' },
    { id: 'dia_organizarHorarios', label: 'Organizar e passar os horários de início, pausa do café e finalização do evento', phase: 'dia' },

    { id: 'apos_leituraAvaliacoes', label: 'Ler as avaliações do encontro', phase: 'apos' },
    { id: 'apos_solicitarRelatorio', label: 'Solicitar relatório de curso aos formadores', phase: 'apos' },
    { id: 'apos_solicitarImagens', label: 'Solicitar imagens para os formadores', phase: 'apos' },
    { id: 'apos_enviarInstrucoesNF', label: 'Enviar instruções para a nota fiscal dos formadores', phase: 'apos' },
    { id: 'apos_emailAgradecimento', label: 'Enviar e-mail de agradecimento para palestrantes, formadores e autoridades', phase: 'apos' },
    { id: 'apos_enviarFormularioMunicipio', label: 'Enviar formulário para o município avaliar a formação', phase: 'apos' },
    { id: 'apos_arquivarMateriais', label: 'Arquivar fotos, vídeos e relatórios', phase: 'apos' },
    { id: 'apos_enviarAvaliacaoIndividual', label: 'Enviar avaliação individual', phase: 'apos' },
];

/** Formações antigas gravaram `true`/`false`; as novas, `{ checked, observation }`. */
export function itemMarcado(valor: ChecklistItem | boolean | undefined): boolean {
  if (typeof valor === 'object' && valor !== null) return !!valor.checked;
  return !!valor;
}

export function progressoChecklist(
  f: Pick<Formacao, 'checklist'>,
  fase?: FaseChecklist
): { feitos: number; total: number } {
  const itens = fase ? CHECKLIST_ITENS.filter((i) => i.phase === fase) : CHECKLIST_ITENS;
  const feitos = itens.filter((i) => itemMarcado(f.checklist?.[i.id])).length;
  return { feitos, total: itens.length };
}

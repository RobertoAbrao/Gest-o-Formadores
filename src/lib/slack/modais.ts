import { format } from 'date-fns';
import type { Demanda } from '@/lib/types';
import { ESTADOS_BR } from '@/lib/estados-br';
import { paraData, truncar } from './texto';
import type { UsuarioApp } from './pessoas';

/**
 * Formulários (modais) do Slack: criar e editar demanda.
 * Cada campo tem `block_id` fixo e `action_id: 'v'`, e é assim que `lerFormulario` acha o valor.
 */

export const MODAL = { criar: 'demanda_criar', editar: 'demanda_editar' } as const;

const texto = (t: string) => ({ type: 'plain_text', text: t });
const opcao = (valor: string, rotulo: string) => ({ text: texto(truncar(rotulo, 75)), value: valor });

const PRIORIDADES = [opcao('Normal', 'Normal'), opcao('Urgente', '🔥 Urgente')];

function campoResponsavel(admins: UsuarioApp[], atualUid?: string) {
  const opcoes = admins.slice(0, 100).map((u) => opcao(u.uid, u.nome));
  const inicial = opcoes.find((o) => o.value === atualUid);
  return {
    type: 'input',
    block_id: 'responsavel',
    label: texto('Responsável'),
    element: {
      type: 'static_select',
      action_id: 'v',
      placeholder: texto('Quem cuida desta demanda'),
      options: opcoes,
      ...(inicial ? { initial_option: inicial } : {}),
    },
  };
}

function campoPrazo(prazo?: unknown) {
  const d = paraData(prazo);
  return {
    type: 'input',
    block_id: 'prazo',
    optional: true,
    label: texto('Prazo'),
    element: { type: 'datepicker', action_id: 'v', ...(d ? { initial_date: format(d, 'yyyy-MM-dd') } : {}) },
  };
}

function campoPrioridade(atual?: string) {
  return {
    type: 'input',
    block_id: 'prioridade',
    label: texto('Prioridade'),
    element: {
      type: 'radio_buttons',
      action_id: 'v',
      options: PRIORIDADES,
      initial_option: PRIORIDADES.find((o) => o.value === atual) ?? PRIORIDADES[0],
    },
  };
}

export function modalCriar(admins: UsuarioApp[], textoInicial: string, criadorUid?: string) {
  return {
    type: 'modal',
    callback_id: MODAL.criar,
    title: texto('Nova demanda'),
    submit: texto('Criar'),
    close: texto('Cancelar'),
    blocks: [
      {
        type: 'input',
        block_id: 'municipio',
        label: texto('Município'),
        element: { type: 'plain_text_input', action_id: 'v', max_length: 100 },
      },
      {
        type: 'input',
        block_id: 'uf',
        label: texto('UF'),
        element: {
          type: 'static_select',
          action_id: 'v',
          placeholder: texto('Estado'),
          options: ESTADOS_BR.map((e) => opcao(e.sigla, `${e.sigla} — ${e.nome}`)),
        },
      },
      {
        type: 'input',
        block_id: 'demanda',
        label: texto('O que precisa ser feito'),
        element: {
          type: 'plain_text_input',
          action_id: 'v',
          multiline: true,
          max_length: 3000,
          ...(textoInicial ? { initial_value: truncar(textoInicial, 3000) } : {}),
        },
      },
      campoResponsavel(admins, criadorUid),
      campoPrazo(),
      campoPrioridade(),
    ],
  };
}

export function modalEditar(d: Demanda, admins: UsuarioApp[]) {
  return {
    type: 'modal',
    callback_id: MODAL.editar,
    private_metadata: JSON.stringify({ id: d.id }),
    title: texto('Editar demanda'),
    submit: texto('Salvar'),
    close: texto('Cancelar'),
    blocks: [
      {
        type: 'context',
        elements: [{ type: 'plain_text', text: truncar(`${d.municipio}/${d.uf}: ${d.demanda}`, 2000) }],
      },
      campoResponsavel(admins, d.responsavelId),
      campoPrazo(d.prazo),
      campoPrioridade(d.prioridade),
    ],
  };
}

/** Valores enviados de um modal, pelo `block_id`. */
export interface Formulario {
  municipio?: string;
  uf?: string;
  demanda?: string;
  responsavelId?: string;
  /** `YYYY-MM-DD` ou vazio. */
  prazo?: string;
  prioridade?: 'Normal' | 'Urgente';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lerFormulario(estado: Record<string, Record<string, any>>): Formulario {
  const v = (bloco: string) => estado?.[bloco]?.v;
  return {
    municipio: v('municipio')?.value?.trim(),
    uf: v('uf')?.selected_option?.value,
    demanda: v('demanda')?.value?.trim(),
    responsavelId: v('responsavel')?.selected_option?.value,
    prazo: v('prazo')?.selected_date || undefined,
    prioridade: v('prioridade')?.selected_option?.value === 'Urgente' ? 'Urgente' : 'Normal',
  };
}

/**
 * `YYYY-MM-DD` → meia-noite em Brasília. É o mesmo instante que o calendário do app
 * grava (o navegador da equipe está em Brasília). Depende de `fuso.ts` já carregado.
 */
export function prazoDoFormulario(iso?: string): Date | null {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);
}

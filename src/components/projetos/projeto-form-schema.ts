/**
 * Schema, tipos e serialização do formulário de Projeto.
 *
 * Extraído de `form-projeto.tsx` para que o robô guiado (`/agente`) possa criar a
 * mesma instância de formulário e gravar os mesmos dados sem duplicar regra.
 * REGRA: este arquivo é a ÚNICA fonte de verdade sobre como um `FormValues` vira
 * documento do Firestore. Se `onSubmit` e o auto-save do robô divergirem aqui,
 * as telas passam a ler formatos diferentes.
 */

import * as z from 'zod';
import { Timestamp } from 'firebase/firestore';
import type { ProjetoImplatancao } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers de conversão Firestore <-> formulário
// ---------------------------------------------------------------------------

export const toDate = (timestamp: Timestamp | null | undefined): Date | null => {
  if (!timestamp) return null;
  return timestamp.toDate();
};

export const timestampOrNull = (date: Date | null | undefined): Timestamp | null => {
  return date ? Timestamp.fromDate(date) : null;
};

/** Remove `undefined` recursivamente — o Firestore rejeita `undefined` em escrita. */
export const cleanObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date || obj instanceof Timestamp) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }
  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined) {
        newObj[key] = cleanObject(value);
      }
    }
  }
  return newObj;
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const etapaStatusSchema = z.object({
  data: z.date().nullable().optional(),
  ok: z.boolean().optional(),
  detalhes: z.string().optional(),
  anexosIds: z.array(z.string()).optional(),
});

const periodoStatusSchema = z.object({
  dataInicio: z.date().nullable().optional(),
  dataFim: z.date().nullable().optional(),
  ok: z.boolean().optional(),
  detalhes: z.string().optional(),
  anexosIds: z.array(z.string()).optional(),
});

const devolutivaLinkSchema = z.object({
  formacaoId: z.string().optional(),
  formacaoTitulo: z.string().optional(),
  dataInicio: z.date().nullable().optional(),
  dataFim: z.date().nullable().optional(),
  formadores: z.array(z.string()).optional(),
  ok: z.boolean().optional(),
  detalhes: z.string().optional(),
  anexosIds: z.array(z.string()).optional(),
  responsavelId: z.string().optional(),
  responsavelNome: z.string().optional(),
});

const linkReuniaoSchema = z.object({
  url: z.string().url('Por favor, insira uma URL válida.').optional().or(z.literal('')),
  descricao: z.string().optional(),
});

const reuniaoSchema = z.object({
  data: z.date().nullable().optional(),
  links: z.array(linkReuniaoSchema).optional(),
});

const eventoAdicionalSchema = z.object({
  titulo: z.string().min(1, 'O título é obrigatório.'),
  data: z.date().nullable().optional(),
  detalhes: z.string().optional(),
  anexosIds: z.array(z.string()).optional(),
});

const implantacaoEntrySchema = z.object({
  titulo: z.string().optional(),
  dataInicio: z.date().nullable().optional(),
  dataFim: z.date().nullable().optional(),
  formadores: z.array(z.string()).optional(),
  detalhes: z.string().optional(),
  formacaoId: z.string().optional(),
  anexosIds: z.array(z.string()).optional(),
});

export const formSchema = z.object({
  municipio: z.string().min(1, { message: 'O município é obrigatório.' }),
  uf: z.string().min(2, { message: 'O estado é obrigatório.' }),
  versao: z.string().optional(),
  material: z.string().optional(),
  brasaoId: z.string().optional(),
  dossieUrl: z.string().url('Por favor, insira uma URL válida.').optional().or(z.literal('')),
  dataMigracao: z.date().nullable(),
  anexo: z.any().optional(), // Campo legado
  implantacoes: z.array(implantacaoEntrySchema).optional(),
  responsavelId: z.string().optional(),
  qtdAlunos: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0).optional()
  ),
  qtdProfessores: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0).optional()
  ),
  formacoesPendentes: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0).optional()
  ),
  formadoresIds: z.array(z.string()).optional(),
  diagnostica: etapaStatusSchema,
  simulados: z.object({
    s1: periodoStatusSchema,
    s2: periodoStatusSchema,
    s3: periodoStatusSchema,
    s4: periodoStatusSchema,
  }),
  devolutivas: z.object({
    d1: devolutivaLinkSchema,
    d2: devolutivaLinkSchema,
    d3: devolutivaLinkSchema,
    d4: devolutivaLinkSchema,
  }),
  reunioes: z.array(reuniaoSchema).optional(),
  eventosAdicionais: z.array(eventoAdicionalSchema).optional(),
});

export type FormValues = z.infer<typeof formSchema>;

export type FileUploadKey =
  | 'diagnostica'
  | 'implantacao'
  | `implantacoes.${number}`
  | 'simulados.s1'
  | 'simulados.s2'
  | 'simulados.s3'
  | 'simulados.s4'
  | 'devolutivas.d1'
  | 'devolutivas.d2'
  | 'devolutivas.d3'
  | 'devolutivas.d4'
  | 'brasao'
  | `eventosAdicionais.${number}`;

// ---------------------------------------------------------------------------
// Firestore -> formulário
// ---------------------------------------------------------------------------

/**
 * Valores iniciais do formulário a partir do documento do projeto.
 * Comportamento idêntico ao `useMemo` que vivia em `form-projeto.tsx`, incluindo
 * o fallback dos campos legados de implantação para o array `implantacoes`.
 */
export function buildDefaultValues(projeto?: ProjetoImplatancao | null): FormValues {
  return {
    municipio: projeto?.municipio || '',
    uf: projeto?.uf || '',
    versao: projeto?.versao || '',
    material: projeto?.material || '',
    brasaoId: projeto?.brasaoId || '',
    dossieUrl: projeto?.dossieUrl || '',
    dataMigracao: toDate(projeto?.dataMigracao),
    anexo: projeto?.anexo || null,
    implantacoes: projeto?.implantacoes
      ? projeto.implantacoes.map((imp) => ({
          titulo: imp.titulo || '',
          dataInicio: toDate(imp.dataInicio),
          dataFim: toDate(imp.dataFim),
          formadores: imp.formadores || [],
          detalhes: imp.detalhes || '',
          formacaoId: imp.formacaoId || '',
          anexosIds: imp.anexosIds || [],
        }))
      : projeto?.dataInicioImplantacao || projeto?.dataFimImplantacao || projeto?.implantacaoDetalhes
        ? [
            {
              titulo: 'Implantação',
              dataInicio: toDate(projeto?.dataInicioImplantacao),
              dataFim: toDate(projeto?.dataFimImplantacao),
              formadores: projeto?.implantacaoFormadores || [],
              detalhes: projeto?.implantacaoDetalhes || '',
              formacaoId: projeto?.implantacaoFormacaoId || '',
              anexosIds: projeto?.implantacaoAnexosIds || [],
            },
          ]
        : [],
    responsavelId: projeto?.responsavelId || '',
    qtdAlunos: projeto?.qtdAlunos || undefined,
    qtdProfessores: projeto?.qtdProfessores || undefined,
    formacoesPendentes: projeto?.formacoesPendentes || undefined,
    formadoresIds: projeto?.formadoresIds || [],
    diagnostica: {
      data: toDate(projeto?.diagnostica?.data),
      ok: projeto?.diagnostica?.ok || false,
      detalhes: projeto?.diagnostica?.detalhes || '',
      anexosIds: projeto?.diagnostica?.anexosIds || [],
    },
    simulados: {
      s1: { dataInicio: toDate(projeto?.simulados?.s1?.dataInicio), dataFim: toDate(projeto?.simulados?.s1?.dataFim), ok: projeto?.simulados?.s1?.ok || false, detalhes: projeto?.simulados?.s1?.detalhes || '', anexosIds: projeto?.simulados?.s1?.anexosIds || [] },
      s2: { dataInicio: toDate(projeto?.simulados?.s2?.dataInicio), dataFim: toDate(projeto?.simulados?.s2?.dataFim), ok: projeto?.simulados?.s2?.ok || false, detalhes: projeto?.simulados?.s2?.detalhes || '', anexosIds: projeto?.simulados?.s2?.anexosIds || [] },
      s3: { dataInicio: toDate(projeto?.simulados?.s3?.dataInicio), dataFim: toDate(projeto?.simulados?.s3?.dataFim), ok: projeto?.simulados?.s3?.ok || false, detalhes: projeto?.simulados?.s3?.detalhes || '', anexosIds: projeto?.simulados?.s3?.anexosIds || [] },
      s4: { dataInicio: toDate(projeto?.simulados?.s4?.dataInicio), dataFim: toDate(projeto?.simulados?.s4?.dataFim), ok: projeto?.simulados?.s4?.ok || false, detalhes: projeto?.simulados?.s4?.detalhes || '', anexosIds: projeto?.simulados?.s4?.anexosIds || [] },
    },
    devolutivas: {
      d1: { ...projeto?.devolutivas?.d1, dataInicio: toDate(projeto?.devolutivas?.d1?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d1?.dataFim), anexosIds: projeto?.devolutivas?.d1?.anexosIds || [] },
      d2: { ...projeto?.devolutivas?.d2, dataInicio: toDate(projeto?.devolutivas?.d2?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d2?.dataFim), anexosIds: projeto?.devolutivas?.d2?.anexosIds || [] },
      d3: { ...projeto?.devolutivas?.d3, dataInicio: toDate(projeto?.devolutivas?.d3?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d3?.dataFim), anexosIds: projeto?.devolutivas?.d3?.anexosIds || [] },
      d4: { ...projeto?.devolutivas?.d4, dataInicio: toDate(projeto?.devolutivas?.d4?.dataInicio), dataFim: toDate(projeto?.devolutivas?.d4?.dataFim), anexosIds: projeto?.devolutivas?.d4?.anexosIds || [] },
    },
    reunioes:
      projeto?.reunioes?.map((r) => ({
        data: toDate(r.data),
        links: r.links
          ? [...r.links, ...Array(4 - r.links.length).fill({ url: '', descricao: '' })].slice(0, 4)
          : Array(4).fill({ url: '', descricao: '' }),
      })) || [],
    eventosAdicionais:
      projeto?.eventosAdicionais?.map((e) => ({
        ...e,
        data: toDate(e.data),
      })) || [],
  } as FormValues;
}

// ---------------------------------------------------------------------------
// Formulário -> Firestore
// ---------------------------------------------------------------------------

/**
 * Converte os valores do formulário no documento a gravar.
 *
 * Já vem limpo (`cleanObject`) e sem o campo legado `anexo`, exatamente como o
 * `onSubmit` fazia inline. Não inclui `id` nem `dataCriacao` — quem cria o
 * documento acrescenta.
 */
export function buildProjetoPayload(values: FormValues, responsavelNome: string): Record<string, any> {
  const dataToSave = {
    ...values,
    responsavelNome,
    dataMigracao: timestampOrNull(values.dataMigracao),
    // Novo formato: array de implantações
    implantacoes: (values.implantacoes || []).map((imp) => ({
      titulo: imp.titulo || '',
      dataInicio: timestampOrNull(imp.dataInicio),
      dataFim: timestampOrNull(imp.dataFim),
      formadores: imp.formadores || [],
      detalhes: imp.detalhes || '',
      formacaoId: imp.formacaoId || '',
      anexosIds: imp.anexosIds || [],
    })),
    // Campos legados (primeira implantação para retrocompatibilidade)
    dataInicioImplantacao: timestampOrNull(values.implantacoes?.[0]?.dataInicio),
    dataFimImplantacao: timestampOrNull(values.implantacoes?.[0]?.dataFim),
    implantacaoFormadores: values.implantacoes?.[0]?.formadores || [],
    implantacaoDetalhes: values.implantacoes?.[0]?.detalhes || '',
    implantacaoFormacaoId: values.implantacoes?.[0]?.formacaoId || '',
    implantacaoAnexosIds: values.implantacoes?.[0]?.anexosIds || [],
    diagnostica: {
      data: timestampOrNull(values.diagnostica.data),
      ok: values.diagnostica.ok,
      detalhes: values.diagnostica.detalhes,
      anexosIds: values.diagnostica.anexosIds,
    },
    simulados: {
      s1: { dataInicio: timestampOrNull(values.simulados.s1.dataInicio), dataFim: timestampOrNull(values.simulados.s1.dataFim), ok: values.simulados.s1.ok, detalhes: values.simulados.s1.detalhes, anexosIds: values.simulados.s1.anexosIds },
      s2: { dataInicio: timestampOrNull(values.simulados.s2.dataInicio), dataFim: timestampOrNull(values.simulados.s2.dataFim), ok: values.simulados.s2.ok, detalhes: values.simulados.s2.detalhes, anexosIds: values.simulados.s2.anexosIds },
      s3: { dataInicio: timestampOrNull(values.simulados.s3.dataInicio), dataFim: timestampOrNull(values.simulados.s3.dataFim), ok: values.simulados.s3.ok, detalhes: values.simulados.s3.detalhes, anexosIds: values.simulados.s3.anexosIds },
      s4: { dataInicio: timestampOrNull(values.simulados.s4.dataInicio), dataFim: timestampOrNull(values.simulados.s4.dataFim), ok: values.simulados.s4.ok, detalhes: values.simulados.s4.detalhes, anexosIds: values.simulados.s4.anexosIds },
    },
    devolutivas: {
      d1: { ...values.devolutivas.d1, dataInicio: timestampOrNull(values.devolutivas.d1.dataInicio), dataFim: timestampOrNull(values.devolutivas.d1.dataFim) },
      d2: { ...values.devolutivas.d2, dataInicio: timestampOrNull(values.devolutivas.d2.dataInicio), dataFim: timestampOrNull(values.devolutivas.d2.dataFim) },
      d3: { ...values.devolutivas.d3, dataInicio: timestampOrNull(values.devolutivas.d3.dataInicio), dataFim: timestampOrNull(values.devolutivas.d3.dataFim) },
      d4: { ...values.devolutivas.d4, dataInicio: timestampOrNull(values.devolutivas.d4.dataInicio), dataFim: timestampOrNull(values.devolutivas.d4.dataFim) },
    },
    reunioes: values.reunioes?.map((reuniao) => ({
      data: timestampOrNull(reuniao.data),
      links: reuniao.links?.filter((link) => link && link.url) || [],
    })),
    eventosAdicionais: values.eventosAdicionais?.map((evento) => ({
      ...evento,
      data: timestampOrNull(evento.data),
    })),
  };

  const cleanedData = cleanObject(dataToSave);
  delete cleanedData.anexo; // Sempre remover o campo legado ao salvar
  return cleanedData;
}

// ---------------------------------------------------------------------------
// Auto-save por etapa (usado pelo robô guiado)
// ---------------------------------------------------------------------------

/**
 * Quais chaves do payload cada etapa do robô precisa gravar.
 *
 * ATENÇÃO ao caso `implantacoes`: o payload mantém campos legados espelhados da
 * PRIMEIRA implantação (`dataInicioImplantacao` etc.) que outras telas ainda leem.
 * Gravar só `implantacoes` deixaria esses espelhos desatualizados — por isso a
 * lista inclui todos eles. Ao mexer em `buildProjetoPayload`, revise este mapa.
 */
export const CHAVES_POR_ETAPA = {
  dadosGerais: ['municipio', 'uf', 'versao', 'material', 'brasaoId', 'dossieUrl', 'dataMigracao', 'qtdAlunos', 'qtdProfessores', 'formacoesPendentes', 'responsavelId', 'responsavelNome'],
  formadores: ['formadoresIds'],
  diagnostica: ['diagnostica'],
  simulados: ['simulados'],
  devolutivas: ['devolutivas'],
  implantacoes: ['implantacoes', 'dataInicioImplantacao', 'dataFimImplantacao', 'implantacaoFormadores', 'implantacaoDetalhes', 'implantacaoFormacaoId', 'implantacaoAnexosIds'],
  reunioes: ['reunioes'],
  eventosAdicionais: ['eventosAdicionais'],
} as const satisfies Record<string, readonly string[]>;

export type EtapaProjeto = keyof typeof CHAVES_POR_ETAPA;

/** Recorta do payload completo apenas as chaves das etapas informadas. */
export function recortarPayload(payload: Record<string, any>, etapas: readonly EtapaProjeto[]): Record<string, any> {
  const recorte: Record<string, any> = {};
  for (const etapa of etapas) {
    for (const chave of CHAVES_POR_ETAPA[etapa]) {
      if (payload[chave] !== undefined) {
        recorte[chave] = payload[chave];
      }
    }
  }
  return recorte;
}

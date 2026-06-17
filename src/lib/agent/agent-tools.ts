import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  addDoc,
  orderBy,
  limit as fbLimit,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  Formador,
  Formacao,
  ProjetoImplatancao,
  Demanda,
  Material,
  Assessor,
  FormadorStatus,
  StatusDemanda,
} from '../types';
import { generateFormationCode } from '../utils';

// ─── FORMADORES ───────────────────────────────────────────────

export async function listFormadores(uf?: string): Promise<Formador[]> {
  const snap = await getDocs(collection(db, 'formadores'));
  const formadores = snap.docs.map(d => ({ id: d.id, ...d.data() } as Formador));
  if (uf) return formadores.filter(f => f.uf === uf);
  return formadores;
}

export async function getFormador(id: string): Promise<Formador | null> {
  const snap = await getDoc(doc(db, 'formadores', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Formador;
}

export async function createFormador(data: Omit<Formador, 'id'>): Promise<string> {
  const ref = doc(collection(db, 'formadores'));
  await setDoc(ref, {
    ...data,
    cpf: data.cpf.replace(/\D/g, ''),
    telefone: data.telefone.replace(/\D/g, ''),
  });
  return ref.id;
}

export async function updateFormador(id: string, data: Partial<Formador>): Promise<void> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      if (key === 'cpf') clean[key] = String(val).replace(/\D/g, '');
      else if (key === 'telefone') clean[key] = String(val).replace(/\D/g, '');
      else clean[key] = val;
    }
  }
  await updateDoc(doc(db, 'formadores', id), clean);
}

// ─── FORMAÇÕES ────────────────────────────────────────────────

export async function listFormacoes(status?: FormadorStatus): Promise<Formacao[]> {
  let q;
  if (status) {
    q = query(collection(db, 'formacoes'), where('status', '==', status));
  } else {
    q = query(collection(db, 'formacoes'), orderBy('dataCriacao', 'desc'), fbLimit(50));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Formacao));
}

export async function getFormacao(id: string): Promise<Formacao | null> {
  const snap = await getDoc(doc(db, 'formacoes', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Formacao;
}

export async function createFormacao(data: {
  titulo: string;
  descricao: string;
  municipio: string;
  uf: string;
  formadoresIds: string[];
  formadoresNomes: string[];
  participantes?: number;
  materiaisIds?: string[];
  dataInicio?: Date | null;
  dataFim?: Date | null;
  projetoId?: string;
}): Promise<string> {
  const ref = doc(collection(db, 'formacoes'));
  const formacaoData: Record<string, unknown> = {
    titulo: data.titulo,
    descricao: data.descricao,
    municipio: data.municipio,
    uf: data.uf,
    formadoresIds: data.formadoresIds,
    formadoresNomes: data.formadoresNomes,
    participantes: data.participantes,
    materiaisIds: data.materiaisIds,
    id: ref.id,
    codigo: generateFormationCode(data.municipio),
    status: 'preparacao',
    avaliacoesAbertas: false,
    dataInicio: data.dataInicio ? Timestamp.fromDate(data.dataInicio) : null,
    dataFim: data.dataFim ? Timestamp.fromDate(data.dataFim) : null,
    dataCriacao: serverTimestamp(),
  };
  await setDoc(ref, formacaoData);
  return ref.id;
}

export async function updateFormacaoStatus(id: string, status: FormadorStatus): Promise<void> {
  await updateDoc(doc(db, 'formacoes', id), { status });
}

// ─── PROJETOS ─────────────────────────────────────────────────

export async function listProjetos(): Promise<ProjetoImplatancao[]> {
  const snap = await getDocs(collection(db, 'projetos'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjetoImplatancao));
}

export async function getProjeto(id: string): Promise<ProjetoImplatancao | null> {
  const snap = await getDoc(doc(db, 'projetos', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ProjetoImplatancao;
}

export async function createProjeto(data: {
  municipio: string;
  uf: string;
  versao?: string;
  material?: string;
  qtdAlunos?: number;
  qtdProfessores?: number;
  formadoresIds?: string[];
  responsavelId?: string;
  responsavelNome?: string;
}): Promise<string> {
  const ref = doc(collection(db, 'projetos'));
  const projetoData: Record<string, unknown> = {
    municipio: data.municipio,
    uf: data.uf,
    versao: data.versao,
    material: data.material,
    qtdAlunos: data.qtdAlunos,
    qtdProfessores: data.qtdProfessores,
    formadoresIds: data.formadoresIds,
    responsavelId: data.responsavelId,
    responsavelNome: data.responsavelNome,
    id: ref.id,
    dataMigracao: null,
    diagnostica: { data: null, ok: false, detalhes: '' },
    simulados: {
      s1: { dataInicio: null, dataFim: null, ok: false, detalhes: '' },
      s2: { dataInicio: null, dataFim: null, ok: false, detalhes: '' },
      s3: { dataInicio: null, dataFim: null, ok: false, detalhes: '' },
      s4: { dataInicio: null, dataFim: null, ok: false, detalhes: '' },
    },
    devolutivas: {
      d1: { ok: false },
      d2: { ok: false },
      d3: { ok: false },
      d4: { ok: false },
    },
    dataCriacao: serverTimestamp(),
  };
  await setDoc(ref, projetoData);
  return ref.id;
}

// ─── DEMANDAS ─────────────────────────────────────────────────

export async function listDemandas(status?: StatusDemanda): Promise<Demanda[]> {
  let q;
  if (status) {
    q = query(collection(db, 'demandas'), where('status', '==', status));
  } else {
    q = query(collection(db, 'demandas'), orderBy('dataCriacao', 'desc'), fbLimit(50));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Demanda));
}

export async function createDemanda(data: {
  demanda: string;
  municipio: string;
  uf: string;
  responsavelId: string;
  responsavelNome: string;
  prioridade?: 'Normal' | 'Urgente';
  prazo?: Date | null;
  status?: StatusDemanda;
}): Promise<string> {
  const ref = doc(collection(db, 'demandas'));
  await setDoc(ref, {
    ...data,
    status: data.status || 'Pendente',
    prioridade: data.prioridade || 'Normal',
    prazo: data.prazo ? Timestamp.fromDate(data.prazo) : null,
    dataCriacao: serverTimestamp(),
    dataAtualizacao: serverTimestamp(),
    origem: 'manual',
  });
  return ref.id;
}

export async function updateDemandaStatus(id: string, status: StatusDemanda): Promise<void> {
  await updateDoc(doc(db, 'demandas', id), {
    status,
    dataAtualizacao: serverTimestamp(),
  });
}

// ─── MATERIAIS ────────────────────────────────────────────────

export async function listMateriais(): Promise<Material[]> {
  const snap = await getDocs(collection(db, 'materiais'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Material));
}

export async function createMaterial(data: {
  titulo: string;
  descricao: string;
  tipoMaterial: Material['tipoMaterial'];
  url: string;
}): Promise<string> {
  const ref = doc(collection(db, 'materiais'));
  await setDoc(ref, {
    ...data,
    dataUpload: serverTimestamp(),
  });
  return ref.id;
}

// ─── ASSESSORES ───────────────────────────────────────────────

export async function listAssessores(): Promise<Assessor[]> {
  const snap = await getDocs(collection(db, 'assessores'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Assessor));
}

export async function createAssessor(data: Omit<Assessor, 'id'>): Promise<string> {
  const ref = doc(collection(db, 'assessores'));
  await setDoc(ref, {
    ...data,
    cpf: data.cpf.replace(/\D/g, ''),
    telefone: data.telefone.replace(/\D/g, ''),
  });
  return ref.id;
}

// ─── ESTATÍSTICAS ─────────────────────────────────────────────

export async function getStats() {
  const [formadoresSnap, formacoesSnap, projetosSnap, demandasSnap] = await Promise.all([
    getDocs(collection(db, 'formadores')),
    getDocs(collection(db, 'formacoes')),
    getDocs(collection(db, 'projetos')),
    getDocs(collection(db, 'demandas')),
  ]);

  const formacoes = formacoesSnap.docs.map(d => d.data());
  const demandas = demandasSnap.docs.map(d => d.data());

  return {
    totalFormadores: formadoresSnap.size,
    totalFormacoes: formacoesSnap.size,
    totalProjetos: projetosSnap.size,
    totalDemandas: demandasSnap.size,
    formacoesPorStatus: {
      preparacao: formacoes.filter(f => f.status === 'preparacao').length,
      'em-formacao': formacoes.filter(f => f.status === 'em-formacao').length,
      'pos-formacao': formacoes.filter(f => f.status === 'pos-formacao').length,
      concluido: formacoes.filter(f => f.status === 'concluido').length,
      arquivado: formacoes.filter(f => f.status === 'arquivado').length,
    },
    demandasPorStatus: {
      'Pendente': demandas.filter((d: any) => d.status === 'Pendente').length,
      'Em andamento': demandas.filter((d: any) => d.status === 'Em andamento').length,
      'Concluída': demandas.filter((d: any) => d.status === 'Concluída').length,
      'Aguardando retorno': demandas.filter((d: any) => d.status === 'Aguardando retorno').length,
    },
  };
}

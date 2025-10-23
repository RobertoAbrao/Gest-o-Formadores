
import { Timestamp } from 'firebase/firestore';

export type MaterialType = 'PDF' | 'Vídeo' | 'Link Externo' | 'Documento Word' | 'Apresentação' | 'Pasta';
export type FormadorStatus = 'preparacao' | 'em-formacao' | 'pos-formacao' | 'concluido' | 'arquivado';
export type TipoDespesa = 'Alimentação' | 'Transporte' | 'Hospedagem' | 'Material Didático' | 'Outros';


export interface Formador {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf: string;
  telefone: string;
  municipiosResponsaveis: string[];
  uf: string;
  curriculo?: string;
  disciplina?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pix?: string;
  status?: FormadorStatus;
}

export interface Assessor {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf: string;
  telefone: string;
  municipiosResponsaveis: string[];
  uf: string;
  curriculo?: string;
  disciplina?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pix?: string;
}

export interface Material {
  id: string;
  titulo: string;
  descricao: string;
  tipoMaterial: MaterialType;
  dataUpload: Timestamp;
  url: string; // URL para acesso (download, link externo, vídeo)
}

export interface Anexo {
    nome: string;
    url: string;
    dataUpload: Timestamp;
}

export interface LogisticaViagem {
  formadorId: string;
  formadorNome: string;
  localPartida: string;
  dataIda: Timestamp | null;
  dataVolta: Timestamp | null;
  hotel: string;
  checkin: Timestamp | null;
  checkout: Timestamp | null;
  valorHospedagem?: number | null;
  alertaLembrete?: string;
  diasLembrete?: number;
}

export interface Formacao {
  id:string;
  codigo: string;
  titulo: string;
  descricao: string;
  status: FormadorStatus;
  municipio: string;
  uf: string;
  participantes?: number;
  dataInicio: Timestamp | null;
  dataFim: Timestamp | null;
  formadoresIds: string[];
  formadoresNomes?: string[];
  materiaisIds: string[];
  anexos?: Anexo[];
  avaliacoesAbertas?: boolean;
  logistica?: LogisticaViagem[];
}

export interface Despesa {
    id: string;
    formadorId: string;
    formacaoId: string;
    formadorNome?: string; // Adicionado para facilitar a exibição
    data: Timestamp;
    tipo: TipoDespesa;
    descricao: string;
    valor: number;
    comprovanteUrl?: string; // URL para o comprovante
}

export interface Lembrete {
    id: string;
    titulo: string;
    data: Timestamp;
    concluido: boolean;
    dataCriacao: Timestamp;
}

export interface Avaliacao {
    id: string;
    formacaoId: string;
    formacaoTitulo?: string;
    formadorId: string;
    formadorNome: string;
    nomeCompleto: string;
    email: string;
    uf: string;
    cidade: string;
    modalidade: 'Presencial' | 'On-line';
    funcao: string;
    dataFormacao: Timestamp;
    etapaEnsino: string;
    materialTema: string[];
    avaliacaoAssuntos: 'Pouco relevantes' | 'Relevantes' | 'Muito relevantes' | 'Fundamentais';
    avaliacaoOrganizacao: 'Ótima' | 'Boa' | 'Ruim';
    avaliacaoRelevancia: 'Ótima' | 'Boa' | 'Ruim';
    materialAtendeExpectativa: 'Sim' | 'Não' | 'Parcialmente';
    motivoMaterialNaoAtende?: string;
    interesseFormacao?: string;
    avaliacaoEditora: '1' | '2' | '3' | '4' | '5';
    avaliacaoFormador?: '1' | '2' | '3' | '4' | '5';
    observacoes?: string;
    dataCriacao: Timestamp;
}

interface EtapaStatus {
  data: Timestamp | null;
  ok?: boolean;
  detalhes?: string;
}

interface PeriodoStatus {
  dataInicio?: Timestamp | null;
  dataFim?: Timestamp | null;
  ok?: boolean;
  detalhes?: string;
}

export interface DevolutivaLink {
  formacaoId?: string;
  formacaoTitulo?: string;
  dataInicio?: Timestamp | null;
  dataFim?: Timestamp | null;
  formadores?: string[];
  ok?: boolean;
  detalhes?: string;
}

interface LinkReuniao {
    url: string;
    descricao: string;
}

interface Reuniao {
    data: Timestamp | null;
    links: LinkReuniao[];
}

export interface ProjetoImplatancao {
  id: string;
  municipio: string;
  uf: string;
  versao?: string;
  material?: string;
  dataMigracao: Timestamp | null;
  qtdAlunos?: number;
  formacoesPendentes?: number;
  formadoresIds?: string[];
  dataImplantacao: Timestamp | null;
  implantacaoFormacaoId?: string;
  
  diagnostica: EtapaStatus;
  simulados: {
    s1: PeriodoStatus;
    s2: PeriodoStatus;
    s3: PeriodoStatus;
    s4: PeriodoStatus;
  };
  devolutivas: {
    d1: DevolutivaLink;
    d2: DevolutivaLink;
    d3: DevolutivaLink;
    d4: DevolutivaLink;
  };

  reunioes?: Reuniao[];

  dataCriacao: Timestamp;
}

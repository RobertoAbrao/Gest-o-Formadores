
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
    id?: string;
    nome: string;
    url: string;
    dataUpload: Timestamp;
    formacaoId?: string;
    projetoId?: string;
    etapa?: string;
}

export interface LogisticaViagem {
  formadorId: string;
  formadorNome: string;
  // Dados do formador (para referência, podem ser preenchidos no form)
  cpf?: string;
  rg?: string;
  dataNascimento?: Timestamp | null;
  pix?: string;

  // Transporte
  valorPassagem?: number | null;
  trecho?: string;

  // Hospedagem
  hotel?: string;
  checkin?: Timestamp | null;
  checkout?: Timestamp | null;
  valorDiaria?: number | null;
  
  // Remuneração
  valorAcertadoPeriodo?: number | null;
  adiantamento?: number | null;
  custosExtras?: number | null;
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
  checklist?: Record<string, boolean>;
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
  anexosIds?: string[];
}

interface PeriodoStatus {
  dataInicio?: Timestamp | null;
  dataFim?: Timestamp | null;
  ok?: boolean;
  detalhes?: string;
  anexosIds?: string[];
}

export interface DevolutivaLink {
  formacaoId?: string;
  formacaoTitulo?: string;
  dataInicio?: Timestamp | null;
  dataFim?: Timestamp | null;
  formadores?: string[];
  ok?: boolean;
  detalhes?: string;
  anexosIds?: string[];
}

interface LinkReuniao {
    url: string;
    descricao: string;
}

interface Reuniao {
    data: Timestamp | null;
    links: LinkReuniao[];
}

interface EventoAdicional {
  titulo: string;
  data: Timestamp | null;
  detalhes?: string;
  anexosIds?: string[];
}

export interface ProjetoImplatancao {
  id: string;
  municipio: string;
  uf: string;
  versao?: string;
  material?: string;
  brasaoId?: string;
  dataMigracao: Timestamp | null;
  anexo?: { nome: string; url: string; dataUpload: Timestamp; }; // Campo legado
  qtdAlunos?: number;
  formacoesPendentes?: number;
  formadoresIds?: string[];
  dataImplantacao: Timestamp | null;
  implantacaoAnexosIds?: string[];
  implantacaoDetalhes?: string;
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
  eventosAdicionais?: EventoAdicional[];

  dataCriacao: Timestamp;
}

export type AgendaRow = {
    dia: string;
    horario: string;
    area: string;
};

export type AgendasState = {
    [formadorId: string]: AgendaRow[];
};

export type LinkOnline = {
    anoArea: string;
    formadorNome: string;
    linkUrl: string;
};

export interface FichaDevolutiva {
    id: string;
    formacaoId: string;
    modalidade: 'online' | 'presencial';
    introducao: string;
    horario: string;
    endereco: string;
    agendas: AgendasState;
    links: LinkOnline[];
    lastUpdated?: Timestamp;
}

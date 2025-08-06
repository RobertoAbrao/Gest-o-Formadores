
import { Timestamp } from 'firebase/firestore';

export type MaterialType = 'PDF' | 'Vídeo' | 'Link Externo' | 'Documento Word';
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
  banco?: string;
  agencia?: string;
  conta?: string;
  pix?: string;
  status?: FormadorStatus;
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

export interface Formacao {
  id:string;
  titulo: string;
  descricao: string;
  status: FormadorStatus;
  municipio: string;
  uf: string;
  dataInicio: Timestamp | null;
  dataFim: Timestamp | null;
  formadoresIds: string[];
  materiaisIds: string[];
  anexos?: Anexo[]; 
}

export interface Despesa {
    id: string;
    formadorId: string;
    data: Timestamp;
    tipo: TipoDespesa;
    descricao: string;
    valor: number;
    comprovanteUrl?: string; // URL para o comprovante
}

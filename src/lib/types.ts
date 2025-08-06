import { Timestamp } from 'firebase/firestore';

export type MaterialType = 'PDF' | 'Vídeo' | 'Link Externo' | 'Documento Word';
export type FormadorStatus = 'preparacao' | 'em-formacao' | 'pos-formacao' | 'concluido';

export interface Formador {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf: string;
  telefone: string;
  municipiosResponsaveis: string[];
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

export interface Formacao {
  id: string;
  titulo: string;
  descricao: string;
  status: FormadorStatus;
  municipio: string;
  dataInicio: Timestamp | null;
  dataFim: Timestamp | null;
  formadoresIds: string[];
  materiaisIds: string[];
  detalhes?: string; // Campo para atas, fotos, etc.
}

import { Timestamp } from 'firebase/firestore';

export type MaterialType = 'PDF' | 'Vídeo' | 'Link Externo' | 'Documento Word';
export type FormadorStatus = 'nao-iniciado' | 'em-formacao' | 'ativo' | 'inativo';

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

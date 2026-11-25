import type { Timestamp } from 'firebase/firestore';
import type { Anexo } from '@/lib/types';
import { AnexoRecusadoError } from './preparar-arquivo';

type DadosAnexo = Omit<Anexo, 'id'>;

export interface EnviarAnexoParams {
  arquivo: File;
  /** A quem o anexo pertence: projetoId + etapa, formacaoId, demandaId... e o autor. */
  vinculo: Omit<DadosAnexo, 'nome' | 'url' | 'dataUpload'>;
  /** Transforma o arquivo no texto (data URL) que vai dentro do documento. */
  preparar: (arquivo: File) => Promise<string>;
  /** ID do documento novo — no app, `doc(collection(db, 'anexos')).id`. */
  novoId: () => string;
  /** Grava no Firestore — no app, `setDoc(doc(db, 'anexos', id), dados)`. */
  gravar: (id: string, dados: DadosAnexo) => Promise<void>;
  agora: () => Timestamp;
}

/**
 * Envia um anexo e só resolve depois que o Firestore confirmou a gravação.
 *
 * Por que o `await` é o ponto: o form de projeto disparava o `setDoc` sem esperar e
 * mostrava "Anexo enviado" na hora. Quando o Firestore recusava (foto acima de 1 MB),
 * a recusa ia só para o console e a pessoa achava que tinha salvo (Sumaré, 25/11/2026).
 * Quem chama mostra o sucesso DEPOIS deste await, e o erro no catch.
 */
export async function enviarAnexo(p: EnviarAnexoParams): Promise<{ id: string; anexo: DadosAnexo }> {
  const url = await p.preparar(p.arquivo);
  const anexo: DadosAnexo = { ...p.vinculo, nome: p.arquivo.name, url, dataUpload: p.agora() };
  const id = p.novoId();
  await p.gravar(id, anexo);
  return { id, anexo };
}

/**
 * Texto do aviso de erro para quem está na tela. O erro técnico vai para o console.
 * Recusa de tamanho/formato já vem com a mensagem pronta; recusa do banco ganha o código,
 * para dar para diagnosticar pelo print do aviso.
 */
export function mensagemDeFalhaNoAnexo(erro: unknown): string {
  if (erro instanceof AnexoRecusadoError) return erro.message;
  const codigo = (erro as { code?: unknown } | null)?.code;
  if (typeof codigo === 'string') return `O banco recusou a gravação (${codigo}). Nada foi salvo — tente de novo.`;
  return 'Não foi possível enviar o arquivo. Nada foi salvo — tente de novo.';
}

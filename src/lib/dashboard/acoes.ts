'use client';

/**
 * O que o Dashboard grava. Fica fora dos componentes para a tela só desenhar e para
 * cada escrita ter um lugar só.
 */

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/hooks/use-auth';
import type { Demanda, HistoricoItem, StatusDemanda } from '@/lib/types';

function itemDeHistorico(texto: string, user: User | null): HistoricoItem {
  return {
    id: doc(collection(db, 'demandas')).id,
    data: Timestamp.now(),
    autorId: user?.uid ?? '',
    autorNome: user?.nome ?? 'Usuário',
    tipo: 'alteracao',
    texto,
  };
}

/**
 * Muda o status do jeito que o Diário de Bordo muda (`moverStatus` em
 * src/app/(app)/diario/page.tsx): status + histórico + dataAtualizacao. Sem o
 * histórico, a demanda resolvida pelo Dashboard ficaria com um buraco na linha do tempo.
 */
export async function mudarStatusDemanda(
  demanda: Pick<Demanda, 'id' | 'status' | 'validado'>,
  status: StatusDemanda,
  user: User | null,
): Promise<void> {
  const historico = [itemDeHistorico(`Status alterado de "${demanda.status}" para "${status}" (pelo Dashboard).`, user)];
  const payload: UpdateData<DocumentData> = { status, dataAtualizacao: serverTimestamp() };
  // Reabrir uma demanda validada invalida a validação — mesma regra do Diário.
  if (status !== 'Concluída' && demanda.validado) {
    payload.validado = false;
    historico.push(itemDeHistorico('Validação removida: a demanda foi reaberta.', user));
  }
  payload.historico = arrayUnion(...historico);
  await updateDoc(doc(db, 'demandas', demanda.id), payload);
}

export function marcarLembrete(id: string, concluido: boolean): Promise<void> {
  return updateDoc(doc(db, 'lembretes', id), { concluido });
}

export async function criarLembrete(titulo: string, data: Date, user: User | null): Promise<void> {
  await addDoc(collection(db, 'lembretes'), {
    titulo,
    data: Timestamp.fromDate(data),
    concluido: false,
    dataCriacao: serverTimestamp(),
    criadoPorId: user?.uid ?? null,
    criadoPorNome: user?.nome ?? null,
  });
}

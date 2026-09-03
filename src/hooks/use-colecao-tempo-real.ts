'use client';

import { useEffect, useState, type DependencyList } from 'react';
import { onSnapshot, type DocumentData, type Query } from 'firebase/firestore';

/**
 * Assina uma query do Firestore e mantém o resultado atualizado ao vivo.
 *
 * Diferença prática para `getDocs`: `getDocs` lê uma vez: quem abriu a tela antes
 * da mudança continua vendo dado velho até recarregar. `onSnapshot` deixa o
 * servidor empurrar cada alteração — um usuário salva, os outros veem na hora.
 *
 * Cancelar a assinatura no unmount não é opcional: sem o `return () => un()`, cada
 * navegação deixa um listener vivo consumindo leituras.
 *
 * ATENÇÃO: não use isto para alimentar um formulário aberto. Um documento chegando
 * do servidor no meio da digitação apagaria o que o usuário escreveu.
 */
export function useColecaoTempoReal<T>(
  montarQuery: () => Query<DocumentData> | null,
  deps: DependencyList
): { dados: T[]; carregando: boolean; erro: Error | null } {
  const [dados, setDados] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<Error | null>(null);

  useEffect(() => {
    const q = montarQuery();
    if (!q) {
      setDados([]);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const cancelar = onSnapshot(
      q,
      (snap) => {
        setDados(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setCarregando(false);
        setErro(null);
      },
      (e) => {
        console.error('Erro na assinatura em tempo real:', e);
        setErro(e as Error);
        setCarregando(false);
      }
    );

    return () => cancelar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { dados, carregando, erro };
}

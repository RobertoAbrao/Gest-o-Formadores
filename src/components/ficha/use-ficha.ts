'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, documentId, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FichaDevolutiva, Formacao, Formador } from '@/lib/types';
import { deFichaSalva, paraFichaSalva, type FichaEditavel } from './ficha-modelo';

/**
 * Carrega a formação do card, a equipe atual e a ficha salva; guarda o que está gravado
 * para saber se há alteração pendente (`sujo`).
 *
 * Tudo que o documento mostra sobre a formação (título, código, município, datas, equipe,
 * currículo) vem daqui, lido pelo id da rota — o mesmo id do card no /quadro.
 */
export function useFicha(formacaoId: string) {
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [ficha, setFicha] = useState<FichaEditavel | null>(null);
  /** JSON do que está no banco, no formato salvo. Comparado com a tela para achar alteração. */
  const [gravado, setGravado] = useState('');
  const [salvaEm, setSalvaEm] = useState<Date | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!formacaoId) return;
    let ativo = true;

    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const formacaoSnap = await getDoc(doc(db, 'formacoes', formacaoId));
        if (!formacaoSnap.exists()) throw new Error('Formação não encontrada. Ela pode ter sido excluída.');
        const formacaoDados = { id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao;

        // `in` aceita até 30 ids por consulta; formação com mais formadores que isso não existe hoje.
        const ids = (formacaoDados.formadoresIds ?? []).slice(0, 30);
        let formadores: Formador[] = [];
        if (ids.length > 0) {
          const snap = await getDocs(query(collection(db, 'formadores'), where(documentId(), 'in', ids)));
          const porId = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Formador]));
          // A consulta não devolve na ordem da formação; a ficha segue a ordem cadastrada.
          formadores = ids.map((id) => porId.get(id)).filter((f): f is Formador => !!f);
        }

        const fichaSnap = await getDoc(doc(db, 'fichas_devolutivas', formacaoId));
        const salva = fichaSnap.exists() ? (fichaSnap.data() as Partial<FichaDevolutiva>) : null;
        const editavel = deFichaSalva(salva, formacaoDados, formadores);

        if (!ativo) return;
        setFormacao(formacaoDados);
        setFicha(editavel);
        setGravado(JSON.stringify(paraFichaSalva(editavel, formacaoId)));
        setSalvaEm(salva?.lastUpdated?.toDate?.() ?? null);
      } catch (e) {
        console.error('Erro ao carregar a ficha:', e);
        if (!ativo) return;
        const codigo = (e as { code?: string }).code;
        setErro(
          codigo === 'permission-denied'
            ? 'Só administradores podem abrir a ficha de divulgação.'
            : e instanceof Error
              ? e.message
              : 'Não foi possível carregar a ficha.'
        );
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [formacaoId]);

  const sujo = useMemo(
    () => !!ficha && JSON.stringify(paraFichaSalva(ficha, formacaoId)) !== gravado,
    [ficha, gravado, formacaoId]
  );

  const salvar = useCallback(async (): Promise<boolean> => {
    if (!ficha) return false;
    setSalvando(true);
    try {
      const dados = paraFichaSalva(ficha, formacaoId);
      // SEM merge, de propósito: a tela sempre grava o documento inteiro, e com merge o
      // Firestore mantinha no banco as chaves de mapa que a pessoa tinha removido.
      // Só esta página escreve em fichas_devolutivas.
      await setDoc(doc(db, 'fichas_devolutivas', formacaoId), { ...dados, lastUpdated: serverTimestamp() });
      setGravado(JSON.stringify(dados));
      setSalvaEm(new Date());
      return true;
    } catch (e) {
      console.error('Erro ao salvar a ficha:', e);
      return false;
    } finally {
      setSalvando(false);
    }
  }, [ficha, formacaoId]);

  return { formacao, ficha, setFicha, sujo, salvaEm, carregando, erro, salvando, salvar };
}


import { NextResponse } from 'next/server';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import type { Formacao, Formador } from '@/lib/types';


export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const formacaoId = params.id;

  if (!formacaoId) {
    return NextResponse.json({ error: 'ID da formação é obrigatório' }, { status: 400 });
  }

  try {
    const formacaoRef = doc(db, 'formacoes', formacaoId);
    const formacaoSnap = await getDoc(formacaoRef);

    if (!formacaoSnap.exists()) {
      return NextResponse.json({ error: 'Formação não encontrada' }, { status: 404 });
    }

    const formacaoData = formacaoSnap.data() as Formacao;
    let formadoresNomes: string[] = [];

    if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
        // Firestore limita 'in' a 30 itens. Se houver mais, precisaria de múltiplas queries.
        if (formacaoData.formadoresIds.length > 30) {
            // Lógica de chunking aqui se necessário. Por agora, vamos assumir < 30.
            console.warn("A busca de formadores está limitada a 30 IDs.");
        }
        
        const formadoresRef = collection(db, 'formadores');
        const q = query(formadoresRef, where('__name__', 'in', formacaoData.formadoresIds.slice(0, 30)));
        
        const formadoresSnap = await getDocs(q);
        formadoresNomes = formadoresSnap.docs.map(doc => (doc.data() as Formador).nomeCompleto);
    }
    
    // Retorna apenas os dados públicos necessários
    const publicData = {
        titulo: formacaoData.titulo,
        formadores: formadoresNomes,
        uf: formacaoData.uf,
        municipio: formacaoData.municipio,
    };

    return NextResponse.json(publicData);

  } catch (error) {
    console.error('Erro ao buscar formação (API):', error);
    return NextResponse.json({ error: 'Erro interno do servidor ao buscar dados da formação' }, { status: 500 });
  }
}

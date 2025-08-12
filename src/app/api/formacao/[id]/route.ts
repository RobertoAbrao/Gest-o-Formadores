
import { NextResponse } from 'next/server';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao, Formador } from '@/lib/types';

// This function can be marked `async` if using `await` inside
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const formacaoId = params.id;
    if (!formacaoId) {
      return new NextResponse(JSON.stringify({ error: 'ID da formação é obrigatório.' }), { status: 400 });
    }

    const formacaoRef = doc(db, 'formacoes', formacaoId);
    const formacaoSnap = await getDoc(formacaoRef);

    if (!formacaoSnap.exists()) {
      return new NextResponse(JSON.stringify({ error: 'Formação não encontrada.' }), { status: 404 });
    }

    const formacaoData = formacaoSnap.data() as Formacao;

    let formadorNomes: string[] = [];
    if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
        const qFormadores = query(collection(db, 'formadores'), where('__name__', 'in', formacaoData.formadoresIds));
        const formadoresSnap = await getDocs(qFormadores);
        formadorNomes = formadoresSnap.docs.map(doc => (doc.data() as Formador).nomeCompleto);
    }

    const publicData = {
        titulo: formacaoData.titulo,
        formadorNomes: formadorNomes,
    };

    return NextResponse.json(publicData);

  } catch (error) {
    console.error('Erro na API de formação:', error);
    return new NextResponse(JSON.stringify({ error: 'Erro interno do servidor.' }), { status: 500 });
  }
}

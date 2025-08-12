
import { NextResponse } from 'next/server';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Formacao, Formador } from '@/lib/types';

// Variáveis de ambiente para credenciais de serviço do Firebase
// No ambiente local, você pode usar um arquivo .env.local
// Na Vercel, você deve configurar as variáveis de ambiente nas configurações do projeto
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// Inicializa o Firebase Admin SDK (apenas uma vez)
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const dbAdmin = getFirestore();

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const formacaoId = params.id;

  if (!formacaoId) {
    return NextResponse.json({ error: 'ID da formação é obrigatório' }, { status: 400 });
  }

  try {
    const formacaoRef = dbAdmin.collection('formacoes').doc(formacaoId);
    const formacaoSnap = await formacaoRef.get();

    if (!formacaoSnap.exists) {
      return NextResponse.json({ error: 'Formação não encontrada' }, { status: 404 });
    }

    const formacaoData = formacaoSnap.data() as Formacao;
    let formadoresNomes: string[] = [];

    if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
        const formadoresRef = dbAdmin.collection('formadores');
        const q = query(formadoresRef, where('__name__', 'in', formacaoData.formadoresIds));
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

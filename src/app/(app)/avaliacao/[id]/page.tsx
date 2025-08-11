
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formacao } from '@/lib/types';
import { Loader2, ArrowLeft, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AvaliacaoPage() {
  const params = useParams();
  const router = useRouter();
  const formacaoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [formacao, setFormacao] = useState<Formacao | null>(null);

  const fetchData = useCallback(async () => {
    if (!formacaoId) return;
    setLoading(true);
    try {
      const formacaoRef = doc(db, 'formacoes', formacaoId);
      const formacaoSnap = await getDoc(formacaoRef);
      if (formacaoSnap.exists()) {
        setFormacao({ id: formacaoSnap.id, ...formacaoSnap.data() } as Formacao);
      } else {
        console.error('Formação não encontrada');
      }
    } catch (error) {
      console.error('Erro ao buscar dados da formação:', error);
    } finally {
      setLoading(false);
    }
  }, [formacaoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!formacao) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-xl">Formação não encontrada.</p>
        <Button asChild variant="outline">
          <Link href="/quadro">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Quadro
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6 h-full items-center">
        <div className="w-full max-w-4xl">
            <div className='mb-4'>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/quadro">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar ao Quadro
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-3'>
                        <ClipboardCheck className='h-7 w-7 text-primary' />
                        Formulário de Avaliação
                    </CardTitle>
                    <CardDescription>
                        Formação: <span className='font-semibold text-foreground'>{formacao.titulo}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
                        <h3 className="text-lg font-semibold">Em construção</h3>
                        <p className="text-sm text-muted-foreground">
                            O formulário de avaliação para esta formação estará disponível em breve.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

    
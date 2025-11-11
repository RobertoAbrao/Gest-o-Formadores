
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProjetoImplatancao, Anexo } from '@/lib/types';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RelatorioProjetoPrint } from '@/components/projetos/relatorio-projeto-print';
import Link from 'next/link';

export default function ProjetoRelatorioPage() {
  const params = useParams();
  const projetoId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<ProjetoImplatancao | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projetoId) {
      setError('ID do projeto não encontrado.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const projetoRef = doc(db, 'projetos', projetoId);
      const projetoSnap = await getDoc(projetoRef);
      if (!projetoSnap.exists()) {
        setError('Projeto não encontrado.');
        setLoading(false);
        return;
      }
      const projetoData = { id: projetoSnap.id, ...projetoSnap.data() } as ProjetoImplatancao;
      setProjeto(projetoData);

      // Fetch attachments related to this project
      const anexosQuery = query(collection(db, 'anexos'), where('projetoId', '==', projetoId));
      const anexosSnap = await getDocs(anexosQuery);
      const anexosData = anexosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Anexo));
      setAnexos(anexosData);
      
    } catch (err) {
      console.error(err);
      setError('Falha ao carregar dados do projeto.');
    } finally {
      setLoading(false);
    }
  }, [projetoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Carregando linha do tempo...</p>
      </div>
    );
  }

  if (error) {
    return <div className="flex h-screen w-full items-center justify-center text-red-500">{error}</div>;
  }

  if (!projeto) {
    return <div className="flex h-screen w-full items-center justify-center">Nenhum projeto para exibir.</div>;
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background-color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-container { padding: 0; margin: 0; }
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; height: auto; padding: 1rem; margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="bg-background min-h-screen p-4 sm:p-8">
          <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-start mb-8 no-print">
                  <div>
                    <Button variant="outline" size="sm" asChild>
                          <Link href="/projetos">
                              <ArrowLeft className="mr-2 h-4 w-4" />
                              Voltar
                          </Link>
                      </Button>
                      <p className="text-muted-foreground mt-2 text-sm">Pré-visualização da Linha do Tempo</p>
                  </div>
                  <Button onClick={() => window.print()}>
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir / Salvar PDF
                  </Button>
              </div>
              <div className="printable-area">
                  <RelatorioProjetoPrint 
                      projeto={projeto}
                      anexos={anexos}
                  />
              </div>
          </div>
      </div>
    </>
  );
}

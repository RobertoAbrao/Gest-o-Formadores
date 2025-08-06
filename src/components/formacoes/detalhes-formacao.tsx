
'use client';

import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Formacao, Formador, Material } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Loader2, User, BookOpen, MapPin, Calendar, Paperclip } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

interface DetalhesFormacaoProps {
  formacaoId: string;
}

export function DetalhesFormacao({ formacaoId }: DetalhesFormacaoProps) {
  const [loading, setLoading] = useState(true);
  const [formacao, setFormacao] = useState<Formacao | null>(null);
  const [formador, setFormador] = useState<Formador | null>(null);
  const [materiais, setMateriais] = useState<Material[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!formacaoId) return;
      setLoading(true);

      try {
        // Fetch Formacao
        const formacaoRef = doc(db, 'formacoes', formacaoId);
        const formacaoSnap = await getDoc(formacaoRef);
        if (!formacaoSnap.exists()) {
          console.error('Formação não encontrada');
          return;
        }
        const formacaoData = {
          id: formacaoSnap.id,
          ...formacaoSnap.data(),
        } as Formacao;
        setFormacao(formacaoData);

        // Fetch Formador
        if (formacaoData.formadoresIds && formacaoData.formadoresIds.length > 0) {
          const formadorRef = doc(db, 'formadores', formacaoData.formadoresIds[0]);
          const formadorSnap = await getDoc(formadorRef);
          if (formadorSnap.exists()) {
            setFormador({ id: formadorSnap.id, ...formadorSnap.data() } as Formador);
          }
        }

        // Fetch Materiais
        if (formacaoData.materiaisIds && formacaoData.materiaisIds.length > 0) {
          const q = query(
            collection(db, 'materiais'),
            where('__name__', 'in', formacaoData.materiaisIds)
          );
          const materiaisSnap = await getDocs(q);
          const materiaisData = materiaisSnap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as Material)
          );
          setMateriais(materiaisData);
        }
      } catch (error) {
        console.error('Erro ao buscar detalhes da formação: ', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [formacaoId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!formacao) {
    return <div>Formação não encontrada.</div>;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">{formacao.titulo}</DialogTitle>
        <DialogDescription>{formacao.descricao}</DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[70vh]">
        <div className="space-y-6 p-4">
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Detalhes Gerais</h4>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
                {formador && (
                    <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Formador</p>
                            <p className="font-medium">{formador.nomeCompleto}</p>
                        </div>
                    </div>
                )}
                 <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Município</p>
                        <p className="font-medium">{formacao.municipio}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant="outline">{formacao.status}</Badge>
                    </div>
                </div>
            </div>
          </div>
          
          {materiais.length > 0 && (
            <div className='space-y-4'>
                <h4 className="font-semibold text-lg">Materiais de Apoio</h4>
                <Separator />
                <ul className="list-disc space-y-2 pl-5">
                    {materiais.map(material => (
                        <li key={material.id}>
                            <a href={material.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {material.titulo}
                            </a>
                             <span className='text-xs text-muted-foreground ml-2'>({material.tipoMaterial})</span>
                        </li>
                    ))}
                </ul>
            </div>
          )}

          <div className="space-y-4">
             <h4 className="font-semibold text-lg">Anexos e Atas</h4>
             <Separator />
             <div className="text-sm text-muted-foreground flex items-center justify-center text-center p-8 border-2 border-dashed rounded-md">
                <p>
                    <Paperclip className="h-6 w-6 mx-auto mb-2"/>
                    Em breve: você poderá anexar atas, fotos e outros documentos aqui.
                </p>
             </div>
          </div>

        </div>
      </ScrollArea>
    </>
  );
}


'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Building, Loader2, BookText } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formador } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

export default function PerfilPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [formadorData, setFormadorData] = useState<Formador | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.perfil !== 'formador') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.perfil === 'formador') {
      const fetchFormadorData = async () => {
        if (!user.uid) return;
        setLoading(true);
        try {
          // In a real scenario, you might have a different ID mapping.
          // Here, we assume the formador document ID is the same as the auth UID.
          const docRef = doc(db, 'formadores', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setFormadorData({ id: docSnap.id, ...docSnap.data() } as Formador);
          } else {
            console.log("No such formador document!");
          }
        } catch (error) {
          console.error("Error fetching formador data:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchFormadorData();
    }
  }, [user]);

  if (loading || !user || user.perfil !== 'formador') {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6 h-full items-center">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Meu Perfil</h1>
            <p className="text-muted-foreground">Suas informações cadastrais no portal.</p>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <User className="h-6 w-6 text-primary"/>
                {formadorData?.nomeCompleto || user.nome}
            </CardTitle>
            <CardDescription>
                Seus dados são gerenciados por um administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">{user.email}</span>
            </div>
            {formadorData && (
              <>
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm font-medium">Municípios de Responsabilidade</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formadorData.municipiosResponsaveis.map((municipio) => (
                        <Badge key={municipio} variant="secondary" className="text-base">
                          {municipio}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {formadorData.curriculo && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <BookText className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium">Currículo</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                          {formadorData.curriculo}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

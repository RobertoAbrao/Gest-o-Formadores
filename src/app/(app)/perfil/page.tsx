
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Building, Loader2, BookText, BookMarked } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Formador, Assessor } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

export default function PerfilPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<Formador | Assessor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      setLoading(true);
      try {
        const collectionName = user.perfil === 'formador' ? 'formadores' : 'assessores';
        const docRef = doc(db, collectionName, user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData({ id: docSnap.id, ...docSnap.data() } as Formador | Assessor);
        } else {
          console.log("No such user document!");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [user]);

  if (loading || !user) {
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
                {userData?.nomeCompleto || user.nome}
            </CardTitle>
            <CardDescription>
                {user.perfil === 'administrador' 
                    ? "Você tem acesso total ao sistema."
                    : "Seus dados são gerenciados por um administrador."
                }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">{user.email}</span>
            </div>
            {userData && user.perfil !== 'administrador' && (
              <>
                {(userData as Formador).disciplina && (
                    <div className="flex items-start gap-3">
                      <BookMarked className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium">Disciplina Principal</p>
                        <Badge variant="outline" className="text-base mt-1">
                          {(userData as Formador).disciplina}
                        </Badge>
                      </div>
                    </div>
                )}
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm font-medium">Municípios de Responsabilidade</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {userData.municipiosResponsaveis.map((municipio) => (
                        <Badge key={municipio} variant="secondary" className="text-base">
                          {municipio}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {userData.curriculo && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <BookText className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium">Currículo</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                          {userData.curriculo}
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

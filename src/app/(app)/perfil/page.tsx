'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Building, Loader2 } from 'lucide-react';

export default function PerfilPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Mock data for the trainer profile, would be fetched from Firestore
  const formadorData = {
    nomeCompleto: 'Formador Padrão',
    email: 'formador@exemplo.com',
    cpf: '***.123.456-**',
    telefone: '(99) 9****-1234',
    municipiosResponsaveis: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte'],
  };
  
  useEffect(() => {
    if (user && user.perfil !== 'formador') {
      router.replace('/dashboard');
    }
  }, [user, router]);
  
  if (!user || user.perfil !== 'formador') {
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
                {user.nome}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

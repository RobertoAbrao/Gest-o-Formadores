'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, KeyRound, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import AppLogo from '@/components/AppLogo';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If user is already logged in, redirect based on their profile
    if (user) {
      const targetPath = user.perfil === 'administrador' ? '/dashboard' : '/materiais';
      router.replace(targetPath);
    }
  }, [user, router]);


  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (email === '' || password === '') {
        toast({
          variant: 'destructive',
          title: 'Erro de Validação',
          description: 'Por favor, preencha todos os campos.',
        });
        return;
    }
      
    setLoading(true);
    
    try {
      // The auth provider will handle fetching the user role and data
      await login(email, password);
      
      toast({
        title: 'Login bem-sucedido!',
        description: 'Redirecionando para o painel.',
      });

      // The useEffect hook will handle the redirection once the user state is updated.

    } catch (error: any) {
      console.error(error);
      // Determine the error message
      let errorMessage = 'Ocorreu um erro desconhecido.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        errorMessage = 'As credenciais fornecidas estão incorretas. Verifique seu e-mail e senha.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'Erro no Login',
        description: errorMessage,
      });
    } finally {
        setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <AppLogo />
        </div>
        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center text-primary font-headline">Bem-vindo(a)!</CardTitle>
            <CardDescription className="text-center">Acesse o portal de apoio pedagógico.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full font-bold !mt-8" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

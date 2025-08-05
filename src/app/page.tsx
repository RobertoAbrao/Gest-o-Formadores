'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, KeyRound, Building, UserCog, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth, type UserRole } from '@/hooks/use-auth';
import AppLogo from '@/components/AppLogo';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, assignRole } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('formador');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (user) {
      router.replace('/dashboard');
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
    
    // Assign role before logging in so the auth provider can pick it up
    assignRole(role);

    try {
      await login(email, password);
      
      toast({
        title: 'Login bem-sucedido!',
        description: 'Redirecionando para o painel.',
      });

      // The redirection will be handled by the layout or page components
      // based on the user's role after successful login.
      router.push('/dashboard');

    } catch (error) {
      console.error(error);
      const errorMessage = 'As credenciais fornecidas estão incorretas. Verifique seu e-mail e senha.';
      toast({
        variant: 'destructive',
        title: 'Erro no Login',
        description: errorMessage,
      });
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
              <div className="space-y-3">
                <Label>Acessar como</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(value: UserRole) => setRole(value)}
                  className="flex items-center space-x-4"
                  disabled={loading}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="formador" id="formador" />
                    <Label htmlFor="formador" className="flex items-center gap-2 font-normal">
                      <Building className="h-4 w-4" /> Formador
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="administrador" id="administrador" />
                    <Label htmlFor="administrador" className="flex items-center gap-2 font-normal">
                      <UserCog className="h-4 w-4" /> Administrador
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <Button type="submit" className="w-full font-bold" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

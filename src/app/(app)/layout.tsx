'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookCopy,
  User as UserIcon,
  LogOut,
  Loader2,
  PanelLeft,
  KanbanSquare,
} from 'lucide-react';

import AppLogo from '@/components/AppLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const navLinks =
    user.perfil === 'administrador'
      ? [
          { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/formadores', label: 'Formadores', icon: Users },
          { href: '/materiais', label: 'Materiais', icon: BookCopy },
          { href: '/quadro', label: 'Acompanhamento', icon: KanbanSquare },
        ]
      : [
          { href: '/materiais', label: 'Materiais', icon: BookCopy },
          { href: '/perfil', label: 'Meu Perfil', icon: UserIcon },
        ];

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SidebarNav links={navLinks} user={user} onLogout={handleLogout} />
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <MobileNav links={navLinks} user={user} onLogout={handleLogout} />
          <div className="w-full flex-1">
            {/* Can add a search bar here if needed */}
          </div>
          <UserMenu user={user} onLogout={handleLogout} router={router}/>
        </header>
        <main className="flex-1 p-4 sm:px-6 sm:py-0 md:gap-8 bg-background">{children}</main>
      </div>
    </div>
  );
}

const SidebarNav = ({ links, user, onLogout }: { links: any[], user: any, onLogout: () => void }) => {
    const pathname = usePathname();
  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <AppLogo iconClassName="h-6 w-6" textClassName="text-xl" />
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                    pathname === link.href && 'bg-muted text-primary'
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <Button size="sm" className="w-full" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};

const MobileNav = ({ links, user, onLogout }: { links: any[], user: any, onLogout: () => void }) => {
    const pathname = usePathname();
    return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 md:hidden">
          <PanelLeft className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <nav className="grid gap-2 text-lg font-medium">
          <Link href="/dashboard" className="mb-4">
             <AppLogo iconClassName="h-6 w-6" textClassName="text-xl" />
          </Link>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                  'flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground',
                  pathname === link.href && 'bg-muted text-foreground'
                  )}
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
            <Button size="sm" className="w-full" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
            </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const UserMenu = ({ user, onLogout, router }: { user: any, onLogout: () => void, router: any }) => {
    const getInitials = (name: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full">
          <Avatar>
            <AvatarImage src={undefined} alt={user.nome || 'User'} />
            <AvatarFallback>{getInitials(user.nome)}</AvatarFallback>
          </Avatar>
          <span className="sr-only">Toggle user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.nome}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/perfil')} disabled={user.perfil !== 'formador'}>
            Meu Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

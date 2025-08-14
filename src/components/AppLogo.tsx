import { BookOpenCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppLogoProps = {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
};

export default function AppLogo({ className, iconClassName, textClassName }: AppLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <BookOpenCheck className={cn('h-8 w-8 text-primary', iconClassName)} />
      <h1 className={cn('text-2xl font-bold text-primary font-headline', textClassName)}>
        Gestão de Formadores
      </h1>
    </div>
  );
}

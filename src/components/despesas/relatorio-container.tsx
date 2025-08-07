
'use client';

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export function RelatorioContainer({ children }: { children: React.ReactNode }) {

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-end items-center mb-4 non-printable-area">
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
        <div className="printable-area">
            {children}
        </div>
      </div>
    </div>
  );
}

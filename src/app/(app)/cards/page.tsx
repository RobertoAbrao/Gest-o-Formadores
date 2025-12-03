
'use client';

import { GalleryHorizontal } from "lucide-react";

export default function CardsPage() {
  return (
    <div className="flex flex-col gap-4 py-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Cards de Divulgação</h1>
          <p className="text-muted-foreground">
            Crie e gerencie modelos de cards para as formações.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg mt-8">
        <GalleryHorizontal className="w-12 h-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Funcionalidade em Construção</h3>
        <p className="text-sm text-muted-foreground">
          Em breve você poderá criar e personalizar seus cards de divulgação aqui.
        </p>
      </div>
    </div>
  );
}

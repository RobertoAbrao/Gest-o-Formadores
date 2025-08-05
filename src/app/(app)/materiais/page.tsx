'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, FileText, Video, Link as LinkIcon, Download } from 'lucide-react';
import type { Material, MaterialType } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

const mockMateriais: Material[] = [
  { id: '1', titulo: 'Guia de Planejamento de Aulas', descricao: 'Um guia completo para estruturar aulas eficazes.', tipoMaterial: 'PDF', dataUpload: '2023-10-26' },
  { id: '2', titulo: 'Webinar sobre Inclusão', descricao: 'Gravação do webinar sobre práticas de inclusão em sala de aula.', tipoMaterial: 'Vídeo', dataUpload: '2023-10-25', urlArquivo: '#' },
  { id: '3', titulo: 'Ferramentas Digitais para Educação', descricao: 'Link para uma curadoria de ferramentas online.', tipoMaterial: 'Link Externo', dataUpload: '2023-10-24', urlArquivo: '#' },
  { id: '4', titulo: 'Modelo de Plano de Aula', descricao: 'Documento Word editável para criar planos de aula.', tipoMaterial: 'Documento Word', dataUpload: '2023-10-23' },
  { id: '5', titulo: 'Apostila de Matemática Básica', descricao: 'Material de apoio em PDF para nivelamento.', tipoMaterial: 'PDF', dataUpload: '2023-10-22' },
];

const typeIcons: Record<MaterialType, React.ElementType> = {
  'PDF': FileText,
  'Vídeo': Video,
  'Link Externo': LinkIcon,
  'Documento Word': FileText,
};

const typeColors: Record<MaterialType, string> = {
    'PDF': 'bg-red-100 text-red-800 border-red-200',
    'Vídeo': 'bg-blue-100 text-blue-800 border-blue-200',
    'Link Externo': 'bg-green-100 text-green-800 border-green-200',
    'Documento Word': 'bg-sky-100 text-sky-800 border-sky-200',
}


export default function MateriaisPage() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === 'administrador';

  return (
    <div className="flex flex-col gap-4 py-6 h-full">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Materiais de Apoio</h1>
            <p className="text-muted-foreground">
                {isAdmin ? 'Adicione e gerencie os materiais para os formadores.' : 'Acesse os materiais de apoio mais recentes.'}
            </p>
        </div>
        {isAdmin && (
            <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Material
            </Button>
        )}
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead className="hidden lg:table-cell">Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Data de Upload</TableHead>
              <TableHead className="w-[100px] text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockMateriais.map((material) => {
              const Icon = typeIcons[material.tipoMaterial];
              return (
                <TableRow key={material.id}>
                  <TableCell className="font-medium">{material.titulo}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{material.descricao}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className={`font-mono text-xs ${typeColors[material.tipoMaterial]}`}>
                      <Icon className="mr-1 h-3 w-3" />
                      {material.tipoMaterial}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{new Date(material.dataUpload).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Acessar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

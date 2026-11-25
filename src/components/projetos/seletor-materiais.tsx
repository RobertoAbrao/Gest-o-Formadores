'use client';

/**
 * Campo "Material" do projeto: lista fixa (vários por projeto), com texto antigo preservado.
 *
 * O valor do formulário continua sendo o TEXTO gravado em `material`. Este componente
 * só chama `onChange` quando alguém marca ou desmarca — abrir um projeto antigo e salvar
 * sem tocar aqui grava exatamente o mesmo texto. Regras em `@/lib/projetos/materiais`.
 */

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SELOS_MATERIAIS, alternarMaterial, lerMateriais } from '@/lib/projetos/materiais';

interface SeletorMateriaisProps {
  value?: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
}

export const SeletorMateriais = React.forwardRef<HTMLButtonElement, SeletorMateriaisProps>(
  function SeletorMateriais({ value, onChange, disabled }, ref) {
    const [open, setOpen] = React.useState(false);
    const itens = React.useMemo(() => lerMateriais(value), [value]);
    const marcados = new Set(itens.map((i) => i.nome));
    const antigos = itens.filter((i) => !i.doCatalogo);
    const resumo = itens.map((i) => i.nome).join(', ');

    const alternar = (nome: string) => onChange(alternarMaterial(value, nome));

    const opcao = (nome: string, rotulo: React.ReactNode = nome) => (
      <CommandItem key={nome} value={nome} onSelect={() => alternar(nome)}>
        <span
          className={cn(
            'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary',
            marcados.has(nome) ? 'bg-primary text-primary-foreground' : 'opacity-50'
          )}
        >
          {marcados.has(nome) && <Check className="h-3 w-3" />}
        </span>
        {rotulo}
      </CommandItem>
    );

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn('truncate', !resumo && 'text-muted-foreground')}>
              {resumo || 'Selecione os materiais'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar material..." />
            <CommandList>
              <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
              {SELOS_MATERIAIS.map((grupo) => (
                <CommandGroup key={grupo.selo} heading={grupo.selo}>
                  {grupo.materiais.map((nome) => opcao(nome))}
                </CommandGroup>
              ))}
              {antigos.length > 0 && (
                <CommandGroup heading="Texto antigo (fora da lista)">
                  {antigos.map((i) =>
                    opcao(i.nome, <span className="italic text-muted-foreground">{i.nome}</span>)
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

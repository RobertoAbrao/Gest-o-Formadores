
'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { collection, getDocs, query } from 'firebase/firestore';

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { db } from '@/lib/firebase';
import type { Material } from '@/lib/types';


interface ComboboxMateriaisProjetoProps {
    selected?: string;
    onChange: (selected?: string) => void;
}

export function ComboboxMateriaisProjeto({ selected, onChange }: ComboboxMateriaisProjetoProps) {
  const [open, setOpen] = React.useState(false);
  const [materiais, setMateriais] = React.useState<Material[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchMateriais = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'materiais'));
            const querySnapshot = await getDocs(q);
            const materiaisData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
            setMateriais(materiaisData);
        } catch (error) {
            console.error('Failed to fetch materiais', error);
        } finally {
            setLoading(false);
        }
    };
    fetchMateriais();
  }, []);

  const handleSelect = (materialId: string) => {
    onChange(materialId);
    setOpen(false);
  };
  
  const currentMaterial = materiais.find(m => m.id === selected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading}
        >
          {loading ? 'Carregando...' : (currentMaterial ? currentMaterial.titulo : 'Selecione um material...')}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Buscar material..." />
          <CommandList>
            <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
            <CommandGroup>
              {materiais.map((material) => (
                <CommandItem
                  key={material.id}
                  value={material.titulo}
                  onSelect={() => handleSelect(material.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected === material.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {material.titulo}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
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
import { Badge } from '../ui/badge';
import { db } from '@/lib/firebase';
import type { Material } from '@/lib/types';


interface ComboboxMateriaisProps {
    selected: string[];
    onChange: (selected: string[]) => void;
}

export function ComboboxMateriais({ selected, onChange }: ComboboxMateriaisProps) {
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
    const newSelected = selected.includes(materialId) 
        ? selected.filter(id => id !== materialId)
        : [...selected, materialId];
    onChange(newSelected);
  };
  
  const handleRemove = (materialId: string) => {
    onChange(selected.filter((item) => item !== materialId));
  };
  
  const selectedMateriais = materiais.filter(m => selected.includes(m.id));

  return (
    <div className='space-y-2'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Selecione materiais...'}
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
                        selected.includes(material.id) ? 'opacity-100' : 'opacity-0'
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

      {selectedMateriais.length > 0 && (
        <div className='p-2 bg-muted/50 rounded-md flex flex-wrap gap-2'>
          {selectedMateriais.map((item) => (
            <Badge key={item.id} variant="secondary">
              {item.titulo}
              <button
                type="button"
                className='ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2'
                onClick={() => handleRemove(item.id)}
              >
                <X className='h-3 w-3 text-muted-foreground hover:text-foreground'/>
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

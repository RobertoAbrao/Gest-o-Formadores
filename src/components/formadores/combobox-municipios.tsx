'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Badge } from '../ui/badge';


interface Estado {
    id: number;
    sigla: string;
    nome: string;
}

interface Municipio {
    id: number;
    nome: string;
}

interface ComboboxMunicipiosProps {
    selected: string[];
    onChange: (selected: string[]) => void;
}

export function ComboboxMunicipios({ selected, onChange }: ComboboxMunicipiosProps) {
  const [open, setOpen] = React.useState(false);
  const [estados, setEstados] = React.useState<Estado[]>([]);
  const [selectedEstado, setSelectedEstado] = React.useState<string>('');
  const [municipios, setMunicipios] = React.useState<Municipio[]>([]);
  const [loading, setLoading] = React.useState(false);
  

  React.useEffect(() => {
    const fetchEstados = async () => {
        try {
            const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
            const data = await response.json();
            setEstados(data);
        } catch (error) {
            console.error('Failed to fetch estados', error);
        }
    };
    fetchEstados();
  }, []);
  
  React.useEffect(() => {
    if (!selectedEstado) {
      setMunicipios([]);
      return;
    };

    const fetchMunicipios = async () => {
        setLoading(true);
        try {
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedEstado}/municipios`);
            const data = await response.json();
            setMunicipios(data);
        } catch (error) {
            console.error('Failed to fetch municipios', error);
        } finally {
            setLoading(false);
        }
    };
    fetchMunicipios();
  }, [selectedEstado]);


  const handleSelect = (municipioNome: string) => {
    if (!selected.includes(municipioNome)) {
        onChange([...selected, municipioNome]);
    }
    setOpen(false);
  };
  
  const handleRemove = (municipioNome: string) => {
    onChange(selected.filter((item) => item !== municipioNome));
  };


  return (
    <div className='space-y-2'>
        <div className='flex gap-2'>
            <Select onValueChange={setSelectedEstado} value={selectedEstado}>
                <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                    {estados.map((estado) => (
                        <SelectItem key={estado.id} value={estado.sigla}>
                            {estado.sigla}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                        disabled={!selectedEstado || loading}
                    >
                        {loading ? 'Carregando...' : 'Selecione um município...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar município..." />
                        <CommandList>
                            <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                            <CommandGroup>
                                {municipios.map((municipio) => (
                                    <CommandItem
                                        key={municipio.id}
                                        value={municipio.nome}
                                        onSelect={() => handleSelect(municipio.nome)}
                                    >
                                        <Check
                                            className={cn(
                                                'mr-2 h-4 w-4',
                                                selected.includes(municipio.nome) ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                        {municipio.nome}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
        {selected.length > 0 && (
            <div className='p-2 bg-muted/50 rounded-md flex flex-wrap gap-2'>
                {selected.map((item) => (
                    <Badge key={item} variant="secondary">
                        {item}
                        <button
                            type="button"
                            className='ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2'
                            onClick={() => handleRemove(item)}
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

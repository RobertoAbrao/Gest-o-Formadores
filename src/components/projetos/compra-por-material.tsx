'use client';

/**
 * "O que o município comprou": um bloco por material marcado no campo Material, com
 * anos, componentes e o Livro do Coordenador. Regras e resumo em
 * `@/lib/projetos/compra-material`; o que vai ao banco passa por `limparCompras`.
 */

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CompraMaterial } from '@/lib/types';
import { lerMateriais } from '@/lib/projetos/materiais';
import {
  ANOS_COMPRA,
  ANOS_FUNDAMENTAL,
  COMPONENTES_COMPRA,
  LIVRO_COORDENADOR,
  atualizarCompra,
  compraDe,
  resumirCompra,
} from '@/lib/projetos/compra-material';

interface CompraPorMaterialProps {
  /** Texto do campo Material (quais produtos estão marcados). */
  material?: string;
  value?: CompraMaterial[];
  onChange: (compras: CompraMaterial[]) => void;
}

const ITEM_MARCADO = 'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground';

export function CompraPorMaterial({ material, value, onChange }: CompraPorMaterialProps) {
  const nomes = lerMateriais(material).filter((i) => i.doCatalogo).map((i) => i.nome);

  if (nomes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Marque um material acima para informar os anos e componentes comprados.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {nomes.map((nome) => {
        const compra = compraDe(value, nome);
        const mudar = (mudanca: Partial<Omit<CompraMaterial, 'material'>>) =>
          onChange(atualizarCompra(value, nome, mudanca));
        const todosFundamental = ANOS_FUNDAMENTAL.every((a) => compra.anos.includes(a));
        const resumo = resumirCompra(compra);

        return (
          <div key={nome} className="space-y-3 rounded-md border p-3">
            <p className="font-medium">{nome}</p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Anos</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() =>
                    mudar({
                      anos: todosFundamental
                        ? compra.anos.filter((a) => !ANOS_FUNDAMENTAL.includes(a))
                        : [...new Set([...compra.anos, ...ANOS_FUNDAMENTAL])],
                    })
                  }
                >
                  {todosFundamental ? 'Desmarcar 1º ao 9º' : 'Marcar 1º ao 9º'}
                </Button>
              </div>
              <ToggleGroup
                type="multiple"
                variant="outline"
                size="sm"
                value={compra.anos}
                onValueChange={(anos) => mudar({ anos })}
                className="flex-wrap justify-start"
              >
                {ANOS_COMPRA.map((ano) => (
                  <ToggleGroupItem key={ano.codigo} value={ano.codigo} className={ITEM_MARCADO}>
                    {ano.rotulo}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Componentes</span>
              <ToggleGroup
                type="multiple"
                variant="outline"
                size="sm"
                value={compra.componentes}
                onValueChange={(componentes) => mudar({ componentes })}
                className="flex-wrap justify-start"
              >
                {COMPONENTES_COMPRA.map((c) => (
                  <ToggleGroupItem key={c.codigo} value={c.codigo} title={c.nome} aria-label={c.nome} className={ITEM_MARCADO}>
                    {c.codigo}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(compra.livroCoordenador)}
                onCheckedChange={(marcado) => mudar({ livroCoordenador: marcado === true })}
              />
              {LIVRO_COORDENADOR}
            </label>

            <p className="text-xs text-muted-foreground">
              {resumo ? <>Resumo: <span className="text-foreground">{resumo}</span></> : 'Nada marcado ainda.'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

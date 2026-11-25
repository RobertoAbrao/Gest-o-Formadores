/**
 * O que o município comprou de cada material: anos, componentes e o Livro do Coordenador.
 *
 * Gravado no projeto em `materiaisComprados` (uma entrada por material marcado em
 * `material`). Campo NOVO em 25/11/2026: projeto antigo simplesmente não tem, e todas
 * as telas tratam a ausência como "nada informado".
 *
 * O resumo segue o jeito que a equipe já escrevia à mão, ex.:
 *   "TODOS OS ANOS - 1° AO 9° ANO - LP E MAT + LIVRO DO COORDENADOR"
 *   → "Sabe: Todos os anos (1º ao 9º) - LP e MAT + Livro do Coordenador"
 */
import type { CompraMaterial } from '@/lib/types';
import { lerMateriais } from './materiais';

export const ANOS_COMPRA = [
  { codigo: 'EI', rotulo: 'Educação Infantil' },
  { codigo: '1', rotulo: '1º' },
  { codigo: '2', rotulo: '2º' },
  { codigo: '3', rotulo: '3º' },
  { codigo: '4', rotulo: '4º' },
  { codigo: '5', rotulo: '5º' },
  { codigo: '6', rotulo: '6º' },
  { codigo: '7', rotulo: '7º' },
  { codigo: '8', rotulo: '8º' },
  { codigo: '9', rotulo: '9º' },
] as const;

/** Do 1º ao 9º ano — o atalho "1º ao 9º" do formulário marca exatamente estes. */
export const ANOS_FUNDAMENTAL: readonly string[] = ANOS_COMPRA.filter((a) => a.codigo !== 'EI').map((a) => a.codigo);

export const COMPONENTES_COMPRA = [
  { codigo: 'LP', nome: 'Língua Portuguesa' },
  { codigo: 'MAT', nome: 'Matemática' },
  { codigo: 'CN', nome: 'Ciências da Natureza' },
  { codigo: 'CH', nome: 'Ciências Humanas' },
] as const;

export const LIVRO_COORDENADOR = 'Livro do Coordenador';

const ORDEM_ANOS: readonly string[] = ANOS_COMPRA.map((a) => a.codigo);
const ORDEM_COMPONENTES: readonly string[] = COMPONENTES_COMPRA.map((c) => c.codigo);

/** Mantém só códigos conhecidos, sem repetição, na ordem oficial. */
function ordenar(codigos: readonly string[] | undefined, ordem: readonly string[]): string[] {
  const marcados = new Set(codigos ?? []);
  return ordem.filter((c) => marcados.has(c));
}

/** "a", "a e b", "a, b e c". */
function juntar(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/** [1,2,3,5] → "1º ao 3º e 5º ano". Sequência de 3 ou mais vira faixa; de 2, fica "1º e 2º". */
function resumirFundamental(anos: readonly number[]): string {
  const partes: string[] = [];
  let i = 0;
  while (i < anos.length) {
    let j = i;
    while (j + 1 < anos.length && anos[j + 1] === anos[j] + 1) j++;
    if (j - i >= 2) partes.push(`${anos[i]}º ao ${anos[j]}º`);
    else for (let k = i; k <= j; k++) partes.push(`${anos[k]}º`);
    i = j + 1;
  }
  return `${juntar(partes)} ano`;
}

export function resumirAnos(anos: readonly string[] | undefined): string {
  const codigos = ordenar(anos, ORDEM_ANOS);
  const fundamental = codigos.filter((c) => c !== 'EI').map(Number);
  const temInfantil = codigos.includes('EI');
  if (!temInfantil && fundamental.length === ANOS_FUNDAMENTAL.length) return 'Todos os anos (1º ao 9º)';
  const partes: string[] = [];
  if (temInfantil) partes.push('Educação Infantil');
  if (fundamental.length) partes.push(resumirFundamental(fundamental));
  return juntar(partes);
}

export function resumirComponentes(componentes: readonly string[] | undefined): string {
  return juntar(ordenar(componentes, ORDEM_COMPONENTES));
}

/** Resumo de uma compra, sem o nome do material. Vazio se nada foi marcado. */
export function resumirCompra(compra: Partial<CompraMaterial> | undefined): string {
  if (!compra) return '';
  const base = [resumirAnos(compra.anos), resumirComponentes(compra.componentes)].filter(Boolean).join(' - ');
  if (!compra.livroCoordenador) return base;
  return base ? `${base} + ${LIVRO_COORDENADOR}` : LIVRO_COORDENADOR;
}

export function compraVazia(compra: Partial<CompraMaterial> | undefined): boolean {
  return resumirCompra(compra) === '';
}

/** Produtos do catálogo marcados no texto `material` (texto antigo fica de fora). */
function materiaisDoCatalogo(material: string | null | undefined): string[] {
  return lerMateriais(material).filter((i) => i.doCatalogo).map((i) => i.nome);
}

/** A compra de um material (nova e vazia se ainda não existe). */
export function compraDe(compras: readonly CompraMaterial[] | undefined, material: string): CompraMaterial {
  return compras?.find((c) => c.material === material) ?? { material, anos: [], componentes: [] };
}

/** Troca a compra de um material, mantendo as dos outros. */
export function atualizarCompra(
  compras: readonly CompraMaterial[] | undefined,
  material: string,
  mudanca: Partial<Omit<CompraMaterial, 'material'>>
): CompraMaterial[] {
  const nova = { ...compraDe(compras, material), ...mudanca, material };
  const resto = (compras ?? []).filter((c) => c.material !== material);
  return [...resto, nova];
}

/**
 * O que vai para o Firestore: só materiais AINDA marcados, sem compra vazia, com os
 * códigos limpos e na ordem do texto `material`. Desmarcar um material e salvar apaga
 * a compra dele — enquanto o formulário está aberto, remarcar devolve o que estava.
 */
export function limparCompras(
  compras: readonly CompraMaterial[] | undefined,
  material: string | null | undefined
): CompraMaterial[] {
  const limpas: CompraMaterial[] = [];
  for (const nome of materiaisDoCatalogo(material)) {
    const compra = compras?.find((c) => c.material === nome);
    if (!compra || compraVazia(compra)) continue;
    limpas.push({
      material: nome,
      anos: ordenar(compra.anos, ORDEM_ANOS),
      componentes: ordenar(compra.componentes, ORDEM_COMPONENTES),
      livroCoordenador: Boolean(compra.livroCoordenador),
    });
  }
  return limpas;
}

/** Uma linha por material com compra informada: "Sabe: 1º ao 5º ano - LP e MAT". Para telas e IA. */
export function linhasCompra(
  material: string | null | undefined,
  compras: readonly CompraMaterial[] | undefined
): string[] {
  return limparCompras(compras, material).map((c) => `${c.material}: ${resumirCompra(c)}`);
}

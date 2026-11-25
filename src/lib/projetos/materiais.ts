/**
 * Catálogo fixo de materiais (produtos da Editora LT) que um projeto pode usar.
 *
 * Fonte: menu "Produtos" de https://editoralt.com.br/ (conferido em 25/11/2026),
 * agrupado pelo selo de cada coleção. Produto novo no site = linha nova aqui; é o
 * único lugar a mexer (formulário, robô e chat leem desta lista).
 *
 * COMO É GRAVADO: o documento do projeto continua guardando `material` como TEXTO,
 * com os nomes separados por vírgula ("Sabe, Conecta Enem"). Formato escolhido para
 * não exigir migração: os projetos antigos já têm texto livre nesse campo, e as telas
 * (lista, busca, detalhes, relatório impresso, chat) leem o texto como está.
 *
 * TEXTO ANTIGO: o que foi digitado antes da lista fixa e não bate com nenhum produto
 * é preservado — aparece marcado no formulário como "texto antigo" e só sai do banco
 * se alguém desmarcar. Grafia diferente de um produto ("SABE", "Lumina") é reconhecida
 * e passa a ser gravada com o nome oficial quando o projeto é editado.
 */

/** "Material" aqui é PRODUTO da editora — não confundir com a coleção `materiais` (materiais de apoio). */
export const SELOS_MATERIAIS = [
  { selo: 'Horizontes', materiais: ['Sabe', 'Revisão dos Saberes', 'Conecta Enem', 'Livros Técnicos'] },
  { selo: 'Gralha Azul', materiais: ['Lúmina', 'Robô Garden', 'Trânsito', 'Povos do Brasil', 'Orquestrando', 'Mundo Sustentável'] },
  { selo: 'Serelepes', materiais: ['Peripécias'] },
] as const;

export const MATERIAIS_CATALOGO: readonly string[] = SELOS_MATERIAIS.flatMap((s) => s.materiais);

const SEPARADOR = ', ';

/** Chave de comparação: sem acento, sem diferença de maiúscula, espaços colapsados. */
function chave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const OFICIAL_POR_CHAVE = new Map(MATERIAIS_CATALOGO.map((nome) => [chave(nome), nome]));

export interface ItemMaterial {
  nome: string;
  /** false = texto antigo, gravado antes da lista fixa. */
  doCatalogo: boolean;
}

function item(texto: string): ItemMaterial {
  const oficial = OFICIAL_POR_CHAVE.get(chave(texto));
  return oficial ? { nome: oficial, doCatalogo: true } : { nome: texto.trim(), doCatalogo: false };
}

/** Lê o texto gravado no projeto. Ignora pedaços vazios e repetidos. */
export function lerMateriais(valor?: string | null): ItemMaterial[] {
  if (!valor) return [];
  const vistos = new Set<string>();
  const itens: ItemMaterial[] = [];
  for (const pedaco of valor.split(',')) {
    if (!pedaco.trim()) continue;
    const k = chave(pedaco);
    if (vistos.has(k)) continue;
    vistos.add(k);
    itens.push(item(pedaco));
  }
  return itens;
}

/** Monta o texto a gravar: produtos na ordem do catálogo, depois o texto antigo na ordem em que estava. */
export function escreverMateriais(itens: readonly ItemMaterial[]): string {
  const marcados = new Set(itens.filter((i) => i.doCatalogo).map((i) => i.nome));
  const doCatalogo = MATERIAIS_CATALOGO.filter((nome) => marcados.has(nome));
  const antigos = itens.filter((i) => !i.doCatalogo).map((i) => i.nome);
  return [...doCatalogo, ...antigos].join(SEPARADOR);
}

/** Marca ou desmarca um material, mantendo o resto do que estava gravado (inclusive texto antigo). */
export function alternarMaterial(valor: string | null | undefined, nome: string): string {
  const itens = lerMateriais(valor);
  const k = chave(nome);
  const semEle = itens.filter((i) => chave(i.nome) !== k);
  if (semEle.length < itens.length) return escreverMateriais(semEle);
  return escreverMateriais([...itens, item(nome)]);
}

/**
 * Para quem CRIA projeto sem passar pelo formulário (chat e robô de IA): só aceita
 * produtos do catálogo. Devolve o texto já com a grafia oficial, ou a lista do que
 * ficou de fora — quem chama responde isso à IA, que corrige e tenta de novo.
 */
export function conferirMateriaisNovos(valor?: string | null): { valor?: string; foraDaLista: string[] } {
  const itens = lerMateriais(valor);
  const foraDaLista = itens.filter((i) => !i.doCatalogo).map((i) => i.nome);
  return { valor: itens.length ? escreverMateriais(itens) : undefined, foraDaLista };
}

/** Mensagem para a IA quando ela tenta gravar um material fora do catálogo. */
export function mensagemMaterialForaDaLista(foraDaLista: readonly string[]): string {
  return (
    `Material fora da lista: ${foraDaLista.join(', ')}. ` +
    `Use só estes nomes, separados por vírgula: ${MATERIAIS_CATALOGO.join(', ')}. ` +
    'Se não souber qual é, pergunte ao usuário.'
  );
}

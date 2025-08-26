
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { uf: string } }
) {
  const uf = params.uf.toUpperCase();

  if (!uf || uf.length !== 2) {
    return NextResponse.json({ error: 'UF inválido.' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
    if (!response.ok) {
      throw new Error(`Erro na API do IBGE: ${response.statusText}`);
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro ao buscar municípios:', error);
    return NextResponse.json({ error: 'Falha ao buscar municípios.' }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uf: string }> }
) {
  const resolvedParams = await params;
  const uf = resolvedParams.uf.toUpperCase();

  if (!uf || uf.length !== 2) {
    return NextResponse.json({ error: 'UF inválido.' }, { status: 400 });
  }

  // Timeout de 5 segundos para não travar quando a API externa está inacessível
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `Erro na API: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    const data = await response.json();
    
    // Format to match structure {id, nome}
    const formattedData = data.map((m: any) => ({
      id: parseInt(m.codigo_ibge),
      nome: m.nome
    })).sort((a: any, b: any) => a.nome.localeCompare(b.nome));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Erro ao buscar municípios:', error.name === 'AbortError' ? 'Timeout - API inacessível' : error);
    return NextResponse.json(
      { error: error.name === 'AbortError' ? 'API inacessível (timeout).' : (error.message || 'Falha ao buscar municípios.') },
      { status: 503 }
    );
  }
}


import { RelatorioContainer } from '@/components/despesas/relatorio-container';
import { RelatorioDespesas } from '@/components/despesas/relatorio-despesas';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function RelatorioPage({ params }: { params: { id: string } }) {
  const formacaoId = params.id;

  if (!formacaoId) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>ID da formação não encontrado.</p>
        <Link href="/quadro">
            <Button variant="link">Voltar ao quadro</Button>
        </Link>
      </div>
    );
  }

  return (
    <RelatorioContainer>
        <RelatorioDespesas formacaoId={formacaoId} />
    </RelatorioContainer>
  );
}

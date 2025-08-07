
import { RelatorioDespesas } from '@/components/despesas/relatorio-despesas';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
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
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-end items-center mb-4 non-printable-area">
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
        <div className="printable-area">
            <RelatorioDespesas formacaoId={formacaoId} />
        </div>
      </div>
    </div>
  );
}

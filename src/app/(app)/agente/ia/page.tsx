'use client';

import { AgentChat } from '@/components/agent/AgentChat';

/**
 * Modo IA — mantido fora do menu de propósito.
 *
 * O /agente passou a ser o robô guiado (sem IA). Este chat continua funcionando e
 * acessível por URL direta; nada do motor (`src/lib/agent/agent-engine.ts`,
 * `agent-tools.ts`, `/api/chat`) foi removido. Para voltar a expor, basta
 * acrescentar o link em src/app/(app)/layout.tsx.
 */
export default function AgenteIaPage() {
  return (
    <div className="container mx-auto py-4">
      <AgentChat />
    </div>
  );
}

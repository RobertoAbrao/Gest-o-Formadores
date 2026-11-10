import { atenderSlack } from '@/lib/slack/servidor';
import { tratarComando } from '@/lib/slack/entrada';

// Slash command `/demanda` (Slack → Slash Commands → Request URL).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// O `/demanda importar` publica vários cards depois da resposta.
export const maxDuration = 60;

export function POST(req: Request) {
  return atenderSlack(req, (db, cfg, corpo) => tratarComando(db, cfg, new URLSearchParams(corpo)));
}

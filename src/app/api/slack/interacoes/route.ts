import { atenderSlack } from '@/lib/slack/servidor';
import { tratarInteracao } from '@/lib/slack/entrada';

// Botões e formulários (Slack → Interactivity & Shortcuts → Request URL).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(req: Request) {
  return atenderSlack(req, (db, cfg, corpo) => {
    // O Slack manda `payload=<json>` como formulário.
    const payload = JSON.parse(new URLSearchParams(corpo).get('payload') ?? '{}');
    return tratarInteracao(db, cfg, payload);
  });
}

import { atenderSlack } from '@/lib/slack/servidor';
import { tratarEvento } from '@/lib/slack/entrada';

// Respostas nas threads dos cards (Slack → Event Subscriptions → Request URL).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(req: Request) {
  return atenderSlack(req, (db, cfg, corpo) => tratarEvento(db, cfg, JSON.parse(corpo || '{}')));
}

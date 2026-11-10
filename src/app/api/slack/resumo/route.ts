import { bancoAdmin, configDaVercel } from '@/lib/slack/servidor';
import { enviarResumo } from '@/lib/slack/resumo-envio';

/**
 * Resumo da manhã. Quem chama é o Vercel Cron (`vercel.json`), que manda
 * `Authorization: Bearer <CRON_SECRET>`. Sem o segredo, qualquer um que soubesse a
 * URL poderia encher o canal.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new Response('não autorizado', { status: 401 });
  }
  try {
    await enviarResumo(bancoAdmin(), configDaVercel());
    return Response.json({ ok: true });
  } catch (e) {
    console.error('Slack: erro no resumo diário', e);
    return Response.json({ ok: false }, { status: 500 });
  }
}

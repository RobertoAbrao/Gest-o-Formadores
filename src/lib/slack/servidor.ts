import './fuso';
import { after } from 'next/server';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { assinaturaValida } from './api';
import type { ConfigSlack } from './config';
import type { Tratamento } from './entrada';

/**
 * Peças da Vercel: banco com permissão de servidor, configuração e o "porteiro"
 * comum às rotas `/api/slack/*`.
 *
 * Variáveis de ambiente (Vercel → Settings → Environment Variables), todas SEM o prefixo
 * NEXT_PUBLIC_ — com ele o valor iria parar no navegador:
 *  - FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço (inteiro, ou em base64)
 *  - SLACK_BOT_TOKEN           xoxb-...
 *  - SLACK_SIGNING_SECRET      Basic Information → Signing Secret
 *  - SLACK_CANAL_DEMANDAS      ID do canal (C...)
 *  - SLACK_CANAL_AVISOS        ID do canal (C...)
 *  - APP_URL                   https://... (para os links)
 *  - CRON_SECRET               qualquer texto longo; a Vercel manda no agendamento
 */

export function bancoAdmin(): Firestore {
  if (!getApps().length) {
    const bruto = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim();
    if (!bruto) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada na Vercel.');
    const conta = JSON.parse(bruto.startsWith('{') ? bruto : Buffer.from(bruto, 'base64').toString('utf8'));
    initializeApp({ credential: cert(conta), projectId: conta.project_id });
  }
  return getFirestore();
}

export function configDaVercel(): ConfigSlack {
  const obrigatoria = (nome: string) => {
    const v = process.env[nome]?.trim();
    if (!v) throw new Error(`${nome} não configurada na Vercel.`);
    return v;
  };
  return {
    token: obrigatoria('SLACK_BOT_TOKEN'),
    canalDemandas: obrigatoria('SLACK_CANAL_DEMANDAS'),
    canalAvisos: process.env.SLACK_CANAL_AVISOS?.trim() || obrigatoria('SLACK_CANAL_DEMANDAS'),
    appUrl: process.env.APP_URL?.trim() ?? '',
  };
}

/**
 * Confere a assinatura do Slack, chama o tratador e agenda o "depois" para rodar
 * após a resposta (`after`, que na Vercel segura a função viva até terminar).
 */
export async function atenderSlack(
  req: Request,
  tratar: (db: Firestore, cfg: ConfigSlack, corpoCru: string) => Promise<Tratamento>,
): Promise<Response> {
  const corpoCru = await req.text();
  const ok = assinaturaValida(
    process.env.SLACK_SIGNING_SECRET ?? '',
    req.headers.get('x-slack-request-timestamp'),
    req.headers.get('x-slack-signature'),
    corpoCru,
  );
  if (!ok) return new Response('assinatura inválida', { status: 401 });

  try {
    const r = await tratar(bancoAdmin(), configDaVercel(), corpoCru);
    if (r.depois) {
      const depois = r.depois;
      after(() => depois().catch((e) => console.error('Slack: erro depois da resposta', e)));
    }
    return r.corpo ? Response.json(r.corpo) : new Response(null, { status: 200 });
  } catch (e) {
    console.error('Slack: erro ao atender', e);
    // 200 com texto: o Slack mostra para quem agiu em vez de "falha ao despachar".
    return Response.json({ response_type: 'ephemeral', text: '⚠️ Deu erro do lado do app. Tente de novo em instantes.' });
  }
}

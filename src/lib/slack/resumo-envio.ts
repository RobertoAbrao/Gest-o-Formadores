import { startOfToday } from 'date-fns';
import type { Firestore, QuerySnapshot } from 'firebase-admin/firestore';
import type { Demanda, Formacao, ProjetoImplatancao } from '@/lib/types';
import { QUEUES } from '@/components/diario/diario-utils';
import { chamarSlack } from './api';
import type { ConfigSlack } from './config';
import { montarResumo } from './resumo';

/** Lê o banco, monta o resumo e posta no canal de avisos. Chamado pelo agendador. */
export async function enviarResumo(db: Firestore, cfg: ConfigSlack): Promise<string> {
  const [formacoesSnap, projetosSnap, demandasSnap] = await Promise.all([
    // Mesma consulta do quadro.
    db.collection('formacoes').where('status', '!=', 'arquivado').get(),
    db.collection('projetos').get(),
    db.collection('demandas').get(),
  ]);
  const comId = <T,>(s: QuerySnapshot) => s.docs.map((d) => ({ ...d.data(), id: d.id }) as unknown as T);
  const formacoes = comId<Formacao>(formacoesSnap);
  const projetos = comId<ProjetoImplatancao>(projetosSnap);
  // Validadas não entram em fila nenhuma; tirar antes poupa memória quando o histórico crescer.
  const demandas = comId<Demanda>(demandasSnap).filter((d) => !d.validado);

  // Link do card no Slack só para as que vão aparecer listadas (atrasadas e de hoje).
  const listadas = demandas.filter((d) => d.slackTs && QUEUES.some((q) => (q.id === 'atrasadas' || q.id === 'hoje') && q.match(d)));
  const links = new Map<string, string>();
  await Promise.all(
    listadas.slice(0, 20).map(async (d) => {
      const r = await chamarSlack(cfg.token, 'chat.getPermalink', { channel: d.slackChannel, message_ts: d.slackTs }).catch(() => null);
      if (r?.permalink) links.set(d.id, r.permalink);
    }),
  );

  const texto = montarResumo({ formacoes, projetos, demandas, hoje: startOfToday(), appUrl: cfg.appUrl, links });
  await chamarSlack(cfg.token, 'chat.postMessage', { channel: cfg.canalAvisos, text: texto, unfurl_links: false, unfurl_media: false });
  return texto;
}

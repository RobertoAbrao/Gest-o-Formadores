import '@/lib/slack/fuso';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/firestore';
import * as logger from 'firebase-functions/logger';
import { setGlobalOptions } from 'firebase-functions/options';
import { defineSecret, defineString } from 'firebase-functions/params';
import type { Demanda } from '@/lib/types';
import { chamarSlack } from '@/lib/slack/api';
import { avisoDeCriacao, avisoDeStatusDaFormacao, SEM_AVISO } from '@/lib/slack/avisos';
import type { ConfigSlack } from '@/lib/slack/config';
import { lerDemanda, sincronizarMudanca } from '@/lib/slack/demandas';

/**
 * Gatilhos do Firestore → Slack. Exige o plano Blaze.
 *
 * Só fazem o que a Vercel não consegue: perceber gravações que NASCEM no app (demanda
 * automática, agente, qualquer tela) e avisar tudo que entra no banco. O que nasce no
 * Slack é tratado pelas rotas `/api/slack/*` na Vercel.
 *
 * O código de verdade está em `src/lib/slack/` (o mesmo que a Vercel usa); o esbuild
 * empacota tudo em `lib/index.js` antes do deploy.
 */

// A região TEM de ser a do banco: gatilho do Firestore só roda na mesma localização.
// Conferir com: npx firebase-tools firestore:databases:get "(default)"
// (nam5 → us-central1; southamerica-east1 → southamerica-east1).
const REGIAO = 'us-central1';
setGlobalOptions({ region: REGIAO, maxInstances: 3 });

const SLACK_BOT_TOKEN = defineSecret('SLACK_BOT_TOKEN');
const SLACK_CANAL_DEMANDAS = defineString('SLACK_CANAL_DEMANDAS', { description: 'ID do canal das demandas (C...)' });
const SLACK_CANAL_AVISOS = defineString('SLACK_CANAL_AVISOS', { description: 'ID do canal dos avisos (C...)' });
const APP_URL = defineString('APP_URL', { description: 'Endereço do app na Vercel, para os links (https://...)' });

initializeApp();
const db = getFirestore();

const config = (): ConfigSlack => ({
  token: SLACK_BOT_TOKEN.value(),
  canalDemandas: SLACK_CANAL_DEMANDAS.value(),
  canalAvisos: SLACK_CANAL_AVISOS.value() || SLACK_CANAL_DEMANDAS.value(),
  appUrl: APP_URL.value(),
});

const postarAviso = (cfg: ConfigSlack, texto: string) =>
  chamarSlack(cfg.token, 'chat.postMessage', { channel: cfg.canalAvisos, text: texto, unfurl_links: false, unfurl_media: false });

/**
 * Tudo que entra no banco, em qualquer coleção de primeiro nível.
 * O curinga `{colecao}` pega também coleções criadas no futuro.
 */
export const avisarDocumentoNovo = onDocumentCreated({ document: '{colecao}/{docId}', secrets: [SLACK_BOT_TOKEN] }, async (evento) => {
  const { colecao, docId } = evento.params;
  if (SEM_AVISO.has(colecao) || !evento.data) return;
  const cfg = config();
  const texto = avisoDeCriacao(colecao, docId, evento.data.data(), cfg.appUrl);
  if (texto) await postarAviso(cfg, texto);
});

/** Formação concluída, arquivada ou reaberta. */
export const avisarStatusDaFormacao = onDocumentUpdated({ document: 'formacoes/{id}', secrets: [SLACK_BOT_TOKEN] }, async (evento) => {
  const antes = evento.data?.before.data();
  const depois = evento.data?.after.data();
  if (!antes || !depois) return;
  const cfg = config();
  const texto = avisoDeStatusDaFormacao(antes, depois, cfg.appUrl);
  if (texto) await postarAviso(cfg, texto);
});

/** Demanda criada, mudada ou excluída no app → card e thread no canal das demandas. */
export const sincronizarDemanda = onDocumentWritten({ document: 'demandas/{id}', secrets: [SLACK_BOT_TOKEN] }, async (evento) => {
  const mudanca = evento.data;
  if (!mudanca) return;
  const antes = mudanca.before.exists ? lerDemanda(mudanca.before) : null;
  const depois = mudanca.after.exists ? lerDemanda(mudanca.after) : null;
  const resultado = await sincronizarMudanca(db, config(), mudanca.after.ref, antes as Demanda | null, depois as Demanda | null);
  logger.debug('demanda', { id: evento.params.id, resultado });
});

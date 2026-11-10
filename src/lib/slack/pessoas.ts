import type { Firestore } from 'firebase-admin/firestore';
import { chamarSlack, ErroSlack } from './api';

/**
 * Liga uma pessoa do Slack a um usuário do app (coleção `usuarios`).
 *
 * Regra, nesta ordem:
 *  1. `usuarios/{uid}.slackUserId` preenchido à mão no console do Firebase: vale ele;
 *  2. senão, o e-mail do perfil do Slack igual ao e-mail do usuário no app.
 *
 * Quem não liga ainda consegue agir; o histórico grava "Nome (Slack)" e `autorId`
 * `slack:<id>`. O `/demanda conferir` lista quem ficou sem par para corrigir.
 */

export interface UsuarioApp {
  uid: string;
  nome: string;
  email: string;
  perfil?: string;
  slackUserId?: string;
}

export interface Autor {
  autorId: string;
  autorNome: string;
  /** E-mail do app quando ligado; senão o do Slack. É por ele que se confere quem valida. */
  email: string | null;
  ligado: boolean;
}

// Cache por instância. Usuários mudam pouco e cada clique no Slack tem só 3 segundos.
const VALIDADE_MS = 5 * 60 * 1000;
let cacheUsuarios: { quando: number; lista: UsuarioApp[] } | null = null;
const cachePerfil = new Map<string, { quando: number; nome: string; email: string | null }>();
const cacheIdPorEmail = new Map<string, { quando: number; id: string | null }>();

const fresco = (quando: number) => Date.now() - quando < VALIDADE_MS;
const normalizarEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();

export async function usuariosDoApp(db: Firestore): Promise<UsuarioApp[]> {
  if (cacheUsuarios && fresco(cacheUsuarios.quando)) return cacheUsuarios.lista;
  const snap = await db.collection('usuarios').get();
  const lista = snap.docs.map((d) => {
    const x = d.data();
    return {
      uid: d.id,
      nome: String(x.nome || x.email || 'Sem nome'),
      email: normalizarEmail(x.email),
      perfil: x.perfil,
      slackUserId: x.slackUserId || undefined,
    };
  });
  cacheUsuarios = { quando: Date.now(), lista };
  return lista;
}

/** Mesma lista que o formulário do Diário oferece como responsável. */
export async function responsaveisPossiveis(db: Firestore): Promise<UsuarioApp[]> {
  return (await usuariosDoApp(db))
    .filter((u) => u.perfil === 'administrador')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function perfilSlack(token: string, slackId: string) {
  const emCache = cachePerfil.get(slackId);
  if (emCache && fresco(emCache.quando)) return emCache;
  const r = await chamarSlack(token, 'users.info', { user: slackId });
  const perfil = {
    quando: Date.now(),
    nome: String(r.user?.profile?.real_name || r.user?.real_name || r.user?.name || slackId),
    email: normalizarEmail(r.user?.profile?.email) || null,
  };
  cachePerfil.set(slackId, perfil);
  return perfil;
}

export async function autorDoSlack(db: Firestore, token: string, slackId: string): Promise<Autor> {
  const [usuarios, perfil] = await Promise.all([usuariosDoApp(db), perfilSlack(token, slackId)]);
  const u =
    usuarios.find((x) => x.slackUserId === slackId) ??
    (perfil.email ? usuarios.find((x) => x.email === perfil.email) : undefined);
  if (u) return { autorId: u.uid, autorNome: u.nome, email: u.email, ligado: true };
  return { autorId: `slack:${slackId}`, autorNome: `${perfil.nome} (Slack)`, email: perfil.email, ligado: false };
}

/** ID do Slack de um usuário do app, para marcar com @. `null` se não achar. */
export async function slackDoUsuario(db: Firestore, token: string, uid: string | undefined): Promise<string | null> {
  if (!uid) return null;
  const u = (await usuariosDoApp(db)).find((x) => x.uid === uid);
  if (!u) return null;
  if (u.slackUserId) return u.slackUserId;
  if (!u.email) return null;

  const emCache = cacheIdPorEmail.get(u.email);
  if (emCache && fresco(emCache.quando)) return emCache.id;
  let id: string | null = null;
  try {
    const r = await chamarSlack(token, 'users.lookupByEmail', { email: u.email });
    id = r.user?.id ?? null;
  } catch (e) {
    if (!(e instanceof ErroSlack && e.codigo === 'users_not_found')) throw e;
  }
  cacheIdPorEmail.set(u.email, { quando: Date.now(), id });
  return id;
}

interface MembroSlack {
  id: string;
  nome: string;
  email: string;
}

async function membrosDoSlack(token: string): Promise<MembroSlack[]> {
  const membros: MembroSlack[] = [];
  let cursor: string | undefined;
  do {
    const r = await chamarSlack(token, 'users.list', { limit: 200, cursor });
    for (const m of r.members ?? []) {
      if (m.deleted || m.is_bot || m.id === 'USLACKBOT') continue;
      membros.push({
        id: m.id,
        nome: String(m.profile?.real_name || m.real_name || m.name),
        email: normalizarEmail(m.profile?.email),
      });
    }
    cursor = r.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return membros;
}

/** Relatório do `/demanda conferir`: quem liga, quem sobra de cada lado. */
export async function conferirLigacoes(db: Firestore, token: string): Promise<string> {
  cacheUsuarios = null; // conferir é para ver o estado de agora
  const [usuarios, membros] = await Promise.all([usuariosDoApp(db), membrosDoSlack(token)]);
  const porId = new Map(membros.map((m) => [m.id, m]));
  const porEmail = new Map(membros.filter((m) => m.email).map((m) => [m.email, m]));

  const usados = new Set<string>();
  const ligados: string[] = [];
  const adminsSemPar: string[] = [];
  const outrosSemPar: string[] = [];

  for (const u of usuarios) {
    const m = u.slackUserId ? porId.get(u.slackUserId) : u.email ? porEmail.get(u.email) : undefined;
    if (m) {
      usados.add(m.id);
      ligados.push(`• ${u.nome} ↔ <@${m.id}>`);
    } else if (u.perfil === 'administrador') {
      adminsSemPar.push(`• ${u.nome} — ${u.email || 'sem e-mail'}`);
    } else {
      outrosSemPar.push(`• ${u.nome} — ${u.email || 'sem e-mail'}`);
    }
  }
  const slackSemPar = membros.filter((m) => !usados.has(m.id)).map((m) => `• <@${m.id}> — ${m.email || 'e-mail oculto'}`);

  const secao = (titulo: string, linhas: string[]) =>
    linhas.length ? `*${titulo} (${linhas.length})*\n${linhas.join('\n')}` : `*${titulo}:* nenhum`;

  return [
    secao('✅ Ligados', ligados),
    secao('⚠️ Administradores do app sem par no Slack — importam: podem ser responsáveis', adminsSemPar),
    secao('Formadores do app sem par no Slack — só importa se usarem o Slack', outrosSemPar),
    secao('⚠️ Pessoas do Slack sem par no app — o que fizerem fica como "Nome (Slack)"', slackSemPar),
    '_Para corrigir: deixe o e-mail igual nos dois lados, ou preencha `slackUserId` no documento da pessoa em `usuarios` (console do Firebase)._',
  ].join('\n\n');
}

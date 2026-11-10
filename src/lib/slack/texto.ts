import { format } from 'date-fns';

/** O Slack trata `<`, `>` e `&` como marcação: texto do usuário precisa ser escapado. */
export const escapar = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const truncar = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;

/** Aceita Timestamp do SDK do cliente, do Admin SDK ou Date. */
export const paraData = (t: unknown): Date | null => {
  if (!t) return null;
  if (t instanceof Date) return t;
  const comToDate = t as { toDate?: () => Date };
  if (typeof comToDate.toDate === 'function') {
    try {
      return comToDate.toDate();
    } catch {
      return null;
    }
  }
  return null;
};

export const dataBR = (t: unknown): string => {
  const d = paraData(t);
  return d ? format(d, 'dd/MM/yyyy') : '';
};

/** Período "12/11/2026" ou "12/11/2026 a 14/11/2026". */
export const periodoBR = (inicio: unknown, fim: unknown): string => {
  const i = dataBR(inicio);
  const f = dataBR(fim);
  if (!i && !f) return 'sem data';
  if (!i || !f || i === f) return i || f;
  return `${i} a ${f}`;
};

export const link = (url: string, rotulo: string): string => `<${url}|${escapar(rotulo)}>`;

/** Link para uma tela do app, ou só o rótulo quando o endereço do app não foi configurado. */
export const linkApp = (appUrl: string, caminho: string, rotulo: string): string =>
  appUrl ? link(`${appUrl.replace(/\/+$/, '')}${caminho}`, rotulo) : escapar(rotulo);

export const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

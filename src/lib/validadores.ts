/**
 * Quem pode validar uma demanda concluída.
 *
 * Lida pela tela do Diário (`/diario`). Fica num arquivo próprio para que
 * qualquer outra porta que valide demandas use a mesma lista, e não uma cópia.
 *
 * A comparação é por e-mail, em minúsculas.
 */
export const VALIDADORES = ['beto-a-p@hotmail.com', 'irene@editoralt.com.br'];

export const podeValidar = (email: string | null | undefined): boolean =>
  !!email && VALIDADORES.includes(email.trim().toLowerCase());

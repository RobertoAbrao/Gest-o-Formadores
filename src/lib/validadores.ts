/**
 * Quem pode validar uma demanda concluída.
 *
 * Fica aqui, e não dentro da tela do Diário, porque duas portas leem esta lista:
 * a tela (`/diario`) e o bot do Slack (`functions/src/demandas`). Se cada uma
 * tivesse a sua cópia, um dia alguém validaria por um lado e não pelo outro.
 *
 * A comparação é por e-mail, em minúsculas.
 */
export const VALIDADORES = ['beto-a-p@hotmail.com', 'irene@editoralt.com.br'];

export const podeValidar = (email: string | null | undefined): boolean =>
  !!email && VALIDADORES.includes(email.trim().toLowerCase());

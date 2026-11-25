/**
 * Regressão — rolagem do mouse não funcionava em listas dentro de janelas (25/11/2026).
 *
 * Sintoma: em Projetos → Editar, a lista do campo Material (11 produtos) não rolava com
 * a roda do mouse; só pela barra. Mesmo defeito em toda lista de Popover aberta dentro
 * de um Dialog (municípios do formador, formadores do projeto, materiais da formação…).
 *
 * Causa: o Dialog bloqueia a rolagem fora dele (react-remove-scroll). A lista do Popover
 * é desenhada fora do Dialog (Portal no <body>), então caía no bloqueio. O bloqueio é uma
 * pilha e só o de cima vale; com `modal`, o Popover empilha o próprio bloqueio, que
 * libera a rolagem dentro da lista.
 *
 * Por que nada pegou: não há teste de tela, e quem testava usava a barra de rolagem.
 * A correção é no componente compartilhado — vale para todos os Popovers, inclusive os
 * próximos. Quem precisar do comportamento antigo passa `modal={false}` explicitamente.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Popover } from './popover';

type Props = { modal?: boolean; children?: null };
/** Popover só repassa props ao Root do Radix — dá para chamar sem montar a tela. */
const raiz = (props: Props) => (Popover as unknown as (p: Props) => ReactElement<Props>)(props);

test('Popover é modal por padrão (lista rola com o mouse dentro de janela)', () => {
  assert.notEqual(
    Popover,
    PopoverPrimitive.Root,
    'Popover é o Root do Radix sem padrão: modal fica false e a lista não rola dentro de um Dialog'
  );
  assert.equal(raiz({ children: null }).props.modal, true);
});

test('quem pede modal={false} explicitamente continua recebendo', () => {
  assert.equal(raiz({ modal: false, children: null }).props.modal, false);
});
